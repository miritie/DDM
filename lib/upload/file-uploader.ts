/**
 * File Upload Service
 * Service de téléchargement de fichiers avec support multi-providers
 */

export type UploadProvider = 'local' | 'cloudinary' | 's3';

export interface UploadOptions {
  provider?: UploadProvider;
  folder?: string;
  maxSize?: number; // en bytes
  allowedTypes?: string[];
}

export interface UploadResult {
  url: string;
  publicId?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

/**
 * Upload un fichier vers le provider configuré
 */
export async function uploadFile(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const {
    provider = (process.env.UPLOAD_PROVIDER as UploadProvider) || 'local',
    folder = 'uploads',
    maxSize = 10 * 1024 * 1024, // 10MB par défaut
    allowedTypes = ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.*'],
  } = options;

  // Validation de la taille
  if (file.size > maxSize) {
    throw new Error(`Fichier trop volumineux. Taille maximale: ${maxSize / (1024 * 1024)}MB`);
  }

  // Validation du type
  const isAllowed = allowedTypes.some((type) => {
    if (type.endsWith('/*')) {
      const prefix = type.replace('/*', '');
      return file.type.startsWith(prefix);
    }
    if (type.includes('*')) {
      const regex = new RegExp(type.replace('*', '.*'));
      return regex.test(file.type);
    }
    return file.type === type;
  });

  if (!isAllowed) {
    throw new Error(`Type de fichier non autorisé: ${file.type}`);
  }

  // Upload selon le provider
  switch (provider) {
    case 'cloudinary':
      return await uploadToCloudinary(file, folder);
    case 's3':
      return await uploadToS3(file, folder);
    case 'local':
    default:
      return await uploadLocal(file, folder);
  }
}

/**
 * Upload vers Cloudinary
 */
async function uploadToCloudinary(file: File, folder: string): Promise<UploadResult> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary not configured');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error('Upload to Cloudinary failed');
  }

  const data = await response.json();

  return {
    url: data.secure_url,
    publicId: data.public_id,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Upload vers AWS S3
 */
async function uploadToS3(file: File, folder: string): Promise<UploadResult> {
  // Pour S3, nous devons d'abord obtenir une URL signée
  const response = await fetch('/api/upload/presigned-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type,
      folder,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get presigned URL');
  }

  const { url, fields } = await response.json();

  // Upload vers S3 avec l'URL signée
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value as string);
  });
  formData.append('file', file);

  const uploadResponse = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error('Upload to S3 failed');
  }

  const fileUrl = `${url}/${fields.key}`;

  return {
    url: fileUrl,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Upload local (développement uniquement)
 */
async function uploadLocal(file: File, folder: string): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const response = await fetch('/api/upload/local', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Local upload failed');
  }

  const data = await response.json();

  return {
    url: data.url,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Supprime un fichier uploadé
 */
export async function deleteFile(url: string, publicId?: string): Promise<void> {
  const provider = (process.env.UPLOAD_PROVIDER as UploadProvider) || 'local';

  const response = await fetch('/api/upload/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, publicId, provider }),
  });

  if (!response.ok) {
    throw new Error('Failed to delete file');
  }
}

/**
 * Valide et prépare un fichier pour l'upload
 */
export function validateFile(file: File, options: UploadOptions = {}): { valid: boolean; error?: string } {
  const { maxSize = 10 * 1024 * 1024, allowedTypes = [] } = options;

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Fichier trop volumineux. Taille maximale: ${maxSize / (1024 * 1024)}MB`,
    };
  }

  if (allowedTypes.length > 0) {
    const isAllowed = allowedTypes.some((type) => {
      if (type.endsWith('/*')) {
        const prefix = type.replace('/*', '');
        return file.type.startsWith(prefix);
      }
      return file.type === type;
    });

    if (!isAllowed) {
      return {
        valid: false,
        error: `Type de fichier non autorisé: ${file.type}`,
      };
    }
  }

  return { valid: true };
}
