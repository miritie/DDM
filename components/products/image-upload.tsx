'use client';

/**
 * Composant - Upload d'image produit (avec aperçu et suppression)
 */

import { useRef, useState } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';

interface ProductImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
}

export function ProductImageUpload({ value, onChange }: ProductImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    setError('');
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/product-image', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur d\'upload');
      }
      const data = await res.json();
      onChange(data.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Aperçu produit"
            className="w-40 h-40 object-cover rounded-lg border border-gray-200 bg-gray-50"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 w-7 h-7 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow hover:bg-red-50 hover:border-red-300"
            aria-label="Retirer l'image"
          >
            <X className="w-4 h-4 text-red-600" />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="block mt-2 text-xs text-blue-600 hover:underline"
          >
            {uploading ? 'Upload...' : 'Remplacer'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-40 h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <span className="text-sm">Upload...</span>
            </>
          ) : (
            <>
              <ImagePlus className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Ajouter une image</span>
              <span className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP · 5 MB max</span>
            </>
          )}
        </button>
      )}

      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  );
}
