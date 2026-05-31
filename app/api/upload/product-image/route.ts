/**
 * API - Upload d'image produit (multipart/form-data) vers Cloudinary.
 *
 * L'image est envoyée vers le compte Cloudinary configuré via la variable
 * d'environnement CLOUDINARY_URL (format cloudinary://API_KEY:API_SECRET@CLOUD_NAME).
 * Cloudinary nous renvoie une URL HTTPS publique CDN ; on retourne cette
 * URL au client, qui la stocke dans products.image_url.
 *
 * Avantages vs ancien stockage local :
 *  - compatible serverless (Vercel) — pas de filesystem persistant requis
 *  - transformations à la volée (resize, format=auto/webp) directement
 *    via paramètres d'URL côté frontend
 *  - CDN global, cache HTTP automatique
 */

import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// Configure Cloudinary une seule fois au boot du module.
// Le SDK lit automatiquement CLOUDINARY_URL si présent (cf. doc Cloudinary).
// Forcing HTTPS pour éviter les mixed-content sur les vignettes.
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ secure: true });
} else {
  console.warn('[upload/product-image] CLOUDINARY_URL non définie — uploads échoueront');
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_EDIT);

    if (!process.env.CLOUDINARY_URL) {
      return NextResponse.json(
        { error: 'Stockage cloud non configuré (CLOUDINARY_URL manquant).' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: `Format non supporté (${file.type}). Utilisez JPG, PNG, WEBP ou GIF.` },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Fichier trop lourd (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum : 5 MB.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload via stream (le SDK n'expose pas d'upload Buffer direct
    // pratique côté serverless).
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'ddm/products',
          resource_type: 'image',
          // Garde le format original (jpg/png/webp/gif).
          // Le frontend pourra demander des transformations via URL.
        },
        (err, res) => {
          if (err || !res) return reject(err ?? new Error('Upload Cloudinary échoué'));
          resolve(res);
        }
      );
      stream.end(buffer);
    });

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      size: file.size,
      type: file.type,
      width: result.width,
      height: result.height,
    });
  } catch (error: any) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'upload' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
