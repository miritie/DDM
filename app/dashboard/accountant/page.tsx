/**
 * Dashboard Comptable
 * Vue financière: trésorerie, dépenses, paie, rapports
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  CreditCard,
  FileText,
  Calculator,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Receipt,
  Users,
  Calendar,
  Download,
  RefreshCw,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/auth/logout-button';

interface AccountantDashboardData {
  treasury: {
    totalBalance: number;
    cashBalance: number;
    bankBalance: number;
    mobileMoneyBalance: number;
  };
  expenses: {
    today: number;
    week: number;
    month: number;
    pendingApproval: number;
  };
  payroll: {
    totalEmployees: number;
    totalSalaries: number;
    pendingAdvances: number;
    nextPayrollDate: string;
  };
  sales: {
    revenue: number;
    receivables: number;
    collected: number;
  };
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    link?: string;
  }>;
}

export default function AccountantDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AccountantDashboardData | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('month');

  useEffect(() => {
    loadDashboard();
  }, [period]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard/accountant?period=${period}`);
      const result = await response.json();

      if (response.ok) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white p-6 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-3xl font-bold">Dashboard Comptable</h1>
            <p className="text-sm opacity-90">Finance & Trésorerie</p>
          </div>
          <div className="flex items-center gap-2">
            <LogoutButton
              variant="ghost"
              size="sm"
              showText={false}
              className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 text-white"
            />
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
            >
              <RefreshCw className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filtres période */}
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('today')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all ${
              period === 'today' ? 'bg-white text-emerald-600' : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all ${
              period === 'week' ? 'bg-white text-emerald-600' : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            7 jours
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all ${
              period === 'month' ? 'bg-white text-emerald-600' : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            30 jours
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Alertes */}
        {data?.alerts && data.alerts.length > 0 && (
          <div className="space-y-2">
            {data.alerts.map((alert, idx) => (
              <Card
                key={idx}
                className={`border-2 ${
                  alert.type === 'error'
                    ? 'border-red-200 bg-red-50'
                    : alert.type === 'warning'
                    ? 'border-orange-200 bg-orange-50'
                    : 'border-blue-200 bg-blue-50'
                }`}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertCircle
                    className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      alert.type === 'error'
                        ? 'text-red-600'
                        : alert.type === 'warning'
                        ? 'text-orange-600'
                        : 'text-blue-600'
                    }`}
                  />
                  <p className="flex-1 font-medium text-sm">{alert.message}</p>
                  {alert.link && (
                    <button
                      onClick={() => alert.link && router.push(alert.link)}
                      className="text-xs font-semibold hover:underline"
                    >
                      Voir <ArrowRight className="w-3 h-3 inline" />
                    </button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Trésorerie */}
        <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-6 h-6 text-emerald-600" />
              Trésorerie Globale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">Solde Total</p>
              <p className="text-4xl font-bold text-emerald-700">
                {data?.treasury.totalBalance.toLocaleString('fr-FR')} F
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <p className="text-xs text-gray-600 font-medium">Caisse</p>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {data?.treasury.cashBalance.toLocaleString('fr-FR')} F
                </p>
              </div>

              <div className="bg-white rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <p className="text-xs text-gray-600 font-medium">Banque</p>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {data?.treasury.bankBalance.toLocaleString('fr-FR')} F
                </p>
              </div>

              <div className="bg-white rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-4 h-4 text-orange-600" />
                  <p className="text-xs text-gray-600 font-medium">Mobile</p>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {data?.treasury.mobileMoneyBalance.toLocaleString('fr-FR')} F
                </p>
              </div>
            </div>

            <Button
              onClick={() => router.push('/treasury')}
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700"
            >
              Gérer la trésorerie <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Dépenses */}
        <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-6 h-6 text-red-600" />
              Dépenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">Aujourd'hui</p>
                <p className="text-xl font-bold text-red-700">
                  {data?.expenses.today.toLocaleString('fr-FR')} F
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">Cette semaine</p>
                <p className="text-xl font-bold text-red-600">
                  {data?.expenses.week.toLocaleString('fr-FR')} F
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">Ce mois</p>
                <p className="text-xl font-bold text-red-600">
                  {data?.expenses.month.toLocaleString('fr-FR')} F
                </p>
              </div>
            </div>

            {data && data.expenses.pendingApproval > 0 && (
              <div className="bg-orange-100 border-2 border-orange-300 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-orange-800">
                    En attente d'approbation
                  </span>
                  <span className="px-3 py-1 rounded-full bg-orange-600 text-white font-bold">
                    {data.expenses.pendingApproval}
                  </span>
                </div>
                <Button
                  onClick={() => router.push('/depenses?filter=pending')}
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 border-orange-600 text-orange-700 hover:bg-orange-100"
                >
                  Traiter les demandes
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ventes & Encaissements */}
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-blue-600" />
              Ventes & Encaissements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div>
                  <p className="text-xs text-gray-600 font-medium">Chiffre d'affaires</p>
                  <p className="text-xl font-bold text-blue-700">
                    {data?.sales.revenue.toLocaleString('fr-FR')} F
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-blue-600" />
              </div>

              <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div>
                  <p className="text-xs text-gray-600 font-medium">Encaissé</p>
                  <p className="text-xl font-bold text-green-600">
                    {data?.sales.collected.toLocaleString('fr-FR')} F
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>

              <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div>
                  <p className="text-xs text-gray-600 font-medium">À encaisser (créances)</p>
                  <p className="text-xl font-bold text-orange-600">
                    {data?.sales.receivables.toLocaleString('fr-FR')} F
                  </p>
                </div>
                <Receipt className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Paie & RH */}
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-6 h-6 text-purple-600" />
              Masse Salariale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-600 font-medium mb-1">Employés</p>
                <p className="text-2xl font-bold text-purple-700">{data?.payroll.totalEmployees || 0}</p>
              </div>

              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-600 font-medium mb-1">Salaires totaux</p>
                <p className="text-lg font-bold text-purple-600">
                  {data?.payroll.totalSalaries.toLocaleString('fr-FR')} F
                </p>
              </div>
            </div>

            {data && data.payroll.pendingAdvances > 0 && (
              <div className="bg-orange-100 border-2 border-orange-300 rounded-lg p-3 mb-3">
                <p className="text-sm font-semibold text-orange-800">
                  {data.payroll.pendingAdvances} avances en attente
                </p>
              </div>
            )}

            {data?.payroll.nextPayrollDate && (
              <div className="bg-purple-100 border-2 border-purple-300 rounded-lg p-3 flex items-center gap-3">
                <Calendar className="w-5 h-5 text-purple-700" />
                <div>
                  <p className="text-xs text-purple-700 font-medium">Prochaine paie</p>
                  <p className="text-sm font-bold text-purple-900">
                    {new Date(data.payroll.nextPayrollDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={() => router.push('/hr/payroll')}
              className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
            >
              Gérer la paie <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Actions Rapides */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={() => router.push('/depenses/new')}
            className="h-20 bg-gradient-to-br from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white font-bold flex flex-col items-center justify-center gap-2"
          >
            <TrendingDown className="w-6 h-6" />
            <span>Nouvelle Dépense</span>
          </Button>

          <Button
            onClick={() => router.push('/treasury/transactions')}
            className="h-20 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold flex flex-col items-center justify-center gap-2"
          >
            <Wallet className="w-6 h-6" />
            <span>Transaction</span>
          </Button>

          <Button
            onClick={() => router.push('/reports/financial')}
            className="h-20 bg-gradient-to-br from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold flex flex-col items-center justify-center gap-2"
          >
            <FileText className="w-6 h-6" />
            <span>Rapports Financiers</span>
          </Button>

          <Button
            onClick={() => router.push('/accounting')}
            className="h-20 bg-gradient-to-br from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-bold flex flex-col items-center justify-center gap-2"
          >
            <Calculator className="w-6 h-6" />
            <span>Comptabilité</span>
          </Button>
        </div>

        {/* Export rapide */}
        <Card className="border-2 border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-gray-600" />
                <span className="font-semibold text-gray-900">Exporter les données</span>
              </div>
              <Button
                onClick={() => router.push('/reports/export')}
                variant="outline"
                size="sm"
              >
                Exporter
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
