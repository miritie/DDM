'use client';

/**
 * Page - Dashboard RH (Mobile-First)
 * Module Ressources Humaines
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Clock,
  DollarSign,
  Calendar,
  TrendingUp,
  Zap,
  MapPin,
  FileText,
  LogIn,
  LogOut,
  Navigation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HRStatistics {
  totalEmployees: number;
  presentToday: number;
  onLeave: number;
  pendingApprovals: number;
  transportsPending: number;
  transportsAmount: number;
  thisMonthPayroll: number;
}

export default function HRDashboardPage() {
  const router = useRouter();
  const [statistics, setStatistics] = useState<HRStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentAttendance, setCurrentAttendance] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadData();
    loadTodayAttendance();

    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const response = await fetch('/api/hr/statistics');

      if (response.ok) {
        const data = await response.json();
        setStatistics(data.data);
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTodayAttendance() {
    try {
      const response = await fetch('/api/hr/attendance/my-today');
      if (response.ok) {
        const data = await response.json();
        setCurrentAttendance(data.data);
      }
    } catch (error) {
      console.error('Erreur chargement présence:', error);
    }
  }

  const [punching, setPunching] = useState(false);
  const [punchMsg, setPunchMsg] = useState<string | null>(null);
  async function punch(action: 'check-in' | 'check-out') {
    setPunching(true);
    setPunchMsg(null);
    try {
      const r = await fetch('/api/hr/attendance/my-today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || 'Échec du pointage');
      setCurrentAttendance(body.data);
      setPunchMsg(action === 'check-in' ? '✅ Arrivée pointée' : '✅ Sortie pointée');
    } catch (e: any) {
      setPunchMsg(`❌ ${e.message}`);
    } finally {
      setPunching(false);
    }
  }

  const canCheckOut = currentAttendance && !currentAttendance.CheckOutTime;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
            <Users className="w-7 h-7" />
            Ressources Humaines
          </h1>
          <p className="text-sm opacity-90">
            {currentTime.toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <p className="text-4xl font-bold mt-2">
            {currentTime.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 -mt-4 space-y-4">
        {/* Présence : commerciaux automatiques (POS), pointage manuel pour les autres */}
        <div className="bg-white rounded-2xl shadow-xl p-5">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Présence des commerciaux : automatique</p>
              <p className="text-sm text-gray-600 mt-0.5">
                Gérée par le POS — ouverture de caisse = arrivée, clôture = départ,
                prime de transport versée à la clôture. Aucun pointage manuel à faire.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/hr/attendance')}
                >
                  Voir les présences du jour
                </Button>
                {currentAttendance && canCheckOut ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={punching}
                    onClick={() => punch('check-out')}
                    className="text-emerald-700 border-emerald-300"
                  >
                    <LogOut className="w-4 h-4 mr-1" /> Pointer ma sortie (non commercial)
                  </Button>
                ) : !currentAttendance && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={punching}
                    onClick={() => punch('check-in')}
                    className="text-emerald-700 border-emerald-300"
                  >
                    <LogIn className="w-4 h-4 mr-1" /> Pointer mon arrivée (non commercial)
                  </Button>
                )}
              </div>
              {punchMsg && <p className="text-sm mt-2">{punchMsg}</p>}
            </div>
          </div>
        </div>

        {/* KPIs */}
        {statistics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-600">Employés</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{statistics.totalEmployees}</p>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-600">Présents</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{statistics.presentToday}</p>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-5 h-5 text-orange-600" />
                <span className="text-sm text-gray-600">En Congé</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{statistics.onLeave}</p>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-5 h-5 text-purple-600" />
                <span className="text-sm text-gray-600">Paie Mois</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(
                  statistics.thisMonthPayroll
                )} F
              </p>
            </div>
          </div>
        )}

        {/* Actions Rapides */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-bold text-lg mb-4">Actions Rapides</h2>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/hr/attendance')}
              className="bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-xl p-4 text-left transition-colors"
            >
              <Clock className="w-6 h-6 text-blue-600 mb-2" />
              <p className="font-semibold text-gray-900 text-sm">Présences</p>
            </button>

            <button
              onClick={() => router.push('/hr/leaves')}
              className="bg-purple-50 hover:bg-purple-100 border-2 border-purple-200 rounded-xl p-4 text-left transition-colors"
            >
              <Calendar className="w-6 h-6 text-purple-600 mb-2" />
              <p className="font-semibold text-gray-900 text-sm">Congés</p>
            </button>

            <button
              onClick={() => router.push('/hr/payroll/settings')}
              className="bg-orange-50 hover:bg-orange-100 border-2 border-orange-200 rounded-xl p-4 text-left transition-colors"
            >
              <Navigation className="w-6 h-6 text-orange-600 mb-2" />
              <p className="font-semibold text-gray-900 text-sm">Primes</p>
              <p className="text-xs text-gray-500">transport & vente</p>
            </button>

            <button
              onClick={() => router.push('/hr/payroll')}
              className="bg-green-50 hover:bg-green-100 border-2 border-green-200 rounded-xl p-4 text-left transition-colors"
            >
              <DollarSign className="w-6 h-6 text-green-600 mb-2" />
              <p className="font-semibold text-gray-900 text-sm">Paie</p>
            </button>

            <button
              onClick={() => router.push('/hr/employees')}
              className="bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 rounded-xl p-4 text-left transition-colors"
            >
              <Users className="w-6 h-6 text-gray-600 mb-2" />
              <p className="font-semibold text-gray-900 text-sm">Employés</p>
            </button>

            <button
              onClick={() => router.push('/hr/payroll/charges')}
              className="bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-200 rounded-xl p-4 text-left transition-colors"
            >
              <TrendingUp className="w-6 h-6 text-indigo-600 mb-2" />
              <p className="font-semibold text-gray-900 text-sm">Charges sociales</p>
              <p className="text-xs text-gray-500">CNPS · DGI · FDFP</p>
            </button>
          </div>
        </div>

        {/* Informations */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-800">Comment ça marche</p>
              <p className="text-sm text-blue-700 mt-1">
                Commerciaux : présence et primes (transport + vente) gérées automatiquement
                par la caisse — la clôture de caisse verse les primes en espèces.
                Bulletins mensuels : Paie → Générer Paies du Mois, après mise à jour des
                fiches employés (état civil, CNPS, catégorie).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
