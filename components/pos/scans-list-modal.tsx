'use client';

/**
 * Liste des scans QR clients en attente — modale mobile, accessible
 * depuis le bandeau client. Extrait de app/sales/quick/page.tsx.
 */

import { Smartphone, RefreshCw, X } from 'lucide-react';
import type { PendingScan } from './pos-types';

export function ScansListModal({ scans, onRefresh, onPick, onClose }: {
  scans: PendingScan[];
  onRefresh: () => void;
  onPick: (scan: PendingScan) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-bold text-base flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-amber-600" /> Scans en attente ({scans.length})
          </h2>
          <div className="flex items-center gap-1">
            <button onClick={onRefresh} className="p-1.5 rounded hover:bg-gray-100" aria-label="Rafraîchir">
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Fermer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="overflow-auto p-3 space-y-1">
          {scans.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-8">Aucun scan client en attente.</p>
          ) : (
            scans.map(s => (
              <button key={s.id} onClick={() => onPick(s)}
                className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50">
                <p className="font-medium text-sm">{s.ClientName || s.ClientPhone || '(sans nom)'}</p>
                {s.ClientName && s.ClientPhone && <p className="text-xs text-gray-500">{s.ClientPhone}</p>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
