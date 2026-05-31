/**
 * API - Upload preuve image pour un versement de caisse.
 *
 * Quasi-identique à /api/upload/product-image mais dossier Cloudinary
 * différent (ddm/cash-deposits) et permission requise distincte
 * (cash:deposit:create).
 *
 * L'image stockée ici est référencée par cash_deposits.evidence_url.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ secure: true });
} else {
  console.warn('[upload/cash-deposit-evidence] CLOUDINARY_URL non définie');
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CASH_DEPOSIT_CREATE);

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
        { error: `Format non supporté (${file.type}).` },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Fichier trop lourd (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'ddm/cash-deposits', resource_type: 'image' },
        (err, res) => err || !res ? reject(err ?? new Error('Upload échoué')) : resolve(res)
      );
      stream.end(buffer);
    });

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      size: file.size,
      type: file.type,
    });
  } catch (error: any) {
    console.error('Cash deposit evidence upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur upload' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
