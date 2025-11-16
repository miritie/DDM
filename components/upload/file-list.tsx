/**
 * File List Component
 * Affiche une liste de fichiers uploadés avec prévisualisation
 */

'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';

export interface FileItem {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

interface FileListProps {
  files: FileItem[];
  onDelete?: (file: FileItem) => void;
  onDownload?: (file: FileItem) => void;
  showDelete?: boolean;
  showDownload?: boolean;
  className?: string;
}

export function FileList({
  files,
  onDelete,
  onDownload,
  showDelete = true,
  showDownload = true,
  className = '',
}: FileListProps) {
  function getFileIcon(mimeType: string) {
    if (mimeType.startsWith('image/')) {
      return '🖼️';
    }
    if (mimeType === 'application/pdf') {
      return '📄';
    }
    if (
      mimeType === 'application/msword' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return '📝';
    }
    if (
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      return '📊';
    }
    return '📎';
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  if (files.length === 0) {
    return (
      <div className={`p-4 text-center text-gray-500 ${className}`}>
        Aucun fichier
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          {/* Icône ou prévisualisation */}
          <div className="flex-shrink-0">
            {file.mimeType.startsWith('image/') ? (
              <img
                src={file.fileUrl}
                alt={file.fileName}
                className="w-12 h-12 object-cover rounded"
              />
            ) : (
              <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded text-2xl">
                {getFileIcon(file.mimeType)}
              </div>
            )}
          </div>

          {/* Informations du fichier */}
          <div className="flex-grow min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {file.fileName}
            </p>
            <p className="text-xs text-gray-500">
              {formatFileSize(file.fileSize)} • {formatDate(file.uploadedAt)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex items-center gap-2">
            {showDownload && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDownload?.(file)}
                title="Télécharger"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </Button>
            )}

            {showDelete && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(file)}
                title="Supprimer"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
