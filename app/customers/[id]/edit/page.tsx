'use client';

/**
 * Page - Édition Client (Mobile-First)
 * Modification des informations client
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Customer } from '@/types/modules';
import { CustomerFormMobile, CustomerFormData } from '@/components/customers/customer-form-mobile';
import { Button } from '@/components/ui/button';

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCustomer();
  }, [customerId]);

  const loadCustomer = async () => {
    try {
      const response = await fetch(`/api/customers/${customerId}`);
      if (response.ok) {
        const data = await response.json();
        setCustomer(data.data);
      }
    } catch (error) {
      console.error('Erreur chargement client:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: CustomerFormData) => {
    setUpdating(true);
    setError(null);

    try {
      // Construire le fullName selon le type
      const fullName =
        data.type === 'individual'
          ? `${data.firstName || ''} ${data.lastName || ''}`.trim()
          : data.companyName || '';

      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          fullName,
        }),
      });

      if (response.ok) {
        router.push(`/customers/${customerId}`);
      } else {
        const result = await response.json();
        setError(result.error || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      console.error('Erreur mise à jour client:', err);
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Client non trouvé</p>
          <Button onClick={() => router.push('/customers')} className="mt-4">
            Retour à la liste
          </Button>
        </div>
      </div>
    );
  }

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

          <h1 className="text-2xl font-bold">Modifier le Client</h1>
          <p className="text-sm opacity-90 mt-1">{customer.FullName}</p>
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
            initialData={{
              type: customer.Type,
              firstName: customer.FirstName,
              lastName: customer.LastName,
              companyName: customer.CompanyName,
              phone: customer.Phone,
              email: customer.Email,
              city: customer.City,
              address: customer.Address,
            }}
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
          />
        </div>
      </div>
    </div>
  );
}
