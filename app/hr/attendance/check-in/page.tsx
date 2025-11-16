/**
 * Page - Pointage d'Arrivée Géolocalisé (Mobile-First)
 * Module RH - Check-in avec photo et géolocalisation
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Camera,
  Check,
  AlertTriangle,
  Clock,
  Navigation,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
}

interface SelectedLocation {
  LocationId: string;
  LocationName: string;
}

export default function CheckInPage() {
  const router = useRouter();
  const [step, setStep] = useState<'location' | 'photo' | 'details' | 'confirm'>('location');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Données de pointage
  const [location, setLocation] = useState<Location | null>(null);
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [notes, setNotes] = useState('');

  // Liste des lieux de travail
  const [workLocations, setWorkLocations] = useState<SelectedLocation[]>([]);

  // Transport
  const [needsTransport, setNeedsTransport] = useState(false);
  const [transportType, setTransportType] = useState<'stand_visit' | 'client_visit' | 'delivery' | 'meeting'>('stand_visit');

  useEffect(() => {
    loadWorkLocations();
    requestGeolocation();
  }, []);

  async function loadWorkLocations() {
    try {
      // TODO: Charger les lieux de travail (stands, entrepôts, etc.)
      // Pour l'instant, données fictives
      setWorkLocations([
        { LocationId: '1', LocationName: 'Stand Marché Central' },
        { LocationId: '2', LocationName: 'Stand Plateau' },
        { LocationId: '3', LocationName: 'Entrepôt Principal' },
        { LocationId: '4', LocationName: 'Usine de Production' },
        { LocationId: '5', LocationName: 'Autre (déplacement terrain)' },
      ]);
    } catch (error) {
      console.error('Erreur chargement lieux:', error);
    }
  }

  function requestGeolocation() {
    setLoading(true);

    if (!navigator.geolocation) {
      alert('La géolocalisation n\'est pas supportée par votre navigateur');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const loc: Location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        // Récupérer l'adresse via reverse geocoding (optionnel)
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${loc.latitude}&lon=${loc.longitude}&format=json`
          );
          if (response.ok) {
            const data = await response.json();
            loc.address = data.display_name;
          }
        } catch (error) {
          console.log('Pas d\'adresse récupérée');
        }

        setLocation(loc);
        setLoading(false);
      },
      (error) => {
        console.error('Erreur géolocalisation:', error);
        alert('Impossible d\'obtenir votre position. Veuillez activer la localisation.');
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  function handlePhotoCapture(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      const preview = URL.createObjectURL(file);
      setPhoto({ file, preview });
    }
  }

  async function handleSubmit() {
    if (!location) {
      alert('Position GPS requise');
      return;
    }
    if (!photo) {
      alert('Photo requise');
      return;
    }
    if (!selectedLocation) {
      alert('Lieu de travail requis');
      return;
    }

    try {
      setSubmitting(true);

      // 1. Créer le pointage
      const checkInData = {
        checkInTime: new Date().toISOString(),
        checkInLatitude: location.latitude,
        checkInLongitude: location.longitude,
        checkInLocation: location.address,
        locationId: selectedLocation.LocationId,
        locationName: selectedLocation.LocationName,
        notes,
      };

      const checkInResponse = await fetch('/api/hr/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkInData),
      });

      if (!checkInResponse.ok) {
        throw new Error('Erreur lors du pointage');
      }

      const checkInResult = await checkInResponse.json();
      const attendanceId = checkInResult.data.AttendanceId;

      // 2. Upload photo
      const formData = new FormData();
      formData.append('photo', photo.file);

      await fetch(`/api/hr/attendance/${attendanceId}/photo/checkin`, {
        method: 'POST',
        body: formData,
      });

      // 3. Si transport demandé, créer l'indemnité
      if (needsTransport) {
        await fetch('/api/hr/transport-allowances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attendanceId,
            transportType,
            workDate: new Date().toISOString().split('T')[0],
            locationId: selectedLocation.LocationId,
            locationName: selectedLocation.LocationName,
          }),
        });
      }

      // Succès
      alert('✅ Pointage enregistré avec succès !');
      router.push('/hr/attendance');
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de l\'enregistrement du pointage');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-7 h-7" />
            Pointage d'Arrivée
          </h1>
          <p className="text-sm opacity-90 mt-1">
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <p className="text-3xl font-bold mt-2">
            {new Date().toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 -mt-4 space-y-4">
        {/* Étape 1: Géolocalisation */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Localisation GPS
            </h2>
            {location && <Check className="w-6 h-6 text-green-600" />}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="text-gray-600">Récupération de votre position...</p>
              </div>
            </div>
          ) : location ? (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
              <p className="font-semibold text-green-800 mb-2">Position obtenue ✓</p>
              <p className="text-sm text-gray-700">
                📍 {location.address || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Précision: {Math.round(location.accuracy)}m
              </p>
            </div>
          ) : (
            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
              <p className="text-orange-800 mb-3">Position GPS non disponible</p>
              <Button
                onClick={requestGeolocation}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Navigation className="w-5 h-5 mr-2" />
                Activer la localisation
              </Button>
            </div>
          )}
        </div>

        {/* Étape 2: Photo */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" />
              Photo de pointage
            </h2>
            {photo && <Check className="w-6 h-6 text-green-600" />}
          </div>

          {photo ? (
            <div className="space-y-3">
              <img
                src={photo.preview}
                alt="Photo"
                className="w-full h-64 object-cover rounded-xl border-2 border-green-200"
              />
              <Button
                onClick={() => setPhoto(null)}
                variant="outline"
                className="w-full"
              >
                Reprendre la photo
              </Button>
            </div>
          ) : (
            <div className="bg-gray-50 border-2 border-gray-200 border-dashed rounded-xl p-6 text-center">
              <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">Prenez une photo pour votre pointage</p>
              <label className="inline-block">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoCapture}
                  className="hidden"
                />
                <span className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl cursor-pointer">
                  <Camera className="w-5 h-5 mr-2" />
                  Prendre une photo
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Étape 3: Lieu de travail */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-bold text-lg mb-4">Lieu de travail</h2>

          <div className="space-y-2">
            {workLocations.map((loc) => (
              <button
                key={loc.LocationId}
                onClick={() => setSelectedLocation(loc)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                  selectedLocation?.LocationId === loc.LocationId
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{loc.LocationName}</span>
                  {selectedLocation?.LocationId === loc.LocationId && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Transport */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-600" />
            Indemnité de Transport
          </h2>

          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-orange-800 font-medium">
              💰 2000 F CFA par jour de déplacement
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="transport"
                checked={needsTransport}
                onChange={(e) => setNeedsTransport(e.target.checked)}
                className="w-6 h-6 rounded border-gray-300"
              />
              <label htmlFor="transport" className="font-medium text-gray-900 cursor-pointer">
                Demander l'indemnité de transport
              </label>
            </div>

            {needsTransport && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de déplacement
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'stand_visit', label: 'Visite Stand' },
                    { value: 'client_visit', label: 'Visite Client' },
                    { value: 'delivery', label: 'Livraison' },
                    { value: 'meeting', label: 'Réunion' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setTransportType(type.value as any)}
                      className={`p-3 rounded-lg font-medium transition-colors ${
                        transportType === type.value
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-bold text-lg mb-4">Notes (optionnel)</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ajoutez des remarques si nécessaire..."
            className="w-full h-24 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        {/* Résumé et validation */}
        {location && photo && selectedLocation && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="font-bold text-lg mb-4">Résumé</h2>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-green-600">
                <Check className="w-5 h-5" />
                <span className="font-medium">Position GPS enregistrée</span>
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <Check className="w-5 h-5" />
                <span className="font-medium">Photo capturée</span>
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <Check className="w-5 h-5" />
                <span className="font-medium">{selectedLocation.LocationName}</span>
              </div>
              {needsTransport && (
                <div className="flex items-center gap-2 text-orange-600">
                  <Zap className="w-5 h-5" />
                  <span className="font-medium">Transport: 2000 F CFA</span>
                </div>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 h-16 text-lg font-bold"
            >
              {submitting ? (
                'Enregistrement...'
              ) : (
                <>
                  <Check className="w-6 h-6 mr-2" />
                  Valider mon arrivée
                </>
              )}
            </Button>
          </div>
        )}

        {/* Avertissements */}
        {(!location || !photo || !selectedLocation) && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-800">Action requise</p>
                <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                  {!location && <li>• Activez la géolocalisation</li>}
                  {!photo && <li>• Prenez une photo</li>}
                  {!selectedLocation && <li>• Sélectionnez un lieu de travail</li>}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
