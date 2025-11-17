'use client';

/**
 * Page - QR Code Auto-Enregistrement Client
 * Le client scanne le QR et remplit lui-même ses infos
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  QrCode,
  Phone,
  User,
  Mail,
  MapPin,
  Gift,
  Check,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function QRRegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<'qr' | 'form' | 'success'>('qr');
  const [submitting, setSubmitting] = useState(false);

  // Données du stand/vendeur depuis l'URL
  const [standId, setStandId] = useState<string | null>(null);
  const [standName, setStandName] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);

  // Données client
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [receiveWhatsApp, setReceiveWhatsApp] = useState(true);

  useEffect(() => {
    // Récupérer les infos depuis l'URL
    const stand = searchParams.get('stand');
    const standNameParam = searchParams.get('standName');
    const agent = searchParams.get('agent');
    const agentNameParam = searchParams.get('agentName');

    if (stand) {
      setStandId(stand);
      setStandName(standNameParam);
      setAgentId(agent || null);
      setAgentName(agentNameParam || null);
      setStep('form'); // Passer directement au formulaire si QR scanné
    }
  }, [searchParams]);

  function generateQRCodeURL(): string {
    // URL que le client scannera
    const baseURL = window.location.origin;
    const params = new URLSearchParams({
      stand: standId || 'default',
      standName: standName || 'Stand DDM',
      agent: agentId || '',
      agentName: agentName || '',
    });

    return `${baseURL}/customers/qr-register?${params.toString()}`;
  }

  async function handleSubmit() {
    if (!phone) {
      alert('Le numéro de téléphone est obligatoire');
      return;
    }

    try {
      setSubmitting(true);

      const customerData = {
        phone: phone.replace(/\D/g, ''),
        firstName,
        lastName,
        email,
        city,
        receiveWhatsApp,
        standId,
        agentId,
        source: 'qr_self_registration',
      };

      const response = await fetch('/api/customers/qr-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'enregistrement');
      }

      // Succès
      setStep('success');
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  }

  // Vue: Affichage du QR Code (pour le vendeur)
  if (step === 'qr') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 pt-8">
            <div className="bg-purple-600 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <QrCode className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              QR Code Client
            </h1>
            <p className="text-gray-600">
              Le client scanne ce code pour s'enregistrer lui-même
            </p>
          </div>

          {/* QR Code */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6">
            <div className="bg-gray-100 rounded-2xl p-8 mb-6">
              {/* TODO: Intégrer une librairie QR Code comme qrcode.react */}
              <div className="aspect-square bg-white rounded-xl flex items-center justify-center border-4 border-purple-200">
                <div className="text-center">
                  <QrCode className="w-32 h-32 text-purple-600 mx-auto mb-4" />
                  <p className="text-sm text-gray-600">
                    QR Code généré ici
                  </p>
                  <p className="text-xs text-gray-500 mt-2 font-mono break-all px-4">
                    {generateQRCodeURL()}
                  </p>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-purple-100 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-600 font-bold">1</span>
                </div>
                <p className="text-gray-700 pt-1">
                  Demandez au client de scanner ce QR Code avec son téléphone
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-purple-100 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-600 font-bold">2</span>
                </div>
                <p className="text-gray-700 pt-1">
                  Il remplit ses informations (numéro de téléphone minimum)
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-purple-100 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-600 font-bold">3</span>
                </div>
                <p className="text-gray-700 pt-1">
                  Il reçoit automatiquement son bonus de bienvenue et un message WhatsApp
                </p>
              </div>
            </div>
          </div>

          {/* Avantages */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-600" />
              Avantages
            </h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                Pas besoin de saisir les infos vous-même
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                Le client contrôle les données qu'il partage
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                Inscription plus rapide et fluide
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                500 points de bienvenue automatiques
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Vue: Formulaire d'inscription (pour le client)
  if (step === 'form') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4 pb-20">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 pt-8">
            <div className="bg-purple-600 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <User className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Bienvenue !
            </h1>
            <p className="text-gray-600">
              Enregistrez-vous et recevez <span className="font-bold text-purple-600">500 points</span> de bienvenue
            </p>
            {standName && (
              <p className="text-sm text-gray-500 mt-2">
                📍 {standName}
                {agentName && ` • ${agentName}`}
              </p>
            )}
          </div>

          {/* Formulaire */}
          <div className="space-y-4">
            {/* Téléphone - OBLIGATOIRE */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Phone className="w-5 h-5 text-purple-600" />
                <label className="font-bold text-gray-900">
                  Numéro de téléphone <span className="text-red-600">*</span>
                </label>
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+225 01 23 45 67 89"
                required
                autoFocus
                className="w-full h-14 px-4 text-lg border-2 border-purple-600 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-300"
              />
            </div>

            {/* Nom et Prénom */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-5 h-5 text-gray-600" />
                <label className="font-bold text-gray-900">Nom complet (optionnel)</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Prénom"
                  className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Nom"
                  className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Email et Ville */}
            <div className="bg-white rounded-2xl shadow-xl p-6 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-5 h-5 text-gray-600" />
                  <label className="font-medium text-gray-900">Email (optionnel)</label>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemple@email.com"
                  className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-gray-600" />
                  <label className="font-medium text-gray-900">Ville (optionnel)</label>
                </div>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Abidjan"
                  className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Préférences */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="font-bold text-gray-900 mb-3">Préférences de contact</h3>
              <div
                onClick={() => setReceiveWhatsApp(!receiveWhatsApp)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                  receiveWhatsApp
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className={`w-5 h-5 ${receiveWhatsApp ? 'text-green-600' : 'text-gray-400'}`} />
                    <div>
                      <p className="font-medium text-gray-900">Recevoir les promotions par WhatsApp</p>
                      <p className="text-xs text-gray-600">Offres exclusives et nouveautés</p>
                    </div>
                  </div>
                  {receiveWhatsApp && <Check className="w-5 h-5 text-green-600" />}
                </div>
              </div>
            </div>

            {/* Cadeau */}
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-xl p-6 text-white">
              <div className="flex items-center gap-3 mb-3">
                <Gift className="w-8 h-8" />
                <div>
                  <h3 className="font-bold text-lg">Cadeau de bienvenue</h3>
                  <p className="text-sm opacity-90">500 points offerts</p>
                </div>
              </div>
              <p className="text-sm opacity-90">
                Utilisez vos points pour obtenir des réductions sur vos prochains achats !
              </p>
            </div>

            {/* Bouton de validation */}
            <Button
              onClick={handleSubmit}
              disabled={!phone || submitting}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-16 text-xl font-bold"
            >
              {submitting ? (
                'Enregistrement...'
              ) : (
                <>
                  <Check className="w-6 h-6 mr-2" />
                  M'enregistrer
                </>
              )}
            </Button>

            {/* Disclaimer */}
            <p className="text-xs text-center text-gray-500 px-4">
              En vous inscrivant, vous acceptez de recevoir des communications de notre part.
              Vos données sont protégées et ne seront jamais partagées.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Vue: Succès
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="bg-green-500 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          <Check className="w-16 h-16 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Merci !</h1>
        <p className="text-xl text-gray-700 mb-6">
          Vous êtes maintenant enregistré
        </p>

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Gift className="w-8 h-8 text-purple-600" />
            <div className="text-left">
              <p className="font-bold text-2xl text-purple-600">500 points</p>
              <p className="text-sm text-gray-600">ajoutés à votre compte</p>
            </div>
          </div>

          {receiveWhatsApp && (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3">
              <p className="text-sm text-green-800">
                ✅ Vous allez recevoir un message WhatsApp de confirmation
              </p>
            </div>
          )}
        </div>

        <p className="text-gray-600">
          À bientôt ! 👋
        </p>
      </div>
    </div>
  );
}
