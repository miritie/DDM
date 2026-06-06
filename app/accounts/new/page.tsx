'use client';

/**
 * Page - Nouveau Compte Tiers (avances & dettes)
 * Formulaire de création — agent, fournisseur, client ou autre.
 * (Le lien depuis /advances-debts/new pointait vers un 404.)
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';

const TYPES = [
  { value: 'agent', label: 'Agent (employé / commercial)' },
  { value: 'supplier', label: 'Fournisseur' },
  { value: 'client', label: 'Client' },
  { value: 'other', label: 'Autre' },
];

export default function NewAccountPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('agent');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Le nom est requis'); return; }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          accountType,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur lors de la création');
      router.push('/advances-debts/accounts');
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.ADVANCE_CREATE}>
      <div className="container mx-auto p-6 max-w-xl space-y-4">
        <div>
          <Link href="/advances-debts/accounts" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-4 h-4" /> Comptes tiers
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserPlus className="w-7 h-7 text-amber-700" /> Nouveau Compte Tiers
          </h1>
          <p className="text-muted-foreground">Pour suivre les avances et dettes d'un tiers</p>
        </div>

        <Card>
          <CardContent className="pt-5">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Nom *</label>
                <input value={name} onChange={e => setName(e.target.value)} required
                  placeholder="Nom complet ou raison sociale"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Type *</label>
                <select value={accountType} onChange={e => setAccountType(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Téléphone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Adresse</label>
                <input value={address} onChange={e => setAddress(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
              </div>

              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
              )}

              <button type="submit" disabled={saving}
                className="w-full py-3 rounded-xl bg-amber-700 text-white font-bold hover:bg-amber-800 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Création…</> : 'Créer le compte'}
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
