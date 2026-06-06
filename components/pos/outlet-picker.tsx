'use client';

/**
 * Écran de sélection du point de vente — affiché tant qu'aucun outlet
 * n'est actif. Extrait de app/sales/quick/page.tsx.
 */

import { MapPin } from 'lucide-react';
import type { Outlet } from './pos-types';

export function OutletPicker({ outlets, onPick }: {
  outlets: Outlet[];
  onPick: (outletId: string) => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <MapPin className="w-12 h-12 text-blue-600 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">Choisir mon point de vente</h1>
          <p className="text-sm text-gray-500 mt-2">Pour commencer la vente, sélectionnez le stand où vous êtes.</p>
        </div>
        {outlets.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-500">
            Aucun outlet n'est assigné à votre planning aujourd'hui.<br />
            Contactez votre manager.
          </div>
        ) : (
          <div className="space-y-3">
            {outlets.some(o => o.source === 'assignment') && (
              <>
                <div className="text-xs font-semibold text-blue-600 uppercase">Vos affectations du jour</div>
                {outlets.filter(o => o.source !== 'fallback').map(o => (
                  <button
                    key={o.id}
                    onClick={() => onPick(o.id)}
                    className="w-full text-left p-4 rounded-lg border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50"
                  >
                    <p className="font-semibold">{o.Name}</p>
                    {o.City && <p className="text-xs text-gray-500">{o.City}</p>}
                  </button>
                ))}
              </>
            )}
            {outlets.some(o => o.source === 'fallback') && (
              <>
                <div className="text-xs font-semibold text-gray-500 uppercase mt-4">
                  Autres outlets (privilège admin)
                </div>
                {outlets.filter(o => o.source === 'fallback').map(o => (
                  <button
                    key={o.id}
                    onClick={() => onPick(o.id)}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                  >
                    <p className="font-medium text-sm">{o.Name}</p>
                    {o.City && <p className="text-xs text-gray-500">{o.City}</p>}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
