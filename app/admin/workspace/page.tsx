'use client';

/**
 * Admin — Paramètres workspace (branding utilisé pour les en-têtes imprimables)
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Loader2, Building2 } from 'lucide-react';

interface WorkspaceData {
  id: string; name: string; description?: string;
  slogan?: string; address?: string; phone?: string; email?: string;
  logo_url?: string; currency?: string; timezone?: string;
}

export default function WorkspaceAdminPage() {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/workspace');
      if (r.ok) setData((await r.json()).data);
    } finally { setLoading(false); }
  }

  async function save() {
    if (!data) return;
    setSaving(true); setFeedback(null);
    try {
      const r = await fetch('/api/admin/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name, description: data.description, slogan: data.slogan,
          address: data.address, phone: data.phone, email: data.email,
          logo_url: data.logo_url, currency: data.currency, timezone: data.timezone,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur');
      setFeedback('✅ Paramètres enregistrés');
    } catch (e: any) {
      setFeedback(`❌ ${e.message}`);
    } finally { setSaving(false); }
  }

  if (loading || !data) {
    return <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>;
  }

  return (
    <ProtectedPage permission={PERMISSIONS.ADMIN_SETTINGS_VIEW}>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Link href="/admin" className="inline-flex items-center text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour à l'admin
        </Link>

        <div className="flex items-center gap-3">
          <Building2 className="w-7 h-7 text-blue-600" />
          <h1 className="text-3xl font-bold">Paramètres entreprise</h1>
        </div>
        <p className="text-sm text-gray-600">
          Ces informations apparaissent dans les en-têtes des programmes, factures et reçus imprimables.
        </p>

        {feedback && (
          <div className={`px-4 py-2 rounded-md text-sm ${feedback.startsWith('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {feedback}
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl border space-y-3">
          <h2 className="font-bold text-lg mb-2">Identité</h2>
          <Field label="Raison sociale" value={data.name} onChange={v => setData({ ...data, name: v })} />
          <Field label="Slogan" value={data.slogan || ''} onChange={v => setData({ ...data, slogan: v })} placeholder="ex. Le meilleur du miel" />
          <Field label="Description" value={data.description || ''} onChange={v => setData({ ...data, description: v })} multiline />
          <Field label="URL du logo" value={data.logo_url || ''} onChange={v => setData({ ...data, logo_url: v })} placeholder="https://..." />
        </div>

        <div className="bg-white p-6 rounded-2xl border space-y-3">
          <h2 className="font-bold text-lg mb-2">Coordonnées</h2>
          <Field label="Adresse" value={data.address || ''} onChange={v => setData({ ...data, address: v })} multiline />
          <Field label="Téléphone" value={data.phone || ''} onChange={v => setData({ ...data, phone: v })} />
          <Field label="Email" value={data.email || ''} onChange={v => setData({ ...data, email: v })} />
        </div>

        <div className="bg-white p-6 rounded-2xl border space-y-3">
          <h2 className="font-bold text-lg mb-2">Localisation</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Devise" value={data.currency || 'XOF'} onChange={v => setData({ ...data, currency: v })} />
            <Field label="Fuseau horaire" value={data.timezone || 'Africa/Abidjan'} onChange={v => setData({ ...data, timezone: v })} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Save className="w-4 h-4 mr-1" />{saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </Button>
        </div>
      </div>
    </ProtectedPage>
  );
}

function Field({ label, value, onChange, multiline, placeholder }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-gray-600 block mb-0.5">{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2} className="w-full px-3 py-2 border rounded-md" />
        : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 border rounded-md" />}
    </div>
  );
}
