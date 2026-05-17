'use client';

/**
 * Page - Sollicitation ULTRA-Rapide (Mobile-First)
 * Interface optimisée pour créer une demande de dépense en < 1 minute
 * Accessible depuis partout: stands, terrain, usine, etc.
 */

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  Camera,
  X,
  Check,
  Zap,
  AlertTriangle,
  Calendar,
  FileText,
  Loader2,
} from 'lucide-react';
import { ExpenseUrgency } from '@/types/modules';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

// Mapping code de catégorie → icône + gradient. Les catégories non listées
// utilisent un fallback générique. Permet de garder un visuel cohérent même
// quand l'admin ajoute de nouvelles catégories en BDD.
const CATEGORY_VISUALS: Record<string, { icon: string; gradient: string }> = {
  transport:           { icon: '🚗', gradient: 'from-blue-500 to-cyan-600' },
  communication:       { icon: '📱', gradient: 'from-purple-500 to-pink-600' },
  fournitures_bureau:  { icon: '📦', gradient: 'from-green-500 to-emerald-600' },
  maintenance_equip:   { icon: '🔧', gradient: 'from-orange-500 to-red-600' },
  entretien_locaux:    { icon: '🧹', gradient: 'from-teal-500 to-emerald-600' },
  marketing_pub:       { icon: '📣', gradient: 'from-pink-500 to-rose-600' },
  frais_compta:        { icon: '📊', gradient: 'from-slate-500 to-gray-700' },
  fiscalite:           { icon: '🏛️', gradient: 'from-amber-600 to-orange-700' },
  formation:           { icon: '🎓', gradient: 'from-indigo-500 to-purple-600' },
  achat_mp:            { icon: '🌾', gradient: 'from-amber-500 to-yellow-600' },
  divers:              { icon: '💼', gradient: 'from-gray-500 to-gray-700' },
};
const DEFAULT_VISUAL = { icon: '💼', gradient: 'from-gray-500 to-gray-700' };

interface ApiCategory {
  id: string;
  expense_category_id: string;
  label: string;
  code: string;
  description: string | null;
  is_active: boolean;
}

interface ApiType {
  id: string;
  expense_type_id: string;
  category_id: string;
  category_label: string;
  category_code: string;
  label: string;
  code: string;
  charge_account_number: string | null;
  charge_account_label: string | null;
}

const urgencyConfig: Record<ExpenseUrgency, { label: string; color: string; gradient: string }> = {
  low: {
    label: 'Basse',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    gradient: 'from-gray-400 to-gray-600',
  },
  normal: {
    label: 'Normale',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    gradient: 'from-blue-500 to-cyan-600',
  },
  high: {
    label: 'Haute',
    color: 'bg-orange-100 text-orange-700 border-orange-300',
    gradient: 'from-orange-500 to-amber-600',
  },
  urgent: {
    label: 'URGENTE',
    color: 'bg-red-100 text-red-700 border-red-300',
    gradient: 'from-red-500 to-pink-600',
  },
};

