'use client';

/**
 * Page - Sollicitation ULTRA-Rapide (Mobile-First)
 * Interface optimisée pour créer une demande de dépense en < 1 minute
 * Accessible depuis partout: stands, terrain, usine, etc.
 */

import { useState, useRef } from 'react';
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
} from 'lucide-react';
import { ExpenseCategory, ExpenseSubcategory, ExpenseUrgency } from '@/types/modules';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

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

const quickCategories = [
  {
    category: 'fonctionnelle' as unknown as ExpenseCategory,
    subcategory: 'transport' as unknown as ExpenseSubcategory,
    label: 'Transport',
    icon: '🚗',
    gradient: 'from-blue-500 to-cyan-600',
  },
  {
    category: 'fonctionnelle' as unknown as ExpenseCategory,
    subcategory: 'communication' as unknown as ExpenseSubcategory,
    label: 'Communication',
    icon: '📱',
    gradient: 'from-purple-500 to-pink-600',
  },
  {
    category: 'fonctionnelle' as unknown as ExpenseCategory,
    subcategory: 'fourniture' as unknown as ExpenseSubcategory,
    label: 'Fourniture',
    icon: '📦',
    gradient: 'from-green-500 to-emerald-600',
  },
  {
    category: 'fonctionnelle' as unknown as ExpenseCategory,
    subcategory: 'maintenance' as unknown as ExpenseSubcategory,
    label: 'Maintenance',
    icon: '🔧',
    gradient: 'from-orange-500 to-red-600',
  },
  {
    category: 'structurelle' as unknown as ExpenseCategory,
    subcategory: 'equipement' as unknown as ExpenseSubcategory,
    label: 'Équipement',
    icon: '⚙️',
    gradient: 'from-indigo-500 to-purple-600',
  },
  {
    category: 'fonctionnelle' as unknown as ExpenseCategory,
    subcategory: 'autres_charges' as unknown as ExpenseSubcategory,
    label: 'Autre',
    icon: '💼',
    gradient: 'from-gray-500 to-gray-700',
  },
];

export default function QuickExpenseRequestPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state (minimal pour rapidité)
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState<ExpenseCategory>('fonctionnelle' as unknown as ExpenseCategory);
  const [subcategory, setSubcategory] = useState<ExpenseSubcategory>('transport' as unknown as ExpenseSubcategory);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<ExpenseUrgency>('normal');
  const [photos, setPhotos] = useState<Array<{ file: File; preview: string }>>([]);
  const [neededByDate, setNeededByDate] = useState('');

  const [saving, setSaving] = useState(false);

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

  function handleQuickCategory(cat: typeof quickCategories[0]) {
    setCategory(cat.category);
    setSubcategory(cat.subcategory);
    if (!title) {
      setTitle(`Dépense ${cat.label}`);
    }
  }

  async function handleSubmit() {
    if (amount <= 0) {
      alert('Veuillez saisir un montant');
      return;
    }

    try {
      setSaving(true);

      // 1. Créer la demande
      const requestPayload = {
        title: title || `Dépense ${subcategory}`,
        description: description || 'Demande rapide depuis terrain',
        category,
        subcategory,
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

  const selectedQuickCategory = quickCategories.find(
    (c) => c.subcategory === subcategory
  );

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
          {/* 1. MONTANT (le plus important) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Montant demandé <span className="text-red-600">*</span>
            </label>
            <div className="flex gap-2 mb-3">
              {[1000, 2500, 5000, 10000, 25000, 50000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt)}
                  className={`flex-1 h-12 rounded-xl font-bold transition-colors ${
                    amount === amt
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(amt)}
                </button>
              ))}
            </div>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
              <input
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                placeholder="0"
                className="w-full pl-14 pr-4 h-20 text-center text-4xl font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
                min="0"
              />
              <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-2xl font-bold text-gray-400">
                F
              </span>
            </div>
          </div>

          {/* 2. CATÉGORIE RAPIDE */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Type de dépense <span className="text-red-600">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {quickCategories.map((cat) => (
                <button
                  key={cat.subcategory}
                  onClick={() => handleQuickCategory(cat)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    subcategory === cat.subcategory
                      ? `bg-gradient-to-br ${cat.gradient} text-white border-transparent`
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-3xl mb-2">{cat.icon}</div>
                  <p
                    className={`font-semibold text-sm ${
                      subcategory === cat.subcategory ? 'text-white' : 'text-gray-700'
                    }`}
                  >
                    {cat.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

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
                  placeholder={`Dépense ${selectedQuickCategory?.label || ''}`}
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
                  <span className="font-semibold">{selectedQuickCategory?.label}</span>
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
