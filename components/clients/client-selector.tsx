'use client';

/**
 * <ClientSelector />
 *
 * Sélecteur de client grossiste réutilisable.
 *  - Autocomplete sur /api/clients?search=...
 *  - "+ Nouveau client" : ouvre un mini-form inline (création silencieuse)
 *  - Garantit que le formulaire parent reçoit toujours un clientId tracé.
 *
 * Props :
 *  - value : { id, name, companyName?, phone? } | null
 *  - onChange : appelé après sélection ou création
 *  - autoFocus, disabled
 */

import { useEffect, useRef, useState } from 'react';
import { Search, X, Plus, Loader2, Building2, Check } from 'lucide-react';

export interface SelectedClient {
  id: string;
  name: string;
  companyName?: string | null;
  phone?: string | null;
  code?: string;
}

interface Suggestion {
  id: string;
  code: string;
  name: string;
  companyName: string | null;
  phone: string | null;
}

interface Props {
  value: SelectedClient | null;
  onChange: (c: SelectedClient | null) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function ClientSelector({ value, onChange, disabled, autoFocus }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ companyName: '', contactName: '', phone: '' });
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Charge les clients dès l'ouverture du dropdown — pas besoin de taper
  // pour voir la base. Si une recherche est saisie, on filtre en debounce.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const url = query.trim()
          ? `/api/clients?isActive=true&search=${encodeURIComponent(query)}`
          : `/api/clients?isActive=true`;
        const r = await fetch(url, { cache: 'no-store' });
        const j = await r.json();
        setSuggestions((j.data || []).slice(0, 8));
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, query.trim() ? 250 : 0);
    return () => clearTimeout(t);
  }, [query, open]);

  function select(s: Suggestion) {
    onChange({ id: s.id, name: s.name, companyName: s.companyName, phone: s.phone, code: s.code });
    setQuery('');
    setOpen(false);
    setShowCreate(false);
  }

  function clear() {
    onChange(null);
    setQuery('');
    setOpen(false);
    setShowCreate(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    // Le nom obligatoire en DB = soit le contact, soit la société. On accepte
    // l'un OU l'autre et on retombe sur l'autre s'il manque.
    const company = createForm.companyName.trim();
    const contact = createForm.contactName.trim();
    if (!company && !contact) {
      setCreateError('Renseigne au moins la société ou le nom du contact.');
      return;
    }
    const nameForDb = contact || company; // name NOT NULL en DB
    const companyForDb = company || null;
    try {
      setCreating(true);
      const r = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameForDb,
          companyName: companyForDb,
          phone: createForm.phone.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setCreateError(j?.error || `Erreur (HTTP ${r.status})`);
        return;
      }
      onChange({
        id: j.data.id,
        name: j.data.name,
        companyName: j.data.companyName,
        phone: j.data.phone,
        code: j.data.code,
      });
      setShowCreate(false);
      setCreateForm({ companyName: '', contactName: '', phone: '' });
      setQuery('');
      setOpen(false);
    } catch (err: any) {
      setCreateError(err.message || 'Erreur réseau');
    } finally {
      setCreating(false);
    }
  }

  // Si déjà un client sélectionné → afficher la "puce" + bouton retirer
  if (value) {
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 truncate">
            {value.companyName || value.name}
          </div>
          <div className="text-xs text-gray-600 truncate">
            {value.code && <span className="font-mono mr-2">{value.code}</span>}
            {value.companyName && value.name && <span>{value.name}</span>}
            {value.phone && <span className="ml-2">📞 {value.phone}</span>}
          </div>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={clear}
            className="text-gray-400 hover:text-red-600 transition-colors"
            title="Changer de client"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Mode recherche */}
      {!showCreate && (
        <>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setOpen(true)}
              onBlur={() => { blurTimerRef.current = setTimeout(() => setOpen(false), 200); }}
              placeholder="Rechercher un client (nom, société, téléphone, code)…"
              disabled={disabled}
              autoFocus={autoFocus}
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-100"
            />
            {loading && (
              <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" />
            )}
          </div>

          {/* Dropdown suggestions — toujours affiché à l'ouverture */}
          {open && (
            <div
              onMouseDown={() => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current); }}
              className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-72 overflow-y-auto"
            >
              {loading && suggestions.length === 0 ? (
                <div className="px-3 py-3 text-sm text-gray-500 text-center">
                  <Loader2 className="w-4 h-4 inline animate-spin mr-1" /> Chargement…
                </div>
              ) : suggestions.length > 0 ? (
                <>
                  {!query.trim() && (
                    <div className="px-3 py-1.5 text-xs text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                      Clients existants
                    </div>
                  )}
                  <ul>
                    {suggestions.map(s => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => select(s)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex items-center gap-2"
                        >
                          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {s.companyName || s.name}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              <span className="font-mono mr-2">{s.code}</span>
                              {s.companyName && <span className="mr-2">{s.name}</span>}
                              {s.phone && <span>📞 {s.phone}</span>}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : query.trim() ? (
                <div className="px-3 py-3 text-sm text-gray-500 text-center">
                  Aucun client ne correspond à « {query} »
                </div>
              ) : (
                <div className="px-3 py-3 text-sm text-gray-500 text-center">
                  Aucun client enregistré pour l'instant.
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowCreate(true);
                  setCreateError(null);
                  setCreateForm({ companyName: query.trim(), contactName: '', phone: '' });
                }}
                className="w-full px-3 py-2 border-t border-gray-100 text-left text-blue-600 hover:bg-blue-50 font-medium text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Créer un nouveau client {query.trim() ? `« ${query.trim()} »` : ''}
              </button>
            </div>
          )}
        </>
      )}

      {/* Mode création inline */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nouveau client grossiste
            </h4>
            <button type="button" onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-600">
            Renseigne au moins la société <strong>ou</strong> le nom du contact.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Société / Raison sociale</label>
              <input type="text" value={createForm.companyName}
                onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="Ex: Sarl Distrib Abidjan" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nom du contact</label>
              <input type="text" value={createForm.contactName}
                onChange={(e) => setCreateForm({ ...createForm, contactName: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="Ex: Adama Koné" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
              <input type="tel" value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="07 00 00 00 00" />
            </div>
          </div>
          {createError && (
            <div className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded text-sm">
              ❌ {createError}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 text-sm border rounded text-gray-700 hover:bg-white">Annuler</button>
            <button type="submit" disabled={creating}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1">
              {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Créer et sélectionner
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
