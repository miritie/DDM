'use client';

/**
 * Page - Création Client (Mobile-First)
 * Formulaire complet optimisé mobile
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { CustomerFormMobile, CustomerFormData } from '@/components/customers/customer-form-mobile';
import { Button } from '@/components/ui/button';

export default function NewCustomerPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: CustomerFormData) => {
    setCreating(true);
    setError(null);

    try {
      // Construire le fullName selon le type
      const fullName =
        data.type === 'individual'
          ? `${data.firstName || ''} ${data.lastName || ''}`.trim()
          : data.companyName || '';

      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          fullName,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        router.push(`/customers/${result.data.CustomerId}`);
      } else {
        const result = await response.json();
        setError(result.error || 'Erreur lors de la création');
      }
    } catch (err) {
      console.error('Erreur création client:', err);
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 mb-4 hover:opacity-80"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Retour</span>
          </button>

          <h1 className="text-2xl font-bold">Nouveau Client</h1>
          <p className="text-sm opacity-90 mt-1">
            Créez une fiche client pour démarrer la fidélisation
          </p>
        </div>
      </div>

      {/* Formulaire */}
      <div className="max-w-3xl mx-auto px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              {error}
            </div>
          )}

          <CustomerFormMobile
            mode="full"
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
          />
        </div>
      </div>
    </div>
  );
}