export default function QuickExpenseRequestPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Catégories + Types accessibles à l'utilisateur (cascade selon ses rôles)
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [allTypes, setAllTypes] = useState<ApiType[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Form state
  const [amount, setAmount] = useState<number>(0);
  const [categoryId, setCategoryId] = useState<string>('');
  const [typeId, setTypeId] = useState<string>('');
  const [customTypeLabel, setCustomTypeLabel] = useState<string>(''); // saisi si "Autre…"
  const [showOtherType, setShowOtherType] = useState<boolean>(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<ExpenseUrgency>('normal');
  const [photos, setPhotos] = useState<Array<{ file: File; preview: string }>>([]);
  // Date du jour par défaut (modifiable). YYYY-MM-DD pour <input type="date">.
  const [neededByDate, setNeededByDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/expenses/categories?accessibleFor=me&isActive=true').then(r => r.ok ? r.json() : { data: [] }),
      fetch('/api/expenses/types?accessibleFor=me').then(r => r.ok ? r.json() : { data: [] }),
    ]).then(([cR, tR]) => {
      setCategories(cR.data || []);
      setAllTypes(tR.data || []);
    }).finally(() => setLoadingCategories(false));
  }, []);

  // Types filtrés selon la catégorie sélectionnée
  const typesForCategory = categoryId ? allTypes.filter(t => t.category_id === categoryId) : [];

  // Gérer prise de photo
  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newPhotos = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setPhotos([...photos, ...newPhotos]);
  }

  function removePhoto(index: number) {
    const newPhotos = [...photos];
    URL.revokeObjectURL(newPhotos[index].preview);
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  }

  function handleQuickCategory(cat: ApiCategory) {
    setCategoryId(cat.id);
    setTypeId('');                  // reset type quand on change de catégorie
    setCustomTypeLabel('');
    setShowOtherType(false);
    if (!title) {
      setTitle(`Dépense ${cat.label}`);
    }
  }

  function handleTypeChange(newTypeId: string) {
    setTypeId(newTypeId);
    setCustomTypeLabel('');
    setShowOtherType(false);
    if (newTypeId) {
      const t = allTypes.find(x => x.id === newTypeId);
      if (t && !title) setTitle(`${t.category_label} — ${t.label}`);
    }
  }

  function handleSelectOther() {
    setTypeId('');
    setShowOtherType(true);
  }

  async function handleSubmit() {
    if (amount <= 0) {
      alert('Veuillez saisir un montant');
      return;
    }
    if (!categoryId) {
      alert('Choisissez une catégorie');
      return;
    }

    const selectedCat = categories.find((c) => c.id === categoryId);

    try {
      setSaving(true);

      // 1. Créer la demande
      const customLabel = showOtherType ? customTypeLabel.trim() : '';
      const requestPayload = {
        title:
          title ||
          (customLabel
            ? `${selectedCat?.label ?? 'Dépense'} — ${customLabel}`
            : selectedCat
            ? `Dépense ${selectedCat.label}`
            : 'Demande de dépense'),
        description: description || 'Demande rapide depuis terrain',
        categoryId,
        expenseTypeId: typeId || undefined,
        customTypeLabel: customLabel || undefined,
        amount,
        urgency,
        neededByDate: neededByDate || undefined,
      };

      const response = await fetch('/api/expenses/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        throw new Error('Erreur création demande');
      }

      const result = await response.json();
      const requestId = result.data.ExpenseRequestId;

      // 2. Upload photos si présentes
      if (photos.length > 0) {
        const formData = new FormData();
        photos.forEach((photo, index) => {
          formData.append(`proof_${index}`, photo.file);
        });

        await fetch(`/api/expenses/requests/${requestId}/attachments`, {
          method: 'POST',
          body: formData,
        });
      }

      // 3. Soumettre automatiquement (pas de brouillon)
      await fetch(`/api/expenses/requests/${requestId}/submit`, {
        method: 'POST',
      });

      // Redirection vers la demande créée
      router.push(`/expenses/requests/${requestId}`);
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  }

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="w-7 h-7" />
              Sollicitation Rapide
            </h1>
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-white/20 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-sm opacity-90">Créez une demande en moins d'1 minute</p>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-6">
          {/* 1. MONTANT (champ libre, le plus important) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Montant demandé <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
              <input
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                placeholder="0"
                className="w-full pl-14 pr-12 h-20 text-center text-4xl font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
                min="0"
              />
              <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-2xl font-bold text-gray-400">
                F
              </span>
            </div>
          </div>

          {/* 2. CATÉGORIE — filtrée selon les rôles de l'utilisateur courant */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Catégorie <span className="text-red-600">*</span>
            </label>
            {loadingCategories ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement des catégories…
              </div>
            ) : categories.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                Aucune catégorie n'est accessible à ton rôle. Contacte l'administrateur.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {categories.map((cat) => {
                  const visual = CATEGORY_VISUALS[cat.code] || DEFAULT_VISUAL;
                  const selected = categoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleQuickCategory(cat)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        selected
                          ? `bg-gradient-to-br ${visual.gradient} text-white border-transparent`
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="text-3xl mb-2">{visual.icon}</div>
                      <p
                        className={`font-semibold text-sm leading-tight ${
                          selected ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        {cat.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2bis. TYPE — boutons usuels + "Autre…" pour saisie libre */}
          {categoryId && (typesForCategory.length > 0 || true) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Type
                <span className="text-xs text-gray-500 ml-2">(choisis un type usuel ou saisis le tien)</span>
              </label>

              {typesForCategory.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                  {typesForCategory.map((t) => {
                    const selected = typeId === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleTypeChange(t.id)}
                        className={`p-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                          selected
                            ? 'bg-red-600 text-white border-transparent shadow'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                  <button
                    onClick={handleSelectOther}
                    className={`p-3 rounded-xl border-2 border-dashed text-sm font-medium text-left transition-all ${
                      showOtherType
                        ? 'bg-amber-100 text-amber-900 border-amber-400'
                        : 'border-gray-300 text-gray-600 hover:border-amber-400 hover:bg-amber-50'
                    }`}
                  >
                    + Autre…
                  </button>
                </div>
              )}

              {typesForCategory.length === 0 && !showOtherType && (
                <button
                  onClick={handleSelectOther}
                  className="w-full p-3 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-600 hover:border-amber-400 hover:bg-amber-50"
                >
                  + Préciser un type
                </button>
              )}

              {showOtherType && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={customTypeLabel}
                    onChange={(e) => setCustomTypeLabel(e.target.value)}
                    placeholder="ex: Réparation pneu camion"
                    autoFocus
                    className="w-full h-12 px-4 border-2 border-amber-300 rounded-xl focus:outline-none focus:border-amber-500 text-sm"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Ce libellé sera classifié par l'administrateur (ou automatiquement) pour rattachement comptable.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 3. PHOTO (très important pour justification) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Photo(s) justificative(s)
            </label>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-3">
                {photos.map((photo, index) => (
                  <div key={index} className="relative">
                    <Image
                      src={photo.preview}
                      alt={`Photo ${index + 1}`}
                      width={200}
                      height={200}
                      className="w-full h-32 object-cover rounded-xl"
                    />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handlePhotoCapture}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-transform"
            >
              <Camera className="w-6 h-6" />
              {photos.length > 0 ? `Ajouter une photo (${photos.length})` : 'Prendre une photo'}
            </button>
          </div>

          {/* 4. URGENCE */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Urgence
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(urgencyConfig) as ExpenseUrgency[]).map((urg) => {
                const config = urgencyConfig[urg];
                return (
                  <button
                    key={urg}
                    onClick={() => setUrgency(urg)}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      urgency === urg
                        ? config.color.replace('bg-', 'border-')
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <p
                      className={`font-semibold text-sm ${
                        urgency === urg
                          ? config.color.split(' ')[1]
                          : 'text-gray-700'
                      }`}
                    >
                      {config.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. DATE NÉCESSAIRE (optionnel) */}
          {urgency !== 'low' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nécessaire avant le (optionnel)
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="date"
                  value={neededByDate}
                  onChange={(e) => setNeededByDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-4 h-12 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          )}

          {/* 6. DÉTAILS (optionnel) */}
          <details className="bg-gray-50 rounded-xl p-4">
            <summary className="cursor-pointer font-semibold text-gray-700 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Ajouter des détails (optionnel)
            </summary>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Dépense ${selectedCategory?.label || ''}`}
                  className="w-full h-12 px-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Détails supplémentaires..."
                  className="w-full h-24 p-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500 resize-none"
                />
              </div>
            </div>
          </details>

          {/* Résumé */}
          {amount > 0 && (
            <div className="bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <p className="font-semibold text-red-900">Résumé de la demande</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Montant:</span>
                  <span className="font-bold text-red-700">
                    {new Intl.NumberFormat('fr-FR').format(amount)} F
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-semibold">{selectedCategory?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Urgence:</span>
                  <span className={`font-semibold ${urgencyConfig[urgency].color.split(' ')[1]}`}>
                    {urgencyConfig[urgency].label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Photos:</span>
                  <span className="font-semibold">{photos.length} jointe(s)</span>
                </div>
              </div>
            </div>
          )}

          {/* Action */}
          <Button
            onClick={handleSubmit}
            disabled={amount <= 0 || saving}
            className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Check className="w-6 h-6 mr-2" />
                Soumettre la demande
              </>
            )}
          </Button>

          <p className="text-xs text-center text-gray-500">
            La demande sera automatiquement soumise pour approbation hiérarchique
          </p>
        </div>
      </div>
    </div>
  );
}
