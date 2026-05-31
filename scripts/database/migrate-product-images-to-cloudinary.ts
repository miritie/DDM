#!/usr/bin/env tsx
/**
 * Migration des images produit locales (public/uploads/products/*) vers
 * Cloudinary.
 *
 * Pour chaque produit avec image_url commençant par /uploads/products/ :
 *   1. Lit le fichier local
 *   2. Upload sur Cloudinary (dossier ddm/products)
 *   3. Met à jour products.image_url avec l'URL HTTPS Cloudinary
 *
 * Idempotent : un produit dont image_url est déjà une URL Cloudinary
 * est sauté. Si le fichier local n'existe plus, l'entrée est logguée
 * et image_url passe à NULL (l'UI affiche alors un placeholder).
 *
 * Usage :
 *   npx tsx scripts/database/migrate-product-images-to-cloudinary.ts
 *   # ou
 *   npm run migrate:product-images-to-cloudinary
 *
 * Pré-requis : CLOUDINARY_URL défini dans .env.local
 */

import { Pool } from 'pg';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL non trouvée dans .env.local');
  process.exit(1);
}
if (!process.env.CLOUDINARY_URL) {
  console.error('CLOUDINARY_URL non trouvée dans .env.local');
  process.exit(1);
}

// Parse manuel : le SDK auto-lit CLOUDINARY_URL au require-time du module,
// or dotenv.config() est appelé après l'import → on force la config ici.
const cloudUrlMatch = process.env.CLOUDINARY_URL!.match(
  /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/
);
if (!cloudUrlMatch) {
  console.error('CLOUDINARY_URL mal formée — attendu cloudinary://KEY:SECRET@CLOUD');
  process.exit(1);
}
cloudinary.config({
  cloud_name: cloudUrlMatch[3],
  api_key: cloudUrlMatch[1],
  api_secret: cloudUrlMatch[2],
  secure: true,
});

const UPLOADS_ROOT = path.join(__dirname, '../../public');

async function uploadBuffer(buffer: Buffer, publicId: string): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'ddm/products', public_id: publicId, resource_type: 'image' },
      (err, res) => {
        if (err || !res) return reject(err ?? new Error('upload échoué'));
        resolve(res);
      }
    );
    stream.end(buffer);
  });
}

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('Migration images produit → Cloudinary');

  const candidates = await pool.query(`
    SELECT id, product_id, name, image_url
    FROM products
    WHERE image_url IS NOT NULL
      AND image_url LIKE '/uploads/%'
  `);
  console.log(`  ${candidates.rowCount} produit(s) avec image locale à migrer`);

  let migrated = 0;
  let missing = 0;
  let errored = 0;

  for (const row of candidates.rows) {
    const localPath = path.join(UPLOADS_ROOT, row.image_url);
    if (!existsSync(localPath)) {
      console.log(`  [missing] ${row.product_id} ${row.name} — fichier ${row.image_url} absent → image_url=NULL`);
      await pool.query(`UPDATE products SET image_url = NULL WHERE id = $1`, [row.id]);
      missing++;
      continue;
    }
    try {
      const buffer = await readFile(localPath);
      // public_id stable basé sur product_id → idempotence + re-upload propre
      const publicId = row.product_id.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const result = await uploadBuffer(buffer, publicId);
      await pool.query(`UPDATE products SET image_url = $2 WHERE id = $1`, [row.id, result.secure_url]);
      console.log(`  [ok]      ${row.product_id} ${row.name} → ${result.secure_url}`);
      migrated++;
    } catch (e: any) {
      console.error(`  [error]   ${row.product_id} ${row.name} — ${e.message}`);
      errored++;
    }
  }

  console.log(`\nRésumé : ${migrated} migrée(s), ${missing} fichier(s) absent(s), ${errored} erreur(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error('Erreur migration :', err);
  process.exit(1);
});
