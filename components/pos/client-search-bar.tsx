'use client';

/**
 * Bandeau client du POS : recherche live de client existant + boutons
 * QR / scans en attente. Extrait de app/sales/quick/page.tsx.
 *
 * L'input interroge /api/clients/search avec debounce (250 ms). Le
 * dropdown des résultats permet de sélectionner un client, ou de créer
 * un nouveau client pré-rempli si rien ne matche.
 */

import { useEffect, useState } from 'react';
import { Users, UserPlus, QrCode, Smartphone, X } from 'lucide-react';

export interface ClientSearchResult {
  id: string;
  name: string | null;
  phone: string | null;
}

export function ClientSearchBar({
  activeClientLabel, scansCount,
  onClearClient, onSelectClient, onCreateClient, onShowQr, onShowScans,
}: {
  activeClientLabel: string | null;
  scansCount: number;
  onClearClient: () => void;
  onSelectClient: (c: ClientSearchResult) => void;
  /** Ouvre le NewClientModal pré-rempli (heuristique nom vs téléphone déjà appliquée). */
  onCreateClient: (initial: { name?: string; phone?: string }) => void;
  onShowQr: () => void;
  onShowScans: () => void;
}) {
  const [clientSearch, setClientSearch] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState<ClientSearchResult[]>([]);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);

  // Debounced search clients : 250 ms après dernière frappe.
  useEffect(() => {
    const q = clientSearch.trim();
    if (q.length === 0) {
      setClientSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/clients/search?q=' + encodeURIComponent(q));
        if (!r.ok) return;
        const { data } = await r.json();
        setClientSearchResults(Array.isArray(data) ? data : []);
      } catch { /* réseau flaky, on retentera à la prochaine frappe */ }
    }, 250);
    return () => clearTimeout(t);
  }, [clientSearch]);

  // Quand un client devient actif (sélection, création, scan), on purge la
  // recherche pour que le champ soit vierge à la prochaine vente.
  useEffect(() => {
    if (activeClientLabel) {
      setClientSearch('');
      setClientSearchResults([]);
      setClientSearchOpen(false);
    }
  }, [activeClientLabel]);

  function createFromQuery() {
    // Heuristique : si la chaîne ne contient que chiffres / espaces / + . - → téléphone
    const q = clientSearch.trim();
    const isPhone = /^[\d +.\-]+$/.test(q);
    onCreateClient(isPhone ? { phone: q } : { name: q });
    setClientSearchOpen(false);
  }

  return (
    <div className="relative px-3 py-2 bg-white border-b">
      <div className="flex items-center gap-2">
        <Users className={'w-4 h-4 shrink-0 ' + (activeClientLabel ? 'text-indigo-600' : 'text-gray-400')} />
        {activeClientLabel ? (
          <>
            <p className="text-sm truncate flex-1 font-medium text-indigo-900">
              {activeClientLabel}
            </p>
            <button onClick={onClearClient}
              className="p-1.5 text-gray-400 hover:text-red-600"
              aria-label="Retirer client">
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <input
              type="search"
              value={clientSearch}
              onChange={e => { setClientSearch(e.target.value); setClientSearchOpen(true); }}
              onFocus={() => setClientSearchOpen(true)}
              onBlur={() => { setTimeout(() => setClientSearchOpen(false), 200); }}
              placeholder="Rechercher un client (nom ou tél)…"
              className="flex-1 min-w-0 text-sm bg-transparent outline-none placeholder:text-gray-400"
              aria-label="Recherche client"
            />
            <button onClick={onShowQr}
              className="px-2.5 py-1.5 rounded-md border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 inline-flex items-center gap-1.5 text-xs font-semibold shrink-0"
              title="Afficher le QR au client">
              <QrCode className="w-4 h-4" />
              QR
            </button>
            {scansCount > 0 && (
              <button onClick={onShowScans}
                className="relative px-2.5 py-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 inline-flex items-center gap-1.5 text-xs font-semibold shrink-0"
                title="Scans QR en attente">
                <Smartphone className="w-4 h-4" />
                <span>{scansCount}</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Dropdown résultats : visible dès qu'on a tapé qqch et que l'input a le focus */}
      {!activeClientLabel && clientSearchOpen && clientSearch.trim().length > 0 && (
        <div className="absolute left-3 right-3 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden max-h-72 overflow-y-auto">
          {clientSearchResults.length === 0 ? (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={createFromQuery}
              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-sm text-indigo-700 font-medium inline-flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Créer « {clientSearch.trim()} » comme nouveau client
            </button>
          ) : (
            <>
              {clientSearchResults.map(c => (
                <button
                  key={c.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelectClient(c);
                    setClientSearch('');
                    setClientSearchResults([]);
                    setClientSearchOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <p className="text-sm font-medium text-gray-900 truncate">{c.name || '(sans nom)'}</p>
                  {c.phone && <p className="text-xs text-gray-500 truncate">{c.phone}</p>}
                </button>
              ))}
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={createFromQuery}
                className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm text-indigo-700 font-medium inline-flex items-center gap-2 border-t border-gray-100"
              >
                <UserPlus className="w-4 h-4" />
                Créer « {clientSearch.trim()} » à la place
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
