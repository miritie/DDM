'use client';

/**
 * Composant - Formulaire Client Mobile (Optimisé Tactile)
 * Formulaire simplifié pour création rapide de clients sur le terrain
 */

import { useState } from 'react';
import { User, Building2, Phone, Mail, MapPin, Save, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CustomerType } from '@/types/modules';

interface CustomerFormMobileProps {
  onSubmit: (data: CustomerFormData) => Promise<void>;
  onCancel?: () => void;
  mode?: 'quick' | 'full';
  initialData?: Partial<CustomerFormData>;
}

export interface CustomerFormData {
  type: CustomerType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone: string;
  email?: string;
  city?: string;
  address?: string;
}

export function CustomerFormMobile({
  onSubmit,
  onCancel,
  mode = 'quick',
  initialData,
}: CustomerFormMobileProps) {
  const [customerType, setCustomerType] = useState<CustomerType>(
    initialData?.type || 'individual'
  );
  const [formData, setFormData] = useState<CustomerFormData>({
    type: customerType,
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    companyName: initialData?.companyName || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    city: initialData?.city || '',
    address: initialData?.address || '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.phone) {
      newErrors.phone = 'Le téléphone est obligatoire';
    }

    if (customerType === 'individual') {
      if (!formData.firstName && !formData.lastName) {
        newErrors.firstName = 'Le nom ou prénom est obligatoire';
      }
    } else {
      if (!formData.companyName) {
        newErrors.companyName = 'Le nom de l\'entreprise est obligatoire';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit({ ...formData, type: customerType });
    } catch (error) {
      console.error('Erreur création client:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof CustomerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sélection type de client */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Type de client</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setCustomerType('individual')}
            className={`
              p-4 rounded-xl border-2 transition-all
              ${
                customerType === 'individual'
                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                  : 'border-gray-200 bg-white text-gray-700'
              }
            `}
          >
            <User className="w-6 h-6 mx-auto mb-2" />
            <span className="font-medium">Particulier</span>
          </button>

          <button
            type="button"
            onClick={() => setCustomerType('business')}
            className={`
              p-4 rounded-xl border-2 transition-all
              ${
                customerType === 'business'
                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                  : 'border-gray-200 bg-white text-gray-700'
              }
            `}
          >
            <Building2 className="w-6 h-6 mx-auto mb-2" />
            <span className="font-medium">Entreprise</span>
          </button>
        </div>
      </div>

      {/* Champs selon type */}
      {customerType === 'individual' ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">Prénom</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => updateField('firstName', e.target.value)}
              placeholder="Jean"
              className={`h-12 text-base ${errors.firstName ? 'border-red-500' : ''}`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Nom</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => updateField('lastName', e.target.value)}
              placeholder="Dupont"
              className={`h-12 text-base ${errors.firstName ? 'border-red-500' : ''}`}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="companyName">
            Nom de l'entreprise <span className="text-red-500">*</span>
          </Label>
          <Input
            id="companyName"
            value={formData.companyName}
            onChange={(e) => updateField('companyName', e.target.value)}
            placeholder="ABC Company"
            className={`h-12 text-base ${errors.companyName ? 'border-red-500' : ''}`}
          />
          {errors.companyName && (
            <p className="text-sm text-red-500">{errors.companyName}</p>
          )}
        </div>
      )}

      {/* Téléphone (obligatoire) */}
      <div className="space-y-2">
        <Label htmlFor="phone">
          Téléphone <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="+225 07 XX XX XX XX"
            className={`h-12 text-base pl-11 ${errors.phone ? 'border-red-500' : ''}`}
          />
        </div>
        {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
      </div>

      {/* Champs optionnels en mode complet */}
      {mode === 'full' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="client@example.com"
                className="h-12 text-base pl-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="Abidjan"
                className="h-12 text-base pl-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="Cocody, Angré..."
              className="h-12 text-base"
            />
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 h-12 text-base"
            disabled={loading}
          >
            <X className="w-5 h-5 mr-2" />
            Annuler
          </Button>
        )}

        <Button
          type="submit"
          className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Création...</span>
            </div>
          ) : (
            <>
              <Save className="w-5 h-5 mr-2" />
              {mode === 'quick' ? 'Créer rapidement' : 'Enregistrer'}
            </>
          )}
        </Button>
      </div>

      {/* Note informative en mode rapide */}
      {mode === 'quick' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            💡 Vous pourrez compléter les informations plus tard dans la fiche client
          </p>
        </div>
      )}
    </form>
  );
}
