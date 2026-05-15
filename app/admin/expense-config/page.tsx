'use client';

/**
 * Page — Configuration des dépenses (admin + comptable)
 *
 * Page unique qui regroupe toute la config nécessaire au bon fonctionnement
 * du module dépenses :
 *   - Onglet 1 : Catégories (CRUD + droits d'accès par rôle + mapping comptable + TVA)
 *   - Onglet 2 : Plan comptable OHADA (CRUD des comptes)
 *   - Onglet 3 : Wallets (mapping wallet → compte de trésorerie)
 *
 * Accessible à toute personne ayant EXPENSE_APPROVE (admin + comptable
 * typiquement). Sans cette config, le workflow demande → validation →
 * paiement → écriture comptable ne fonctionne pas correctement.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Settings, Tag, BookOpen, Wallet as WalletIcon, Layers,
  Plus, Edit2, X, Save, Loader2, AlertTriangle, Check, Trash2,
} from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface Category {
  id: string;
  expense_category_id: string;
  label: string;
  code: string;
  description: string | null;
  requires_pre_approval: boolean;
  is_active: boolean;
  allowed_role_ids: string[] | null;
  charge_account_id: string | null;
  tva_account_id: string | null;
  tva_rate: number | string;
}

interface ChartAccount {
  Id?: string;
  id?: string;
  AccountId?: string;
  AccountNumber: string;
  account_number?: string;
  Label: string;
  label?: string;
  AccountClass: string;
  account_class?: string;
  AccountType: string;
  account_type?: string;
  IsActive?: boolean;
  is_active?: boolean;
  Description?: string;
}

interface Wallet {
  Id?: string;
  id?: string;
  WalletId?: string;
  Name?: string;
  name?: string;
  Type?: string;
  type?: string;
  Balance?: number;
  ChartAccountId?: string;
  chart_account_id?: string;
  IsActive?: boolean;
}

interface RoleOption {
  id: string;
  role_id: string;
  name: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const INP = 'w-full h-10 px-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-amber-500 text-sm';

function pickAccountId(a: ChartAccount): string {
  return (a.Id ?? a.id ?? '') as string;
}
function pickAccountNumber(a: ChartAccount): string {
  return a.AccountNumber ?? a.account_number ?? '';
}
function pickAccountLabel(a: ChartAccount): string {
  return a.Label ?? a.label ?? '';
}
function pickAccountClass(a: ChartAccount): string {
  return a.AccountClass ?? a.account_class ?? '';
}
function pickAccountType(a: ChartAccount): string {
  return a.AccountType ?? a.account_type ?? '';
}
function pickAccountIsActive(a: ChartAccount): boolean {
  return (a.IsActive ?? a.is_active ?? true) as boolean;
}
function pickWalletId(w: Wallet): string {
  return (w.Id ?? w.id ?? '') as string;
}
function pickWalletName(w: Wallet): string {
  return w.Name ?? w.name ?? '';
}
function pickWalletType(w: Wallet): string {
  return w.Type ?? w.type ?? '';
}
function pickWalletAccountId(w: Wallet): string | null {
  return (w.ChartAccountId ?? w.chart_account_id ?? null) as string | null;
}

// ----------------------------------------------------------------------------
// Page
// ----------------------------------------------------------------------------

type Tab = 'categories' | 'types' | 'accounts' | 'wallets';

export default function ExpenseConfigPage() {
  return (
    <ProtectedPage permission={PERMISSIONS.EXPENSE_APPROVE}>
      <Content />
    </ProtectedPage>
  );
}

function Content() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('categories');

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-7 h-7" /> Configuration des dépenses
          </h1>
          <p className="text-sm opacity-90 mt-1">
            Catégories, plan comptable OHADA, mapping wallets — tout au même endroit.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-4">
        {/* Switcher d'onglets */}
        <div className="bg-white rounded-2xl shadow-xl p-2 mb-4 flex gap-1 overflow-x-auto">
          <TabButton active={tab === 'categories'} onClick={() => setTab('categories')} icon={Tag}>
            Catégories
          </TabButton>
          <TabButton active={tab === 'types'} onClick={() => setTab('types')} icon={Layers}>
            Types
          </TabButton>
          <TabButton active={tab === 'accounts'} onClick={() => setTab('accounts')} icon={BookOpen}>
            Plan comptable
          </TabButton>
          <TabButton active={tab === 'wallets'} onClick={() => setTab('wallets')} icon={WalletIcon}>
            Wallets
          </TabButton>
        </div>

        {tab === 'categories' && <CategoriesPanel />}
        {tab === 'types' && <TypesPanel />}
        {tab === 'accounts' && <AccountsPanel />}
        {tab === 'wallets' && <WalletsPanel />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
        active
          ? 'bg-amber-600 text-white'
          : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

// ============================================================================
// PANNEAU 1 : Catégories
// ============================================================================

function CategoriesPanel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [cR, aR, rR] = await Promise.all([
        fetch('/api/expenses/categories').then(r => r.json()),
        fetch('/api/accounting/accounts').then(r => r.json()),
        fetch('/api/expenses/role-options').then(r => r.json()),
      ]);
      setCategories(cR.data || []);
      setAccounts(aR.data || []);
      setRoles(rR.data || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const accById = new Map(accounts.map(a => [pickAccountId(a), a]));
  const roleById = new Map(roles.map(r => [r.id, r]));
  const chargeAccounts = accounts.filter(a => pickAccountClass(a) === 'class_6');
  const tvaAccounts = accounts.filter(a => pickAccountNumber(a).startsWith('445'));

  if (loading) {
    return <div className="bg-white rounded-2xl shadow-xl p-8 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-lg">Catégories de dépenses ({categories.length})</h2>
        <Button onClick={() => setCreating(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Nouvelle
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-gray-500 border-b">
              <th className="text-left py-2">Label · Code</th>
              <th className="text-left py-2">Accès</th>
              <th className="text-left py-2">Compte charge</th>
              <th className="text-right py-2">TVA</th>
              <th className="text-center py-2">Pré-appro.</th>
              <th className="text-center py-2">Actif</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map(c => {
              const charge = c.charge_account_id ? accById.get(c.charge_account_id) : null;
              const restricted = c.allowed_role_ids && c.allowed_role_ids.length > 0;
              return (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2.5">
                    <div className="font-semibold">{c.label}</div>
                    <div className="text-xs text-gray-500 font-mono">{c.code}</div>
                  </td>
                  <td className="py-2.5">
                    {restricted ? (
                      <div className="flex flex-wrap gap-1">
                        {c.allowed_role_ids!.slice(0, 3).map(id => (
                          <span key={id} className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {roleById.get(id)?.name || '?'}
                          </span>
                        ))}
                        {c.allowed_role_ids!.length > 3 && (
                          <span className="text-xs text-gray-500">+{c.allowed_role_ids!.length - 3}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Tous</span>
                    )}
                  </td>
                  <td className="py-2.5 text-xs">
                    {charge ? (
                      <span className="font-mono">{pickAccountNumber(charge)} {pickAccountLabel(charge)}</span>
                    ) : (
                      <span className="text-red-600">⚠ non mappé</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right text-xs">
                    {Number(c.tva_rate) > 0 ? `${c.tva_rate}%` : '—'}
                  </td>
                  <td className="py-2.5 text-center">
                    {c.requires_pre_approval ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2.5 text-center">
                    {c.is_active ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-gray-400 mx-auto" />}
                  </td>
                  <td className="py-2.5 text-right">
                    <button onClick={() => setEditing(c)} className="text-amber-600 hover:text-amber-800">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <CategoryEditModal
          category={editing}
          isCreate={creating}
          roles={roles}
          chargeAccounts={chargeAccounts}
          tvaAccounts={tvaAccounts}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function CategoryEditModal({
  category, isCreate, roles, chargeAccounts, tvaAccounts, onClose, onSaved,
}: {
  category: Category | null;
  isCreate: boolean;
  roles: RoleOption[];
  chargeAccounts: ChartAccount[];
  tvaAccounts: ChartAccount[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(category?.label || '');
  const [code, setCode] = useState(category?.code || '');
  const [description, setDescription] = useState(category?.description || '');
  const [requiresPreApproval, setRequiresPreApproval] = useState(category?.requires_pre_approval ?? false);
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [allowedRoleIds, setAllowedRoleIds] = useState<string[]>(category?.allowed_role_ids || []);
  const [chargeAccountId, setChargeAccountId] = useState(category?.charge_account_id || '');
  const [tvaAccountId, setTvaAccountId] = useState(category?.tva_account_id || '');
  const [tvaRate, setTvaRate] = useState<string>(category?.tva_rate?.toString() || '0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(id: string) {
    setAllowedRoleIds(curr => curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body: any = {
        label, code, description: description || null,
        requiresPreApproval, isActive,
        allowedRoleIds: allowedRoleIds.length > 0 ? allowedRoleIds : null,
        chargeAccountId: chargeAccountId || null,
        tvaAccountId: tvaAccountId || null,
        tvaRate: Number(tvaRate) || 0,
      };
      const url = isCreate
        ? '/api/expenses/categories'
        : `/api/expenses/categories/${category!.expense_category_id}`;
      const method = isCreate ? 'POST' : 'PATCH';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-lg">{isCreate ? 'Nouvelle catégorie' : 'Modifier la catégorie'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Label *</label>
              <input className={INP} value={label} onChange={e => setLabel(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Code (kebab-case) *</label>
              <input className={INP} value={code} onChange={e => setCode(e.target.value)} disabled={!isCreate} />
              {!isCreate && <p className="text-[10px] text-gray-400 mt-0.5">Non modifiable après création</p>}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Description</label>
            <textarea className={INP + ' h-auto py-2'} rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={requiresPreApproval} onChange={e => setRequiresPreApproval(e.target.checked)} />
              Pré-approbation requise
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              Actif
            </label>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-semibold mb-2">Rôles autorisés</p>
            <p className="text-xs text-gray-500 mb-2">Aucune sélection = catégorie accessible à tous les utilisateurs.</p>
            <div className="flex flex-wrap gap-2">
              {roles.map(r => {
                const selected = allowedRoleIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRole(r.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border-2 transition-colors ${
                      selected ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-semibold">Mapping comptable (OHADA)</p>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Compte de charge (classe 6) *</label>
              <select className={INP} value={chargeAccountId} onChange={e => setChargeAccountId(e.target.value)}>
                <option value="">— Sélectionner —</option>
                {chargeAccounts.map(a => (
                  <option key={pickAccountId(a)} value={pickAccountId(a)}>
                    {pickAccountNumber(a)} — {pickAccountLabel(a)}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400 mt-0.5">Compte débité lors du paiement (montant HT).</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Compte TVA déductible</label>
                <select className={INP} value={tvaAccountId} onChange={e => setTvaAccountId(e.target.value)}>
                  <option value="">— Aucun (pas de TVA) —</option>
                  {tvaAccounts.map(a => (
                    <option key={pickAccountId(a)} value={pickAccountId(a)}>
                      {pickAccountNumber(a)} — {pickAccountLabel(a)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Taux TVA (%)</label>
                <input type="number" min={0} max={100} step={0.5} className={INP} value={tvaRate} onChange={e => setTvaRate(e.target.value)} />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-sm flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-none mt-0.5" /> {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving || !label || !code} className="bg-amber-600 hover:bg-amber-700 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PANNEAU 2 : Plan comptable
// ============================================================================

const ACCOUNT_CLASSES = [
  { value: '', label: 'Toutes' },
  { value: 'class_1', label: '1 - Ressources' },
  { value: 'class_2', label: '2 - Actif immobilisé' },
  { value: 'class_3', label: '3 - Stocks' },
  { value: 'class_4', label: '4 - Tiers' },
  { value: 'class_5', label: '5 - Trésorerie' },
  { value: 'class_6', label: '6 - Charges' },
  { value: 'class_7', label: '7 - Produits' },
];
const ACCOUNT_TYPES = [
  { value: 'asset', label: 'Actif' },
  { value: 'liability', label: 'Passif' },
  { value: 'equity', label: 'Capitaux propres' },
  { value: 'revenue', label: 'Produit' },
  { value: 'expense', label: 'Charge' },
];

function AccountsPanel() {
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('');
  const [editing, setEditing] = useState<ChartAccount | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/accounting/accounts');
      const j = await r.json();
      setAccounts(j.data || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = classFilter
    ? accounts.filter(a => pickAccountClass(a) === classFilter)
    : accounts;

  if (loading) {
    return <div className="bg-white rounded-2xl shadow-xl p-8 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="font-bold text-lg">Plan comptable ({filtered.length})</h2>
        <Button onClick={() => setCreating(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Nouveau compte
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        {ACCOUNT_CLASSES.map(c => (
          <button
            key={c.value}
            onClick={() => setClassFilter(c.value)}
            className={`text-xs px-3 py-1.5 rounded-full ${
              classFilter === c.value ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-gray-500 border-b">
              <th className="text-left py-2">N° compte</th>
              <th className="text-left py-2">Libellé</th>
              <th className="text-left py-2">Classe</th>
              <th className="text-left py-2">Type</th>
              <th className="text-center py-2">Actif</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={pickAccountId(a)} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2.5 font-mono">{pickAccountNumber(a)}</td>
                <td className="py-2.5">{pickAccountLabel(a)}</td>
                <td className="py-2.5 text-xs text-gray-600">{pickAccountClass(a).replace('class_', 'Classe ')}</td>
                <td className="py-2.5 text-xs text-gray-600">{pickAccountType(a)}</td>
                <td className="py-2.5 text-center">
                  {pickAccountIsActive(a) ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-gray-400 mx-auto" />}
                </td>
                <td className="py-2.5 text-right">
                  <button onClick={() => setEditing(a)} className="text-amber-600 hover:text-amber-800">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <AccountEditModal
          account={editing}
          isCreate={creating}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function AccountEditModal({
  account, isCreate, onClose, onSaved,
}: {
  account: ChartAccount | null;
  isCreate: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [accountNumber, setAccountNumber] = useState(account ? pickAccountNumber(account) : '');
  const [label, setLabel] = useState(account ? pickAccountLabel(account) : '');
  const [accountClass, setAccountClass] = useState(account ? pickAccountClass(account) : 'class_6');
  const [accountType, setAccountType] = useState(account ? pickAccountType(account) : 'expense');
  const [description, setDescription] = useState(account?.Description || '');
  const [isActive, setIsActive] = useState(account ? pickAccountIsActive(account) : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = { accountNumber, label, accountClass, accountType, description: description || undefined, isActive };
      const url = isCreate
        ? '/api/accounting/accounts'
        : `/api/accounting/accounts/${pickAccountId(account!) || account!.AccountId}`;
      const method = isCreate ? 'POST' : 'PATCH';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-lg">{isCreate ? 'Nouveau compte' : 'Modifier le compte'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">N° compte *</label>
              <input className={INP + ' font-mono'} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} disabled={!isCreate} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-700 block mb-1">Libellé *</label>
              <input className={INP} value={label} onChange={e => setLabel(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Classe *</label>
              <select className={INP} value={accountClass} onChange={e => setAccountClass(e.target.value)}>
                {ACCOUNT_CLASSES.filter(c => c.value).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Type *</label>
              <select className={INP} value={accountType} onChange={e => setAccountType(e.target.value)}>
                {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Description</label>
            <textarea className={INP + ' h-auto py-2'} rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            Actif
          </label>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-sm flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-none mt-0.5" /> {error}
            </div>
          )}
        </div>
        <div className="border-t px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving || !accountNumber || !label} className="bg-amber-600 hover:bg-amber-700 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PANNEAU 3 : Wallets
// ============================================================================

function WalletsPanel() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [wR, aR] = await Promise.all([
        fetch('/api/treasury/wallets').then(r => r.json()),
        fetch('/api/accounting/accounts').then(r => r.json()),
      ]);
      setWallets(wR.data || []);
      setAccounts(aR.data || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const treasuryAccounts = accounts.filter(a => pickAccountClass(a) === 'class_5');

  async function updateMapping(wallet: Wallet, accountId: string) {
    const walletId = (wallet as any).WalletId || pickWalletId(wallet);
    setSavingId(walletId);
    setError(null);
    try {
      const r = await fetch(`/api/treasury/wallets/${walletId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ChartAccountId: accountId || null }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Erreur');
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <div className="bg-white rounded-2xl shadow-xl p-8 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-lg">Mapping wallets ↔ comptes de trésorerie ({wallets.length})</h2>
      </div>

      <p className="text-xs text-gray-600 mb-4">
        Chaque wallet doit pointer vers un compte de classe 5 (trésorerie). Sans ce mapping, l'écriture comptable ne peut pas être générée au paiement.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-sm flex gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 flex-none mt-0.5" /> {error}
        </div>
      )}

      <div className="space-y-2">
        {wallets.map(w => {
          const walletId = pickWalletId(w);
          const currentAccountId = pickWalletAccountId(w);
          const isSaving = savingId === ((w as any).WalletId || walletId);
          return (
            <div key={walletId} className="bg-gray-50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="font-semibold">{pickWalletName(w)}</p>
                <p className="text-xs text-gray-500 capitalize">{pickWalletType(w).replace('_', ' ')}</p>
              </div>
              <div className="flex-1">
                <select
                  className={INP}
                  value={currentAccountId || ''}
                  onChange={e => updateMapping(w, e.target.value)}
                  disabled={isSaving}
                >
                  <option value="">— Aucun compte mappé —</option>
                  {treasuryAccounts.map(a => (
                    <option key={pickAccountId(a)} value={pickAccountId(a)}>
                      {pickAccountNumber(a)} — {pickAccountLabel(a)}
                    </option>
                  ))}
                </select>
              </div>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// PANNEAU 4 : Types de dépense
// ============================================================================

interface ExpenseType {
  id: string;
  expense_type_id: string;
  category_id: string;
  category_label: string;
  category_code: string;
  label: string;
  code: string;
  description: string | null;
  is_active: boolean;
  allowed_role_ids: string[] | null;
  charge_account_id: string | null;
  charge_account_number: string | null;
  charge_account_label: string | null;
  tva_account_id: string | null;
  tva_account_number: string | null;
  tva_rate: number | string | null;
}

function TypesPanel() {
  const [types, setTypes] = useState<ExpenseType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ExpenseType | null>(null);
  const [creating, setCreating] = useState(false);
  const [filterCategoryId, setFilterCategoryId] = useState<string>('');

  async function load() {
    setLoading(true);
    try {
      const [tR, cR, aR, rR] = await Promise.all([
        fetch('/api/expenses/types').then(r => r.json()),
        fetch('/api/expenses/categories').then(r => r.json()),
        fetch('/api/accounting/accounts').then(r => r.json()),
        fetch('/api/expenses/role-options').then(r => r.json()),
      ]);
      setTypes(tR.data || []);
      setCategories(cR.data || []);
      setAccounts(aR.data || []);
      setRoles(rR.data || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const chargeAccounts = accounts.filter(a => pickAccountClass(a) === 'class_6');
  const tvaAccounts = accounts.filter(a => pickAccountNumber(a).startsWith('445'));
  const filtered = filterCategoryId ? types.filter(t => t.category_id === filterCategoryId) : types;

  if (loading) {
    return <div className="bg-white rounded-2xl shadow-xl p-8 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="font-bold text-lg">Types de dépense ({filtered.length})</h2>
        <Button onClick={() => setCreating(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Nouveau type
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        <button
          onClick={() => setFilterCategoryId('')}
          className={`text-xs px-3 py-1.5 rounded-full ${!filterCategoryId ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Toutes
        </button>
        {categories.filter(c => c.is_active).map(c => (
          <button
            key={c.id}
            onClick={() => setFilterCategoryId(c.id)}
            className={`text-xs px-3 py-1.5 rounded-full ${filterCategoryId === c.id ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-gray-500 border-b">
              <th className="text-left py-2">Type · Code</th>
              <th className="text-left py-2">Catégorie</th>
              <th className="text-left py-2">Compte charge</th>
              <th className="text-right py-2">TVA</th>
              <th className="text-center py-2">Actif</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2">
                  <div className="font-semibold">{t.label}</div>
                  <div className="text-xs text-gray-500 font-mono">{t.code}</div>
                </td>
                <td className="py-2 text-xs">{t.category_label}</td>
                <td className="py-2 text-xs">
                  {t.charge_account_number ? (
                    <span className="font-mono">{t.charge_account_number} {t.charge_account_label}</span>
                  ) : (
                    <span className="text-gray-400 italic">hérite de la catégorie</span>
                  )}
                </td>
                <td className="py-2 text-right text-xs">
                  {t.tva_rate !== null && Number(t.tva_rate) > 0 ? `${t.tva_rate}%` : <span className="text-gray-400">—</span>}
                </td>
                <td className="py-2 text-center">
                  {t.is_active ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-gray-400 mx-auto" />}
                </td>
                <td className="py-2 text-right">
                  <button onClick={() => setEditing(t)} className="text-amber-600 hover:text-amber-800">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-400 py-6">Aucun type pour cette catégorie.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <TypeEditModal
          type={editing}
          isCreate={creating}
          categories={categories.filter(c => c.is_active)}
          chargeAccounts={chargeAccounts}
          tvaAccounts={tvaAccounts}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function TypeEditModal({
  type, isCreate, categories, chargeAccounts, tvaAccounts, onClose, onSaved,
}: {
  type: ExpenseType | null;
  isCreate: boolean;
  categories: Category[];
  chargeAccounts: ChartAccount[];
  tvaAccounts: ChartAccount[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categoryId, setCategoryId] = useState(type?.category_id || (categories[0]?.id || ''));
  const [label, setLabel] = useState(type?.label || '');
  const [code, setCode] = useState(type?.code || '');
  const [description, setDescription] = useState(type?.description || '');
  const [isActive, setIsActive] = useState(type?.is_active ?? true);
  const [chargeAccountId, setChargeAccountId] = useState(type?.charge_account_id || '');
  const [tvaAccountId, setTvaAccountId] = useState(type?.tva_account_id || '');
  const [tvaRate, setTvaRate] = useState<string>(type?.tva_rate !== null && type?.tva_rate !== undefined ? type.tva_rate.toString() : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body: any = {
        categoryId, label, code, description: description || null,
        isActive,
        chargeAccountId: chargeAccountId || null,
        tvaAccountId: tvaAccountId || null,
        tvaRate: tvaRate === '' ? null : Number(tvaRate),
      };
      const url = isCreate ? '/api/expenses/types' : `/api/expenses/types/${type!.expense_type_id}`;
      const method = isCreate ? 'POST' : 'PATCH';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-lg">{isCreate ? 'Nouveau type' : 'Modifier le type'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Catégorie parente *</label>
            <select className={INP} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Label *</label>
              <input className={INP} value={label} onChange={e => setLabel(e.target.value)} placeholder="ex: Farine" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Code (kebab-case) *</label>
              <input className={INP} value={code} onChange={e => setCode(e.target.value)} disabled={!isCreate} placeholder="ex: mp_farine" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Description</label>
            <textarea className={INP + ' h-auto py-2'} rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            Actif
          </label>

          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-semibold">Surcharge comptable (sinon hérite de la catégorie)</p>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Compte de charge spécifique</label>
              <select className={INP} value={chargeAccountId} onChange={e => setChargeAccountId(e.target.value)}>
                <option value="">— Hériter de la catégorie —</option>
                {chargeAccounts.map(a => (
                  <option key={pickAccountId(a)} value={pickAccountId(a)}>
                    {pickAccountNumber(a)} — {pickAccountLabel(a)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Compte TVA spécifique</label>
                <select className={INP} value={tvaAccountId} onChange={e => setTvaAccountId(e.target.value)}>
                  <option value="">— Hériter de la catégorie —</option>
                  {tvaAccounts.map(a => (
                    <option key={pickAccountId(a)} value={pickAccountId(a)}>
                      {pickAccountNumber(a)} — {pickAccountLabel(a)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Taux TVA (%)</label>
                <input type="number" min={0} max={100} step={0.5} className={INP} value={tvaRate} onChange={e => setTvaRate(e.target.value)} placeholder="hérite si vide" />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-sm flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-none mt-0.5" /> {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving || !label || !code || !categoryId} className="bg-amber-600 hover:bg-amber-700 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}
