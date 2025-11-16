/**
 * File Upload Component
 * Composant réutilisable pour l'upload de fichiers
 */

'use client';

import * as React from 'react';
import { uploadFile, validateFile, type UploadOptions, type UploadResult } from '@/lib/upload/file-uploader';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  onUploadComplete?: (result: UploadResult) => void;
  onUploadError?: (error: string) => void;
  options?: UploadOptions;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  buttonText?: string;
}

export function FileUpload({
  onUploadComplete,
  onUploadError,
  options = {},
  accept,
  multiple = false,
  disabled = false,
  className = '',
  buttonText = 'Choisir un fichier',
}: FileUploadProps) {
  const [uploading, setUploading] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSelectedFiles(files);

    // Auto-upload si un seul fichier
    if (!multiple && files.length === 1) {
      await handleUpload(files[0]);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);

    try {
      // Validation
      const validation = validateFile(file, options);
      if (!validation.valid) {
        onUploadError?.(validation.error || 'Fichier invalide');
        return;
      }

      // Upload
      const result = await uploadFile(file, options);
      onUploadComplete?.(result);

      // Reset
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      onUploadError?.(error.message || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadAll() {
    if (selectedFiles.length === 0) return;

    setUploading(true);

    try {
      for (const file of selectedFiles) {
        const validation = validateFile(file, options);
        if (!validation.valid) {
          onUploadError?.(`${file.name}: ${validation.error}`);
          continue;
        }

        const result = await uploadFile(file, options);
        onUploadComplete?.(result);
      }

      // Reset
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      onUploadError?.(error.message || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          accept={accept}
          multiple={multiple}
          disabled={disabled || uploading}
          className="hidden"
          id="file-upload-input"
        />
        <label htmlFor="file-upload-input">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || uploading}
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer"
          >
            {uploading ? 'Upload en cours...' : buttonText}
          </Button>
        </label>

        {multiple && selectedFiles.length > 0 && (
          <Button
            type="button"
            onClick={handleUploadAll}
            disabled={uploading}
          >
            Uploader {selectedFiles.length} fichier(s)
          </Button>
        )}
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-2 text-sm text-gray-600">
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-2">
              <span>{file.name}</span>
              <span className="text-xs text-gray-500">
                ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Composant Drag & Drop File Upload
 */
interface DragDropUploadProps extends Omit<FileUploadProps, 'buttonText'> {
  text?: string;
}

export function DragDropUpload({
  onUploadComplete,
  onUploadError,
  options = {},
  accept,
  multiple = false,
  disabled = false,
  className = '',
  text = 'Glissez-déposez vos fichiers ici ou cliquez pour sélectionner',
}: DragDropUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    await handleFiles(files);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    await handleFiles(files);
  }

  async function handleFiles(files: File[]) {
    setUploading(true);

    try {
      for (const file of files) {
        const validation = validateFile(file, options);
        if (!validation.valid) {
          onUploadError?.(`${file.name}: ${validation.error}`);
          continue;
        }

        const result = await uploadFile(file, options);
        onUploadComplete?.(result);
      }

      // Reset
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      onUploadError?.(error.message || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        accept={accept}
        multiple={multiple}
        disabled={disabled || uploading}
        className="hidden"
        id="drag-drop-input"
      />
      <label
        htmlFor="drag-drop-input"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          flex flex-col items-center justify-center
          w-full h-32 border-2 border-dashed rounded-lg
          cursor-pointer transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <svg
            className="w-8 h-8 mb-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="mb-2 text-sm text-gray-500">
            {uploading ? (
              <span className="font-semibold">Upload en cours...</span>
            ) : (
              <span className="font-semibold">{text}</span>
            )}
          </p>
          <p className="text-xs text-gray-500">
            {options.allowedTypes?.join(', ') || 'Tous types de fichiers'}
          </p>
          {options.maxSize && (
            <p className="text-xs text-gray-500">
              Taille max: {(options.maxSize / 1024 / 1024).toFixed(0)} MB
            </p>
          )}
        </div>
      </label>
    </div>
  );
}
