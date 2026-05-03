/**
 * API - Upload d'image produit (multipart/form-data).
 *
 * Sauvegarde sous public/uploads/products/{uuid}.{ext} et renvoie l'URL publique.
 *
 * NOTE : stockage local. Pour la prod (déploiement serverless), basculer sur
 * un stockage cloud (S3, Vercel Blob, etc.).
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_EDIT);

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
    const ext = EXT[file.type];
    const filename = `${uuidv4()}.${ext}`;

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'products');
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(path.join(uploadsDir, filename), buffer);

    const url = `/uploads/products/${filename}`;
    return NextResponse.json({ url, size: file.size, type: file.type });
  } catch (error: any) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'upload' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
