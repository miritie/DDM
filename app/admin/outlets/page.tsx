'use client';

/**
 * Admin — Liste & création des points de vente
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Plus, MapPin, Loader2, Search, QrCode, Calendar, BarChart3, PowerSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OutletType { id: string; Code: string; Name: string }
interface Outlet {
  id: string; Code: string; Name: string; OutletTypeId?: string;
  Address?: string; City?: string; QrToken: string; IsActive: boolean;
}

export default function OutletsAdminPage() {
  const router = useRouter();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [types, setTypes] = useState<OutletType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateType, setShowCreateType] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [oRes, tRes] = await Promise.all([
        fetch('/api/outlets'),
        fetch('/api/outlets/types'),
      ]);
      if (oRes.ok) setOutlets((await oRes.json()).data || []);
      if (tRes.ok) setTypes((await tRes.json()).data || []);
    } finally { setLoading(false); }
  }

  const filtered = outlets.filter(o =>
    !search.trim() ||
    o.Name.toLowerCase().includes(search.toLowerCase()) ||
    o.Code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ProtectedPage permission={PERMISSIONS.OUTLET_VIEW}>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <MapPin className="w-7 h-7 text-blue-600" />
              Points de vente
            </h1>
            <p className="text-sm text-gray-600">{outlets.length} outlet{outlets.length > 1 ? 's' : ''} • {types.length} type{types.length > 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => router.push('/admin/outlets/activation')}>
              <PowerSquare className="w-4 h-4 mr-1" />Activation mensuelle
            </Button>
            <Button variant="outline" onClick={() => router.push('/admin/outlets/planning')}>
              <Calendar className="w-4 h-4 mr-1" />Planning
            </Button>
            <Button variant="outline" onClick={() => router.push('/admin/outlets/reporting')}>
              <BarChart3 className="w-4 h-4 mr-1" />Reporting
            </Button>
            <Button variant="outline" onClick={() => setShowCreateType(true)}>+ Type</Button>
            <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" />Nouveau point de vente</Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un outlet (nom, code)…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-3">Aucun point de vente</p>
            <Button onClick={() => setShowCreate(true)}>Créer le premier outlet</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(o => {
              const type = types.find(t => t.id === o.OutletTypeId);
              return (
                <div
                  key={o.id}
                  onClick={() => router.push(`/admin/outlets/${o.id}`)}
                  className={`p-4 rounded-2xl border-2 bg-white cursor-pointer hover:shadow-md transition ${o.IsActive ? 'border-gray-200 hover:border-blue-400' : 'border-red-200 opacity-60'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900">{o.Name}</h3>
                      <p className="text-xs text-gray-500 font-mono">{o.Code}</p>
                    </div>
                    {!o.IsActive && <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">Inactif</span>}
                  </div>
                  {type && <p className="text-xs text-blue-700 bg-blue-50 inline-block px-2 py-0.5 rounded mb-2">{type.Name}</p>}
                  {o.City && <p className="text-sm text-gray-600">{o.City}</p>}
                  {o.Address && <p className="text-xs text-gray-500">{o.Address}</p>}
                  <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-gray-500">
                    <QrCode className="w-3 h-3" />
                    <span className="font-mono truncate" title={o.QrToken}>{o.QrToken.slice(0, 8)}…</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showCreate && (
          <CreateOutletModal types={types} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); void load(); }} />
        )}
        {showCreateType && (
          <CreateTypeModal onClose={() => setShowCreateType(false)} onCreated={() => { setShowCreateType(false); void load(); }} />
        )}
      </div>
    </ProtectedPage>
  );
}

// ============================================================================

function CreateOutletModal({ types, onClose, onCreated }: { types: OutletType[]; onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [outletTypeId, setOutletTypeId] = useState<string>('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/outlets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, outletTypeId: outletTypeId || undefined, address, city }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
      onCreated();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="bg-white rounded-2xl p-6 max-w-md w-full space-y-3">
        <h2 className="text-xl font-bold mb-2">Nouveau point de vente</h2>
        <input required value={code} onChange={e => setCode(e.target.value)} placeholder="Code (unique, ex: STAND-002)" className="w-full px-3 py-2 border rounded-md" />
        <input required value={name} onChange={e => setName(e.target.value)} placeholder="Nom" className="w-full px-3 py-2 border rounded-md" />
        <select value={outletTypeId} onChange={e => setOutletTypeId(e.target.value)} className="w-full px-3 py-2 border rounded-md">
          <option value="">— Sans type —</option>
          {types.map(t => <option key={t.id} value={t.id}>{t.Name}</option>)}
        </select>
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Adresse" className="w-full px-3 py-2 border rounded-md" />
        <input value={city} onChange={e => setCity(e.target.value)} placeholder="Ville" className="w-full px-3 py-2 border rounded-md" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Création…' : 'Créer'}</Button>
        </div>
      </form>
    </div>
  );
}

function CreateTypeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/outlets/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, description }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
      onCreated();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="bg-white rounded-2xl p-6 max-w-md w-full space-y-3">
        <h2 className="text-xl font-bold mb-2">Nouveau type d'outlet</h2>
        <input required value={code} onChange={e => setCode(e.target.value)} placeholder="Code (ex: PHARMACIE)" className="w-full px-3 py-2 border rounded-md" />
        <input required value={name} onChange={e => setName(e.target.value)} placeholder="Nom (ex: Pharmacie)" className="w-full px-3 py-2 border rounded-md" />
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" className="w-full px-3 py-2 border rounded-md" rows={2} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Création…' : 'Créer'}</Button>
        </div>
      </form>
    </div>
  );
}
