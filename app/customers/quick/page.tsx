'use client';

/**
 * Page - Ajout Client ULTRA-Rapide (Mobile-First)
 * Objectif: Capturer un client en < 5 secondes avec juste son numéro
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Phone,
  Check,
  Zap,
  QrCode,
  User,
  Gift,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function QuickAddCustomerPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'confirm' | 'success'>('phone');
  const [submitting, setSubmitting] = useState(false);

  // Données client
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  // Options rapides
  const [sendWelcomeWhatsApp, setSendWelcomeWhatsApp] = useState(true);
  const [giveWelcomeBonus, setGiveWelcomeBonus] = useState(true);

  function formatPhoneNumber(value: string): string {
    // Supprimer tout sauf les chiffres
    const digits = value.replace(/\D/g, '');

    // Format: +225 XX XX XX XX XX
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
  }

  function handlePhoneChange(value: string) {
    const formatted = formatPhoneNumber(value);
    setPhone(formatted);
  }

  function isPhoneValid(): boolean {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10; // Au moins 10 chiffres
  }

  async function handleSubmit() {
    if (!isPhoneValid()) {
      alert('Numéro de téléphone invalide');
      return;
    }

    try {
      setSubmitting(true);

      // 1. Créer le client
      const customerData = {
        phone: phone.replace(/\D/g, ''), // Chiffres seulement
        fullName: name || `Client ${phone}`,
        sendWelcomeWhatsApp,
        giveWelcomeBonus,
      };

      const response = await fetch('/api/customers/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la création');
      }

      const result = await response.json();
      const customerId = result.data.CustomerId;

      // 2. Si WhatsApp activé, envoyer message de bienvenue
      if (sendWelcomeWhatsApp) {
        await fetch('/api/whatsapp/send-welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phone.replace(/\D/g, ''),
            customerName: name || 'Cher client',
          }),
        });
      }

      // Succès
      setStep('success');

      // Redirection après 2 secondes
      setTimeout(() => {
        router.push(`/customers/${customerId}`);
      }, 2000);
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de l\'ajout du client');
    } finally {
      setSubmitting(false);
    }
  }

  function handleQuickCapture() {
    // Suggestion: Capturer depuis un paiement
    // Par exemple, scanner un QR code de paiement qui contient le numéro
    alert('Cette fonction permettra de capturer le numéro depuis un paiement');
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="bg-green-500 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <Check className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Client ajouté !</h1>
          <p className="text-gray-600 mb-4">
            {sendWelcomeWhatsApp && (
              <>✅ Message WhatsApp envoyé<br /></>
            )}
            {giveWelcomeBonus && (
              <>🎁 Bonus de bienvenue accordé</>
            )}
          </p>
          <p className="text-sm text-gray-500">Redirection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
            <Zap className="w-7 h-7" />
            Client Rapide
          </h1>
          <p className="text-sm opacity-90">Ajoutez un client en moins de 5 secondes</p>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 -mt-4 space-y-4">
        {/* Numéro de téléphone - PRIORITAIRE */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Phone className="w-6 h-6 text-purple-600" />
            <h2 className="font-bold text-lg">Numéro de téléphone</h2>
          </div>

          <div className="mb-4">
            <input
              type="tel"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="+225 XX XX XX XX XX"
              autoFocus
              className="w-full h-20 px-6 text-4xl font-bold text-center border-4 border-purple-600 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-300"
            />
            <p className="text-sm text-gray-600 text-center mt-2">
              Format: +225 01 23 45 67 89
            </p>
          </div>

          {/* Boutons rapides de préfixe */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Opérateur:</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { prefix: '225 01', label: 'Orange', color: 'bg-orange-500' },
                { prefix: '225 05', label: 'MTN', color: 'bg-yellow-500' },
                { prefix: '225 07', label: 'Moov', color: 'bg-blue-500' },
                { prefix: '225 27', label: 'Fixe', color: 'bg-gray-500' },
              ].map((op) => (
                <button
                  key={op.prefix}
                  onClick={() => setPhone(op.prefix + ' ')}
                  className={`${op.color} text-white font-bold py-3 rounded-lg text-xs`}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {/* Validation */}
          {isPhoneValid() && (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              <span className="text-green-800 font-medium">Numéro valide ✓</span>
            </div>
          )}
        </div>

        {/* Nom (optionnel) */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-gray-600" />
              <h2 className="font-bold text-lg">Nom (optionnel)</h2>
            </div>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              Facultatif
            </span>
          </div>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Jean Dupont"
            className="w-full h-14 px-4 text-lg border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Options automatiques */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-bold text-lg mb-4">Actions automatiques</h2>

          <div className="space-y-3">
            {/* WhatsApp */}
            <div
              onClick={() => setSendWelcomeWhatsApp(!sendWelcomeWhatsApp)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                sendWelcomeWhatsApp
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className={`w-6 h-6 ${sendWelcomeWhatsApp ? 'text-green-600' : 'text-gray-400'}`} />
                  <div>
                    <p className="font-semibold text-gray-900">Message WhatsApp</p>
                    <p className="text-xs text-gray-600">Envoyer un message de bienvenue</p>
                  </div>
                </div>
                {sendWelcomeWhatsApp && <Check className="w-5 h-5 text-green-600" />}
              </div>
            </div>

            {/* Bonus */}
            <div
              onClick={() => setGiveWelcomeBonus(!giveWelcomeBonus)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                giveWelcomeBonus
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Gift className={`w-6 h-6 ${giveWelcomeBonus ? 'text-purple-600' : 'text-gray-400'}`} />
                  <div>
                    <p className="font-semibold text-gray-900">Bonus de bienvenue</p>
                    <p className="text-xs text-gray-600">500 points offerts</p>
                  </div>
                </div>
                {giveWelcomeBonus && <Check className="w-5 h-5 text-purple-600" />}
              </div>
            </div>
          </div>
        </div>

        {/* Autres moyens de capture */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-purple-200 rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-purple-600" />
            Autres moyens de capture
          </h2>

          <div className="space-y-3">
            <button
              onClick={() => router.push('/customers/qr-scan')}
              className="w-full bg-white border-2 border-purple-200 rounded-xl p-4 text-left hover:border-purple-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <QrCode className="w-6 h-6 text-purple-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Scanner QR Code</p>
                    <p className="text-xs text-gray-600">Le client scanne son propre code</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>

            <button
              onClick={handleQuickCapture}
              className="w-full bg-white border-2 border-blue-200 rounded-xl p-4 text-left hover:border-blue-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Phone className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Depuis paiement</p>
                    <p className="text-xs text-gray-600">Capturer lors d'un paiement mobile</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>
          </div>
        </div>

        {/* Résumé et validation */}
        {isPhoneValid() && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="font-bold text-lg mb-4">Récapitulatif</h2>

            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                <span className="font-medium">📞 {phone}</span>
              </div>
              {name && (
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="font-medium">👤 {name}</span>
                </div>
              )}
              {sendWelcomeWhatsApp && (
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-gray-700">Message WhatsApp</span>
                </div>
              )}
              {giveWelcomeBonus && (
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-purple-600" />
                  <span className="text-sm text-gray-700">500 points bonus</span>
                </div>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-16 text-xl font-bold"
            >
              {submitting ? (
                'Ajout en cours...'
              ) : (
                <>
                  <Zap className="w-6 h-6 mr-2" />
                  Ajouter le Client
                </>
              )}
            </Button>
          </div>
        )}

        {/* Aide */}
        <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4">
          <p className="text-sm text-purple-800 font-medium mb-1">💡 Astuce</p>
          <p className="text-xs text-purple-700">
            Vous pouvez simplement saisir le numéro pendant que le client paie.
            Le message WhatsApp et les points seront automatiquement envoyés.
          </p>
        </div>
      </div>
    </div>
  );
}
