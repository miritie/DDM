'use client';

/**
 * Page - Dashboard Dépenses & Sollicitations (Mobile-First)
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  Zap,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { ExpenseRequest } from '@/types/modules';
import { ExpenseRequestCard } from '@/components/expenses/expense-request-card';

interface ExpenseStatistics {
  totalRequests: number;
  pendingApproval: number;
  approved: number;
  totalAmount: number;
  pendingAmount: number;
}

export default function ExpensesPage() {
  const router = useRouter();
  const [myRequests, setMyRequests] = useState<ExpenseRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ExpenseRequest[]>([]);
  const [statistics, setStatistics] = useState<ExpenseStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [myReqRes, pendingRes, statsRes] = await Promise.all([
        fetch('/api/expenses/requests?my=true&limit=5'),
        fetch('/api/expenses/requests?needsMyApproval=true&limit=5'),
        fetch('/api/expenses/requests/statistics'),
      ]);

      if (myReqRes.ok) {
        const data = await myReqRes.json();
        setMyRequests(data.data || []);
      }

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingApprovals(data.data || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStatistics(data.data);
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
            <DollarSign className="w-7 h-7" />
            Dépenses & Sollicitations
          </h1>

          {statistics && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm opacity-90">Total Demandes</span>
                </div>
                <p className="text-3xl font-bold">{statistics.totalRequests}</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm opacity-90">En Attente</span>
                </div>
                <p className="text-3xl font-bold">{statistics.pendingApproval}</p>
                <p className="text-xs opacity-80 mt-1">
                  {new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(
                    statistics.pendingAmount
                  )}{' '}
                  F
                </p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm opacity-90">Approuvées</span>
                </div>
                <p className="text-3xl font-bold">{statistics.approved}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-4">
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-xl p-6 mb-6 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
            <Zap className="w-6 h-6" />
            Sollicitation Rapide
          </h2>
          <p className="text-sm opacity-90 mb-4">Créez une demande en moins d'1 minute</p>
          <Button
            onClick={() => router.push('/expenses/requests/quick')}
            className="w-full bg-white text-red-600 hover:bg-red-50 h-14 text-lg font-bold rounded-xl shadow-lg"
          >
            <Zap className="w-6 h-6 mr-2" />
            Nouvelle Sollicitation
          </Button>
        </div>

        {pendingApprovals.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                À Valider ({pendingApprovals.length})
              </h2>
              <button
                onClick={() => router.push('/expenses/requests?needsMyApproval=true')}
                className="text-sm text-red-600 font-medium flex items-center gap-1"
              >
                Tout voir
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {pendingApprovals.map((request) => (
                <ExpenseRequestCard
                  key={request.ExpenseRequestId}
                  request={request}
                  onClick={() =>
                    router.push(`/expenses/requests/${request.ExpenseRequestId}`)
                  }
                  showDetails={true}
                  showApprovalActions={true}
                />
              ))}
            </div>
          </div>
        )}

        {myRequests.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Mes Demandes</h2>
              <button
                onClick={() => router.push('/expenses/requests?my=true')}
                className="text-sm text-red-600 font-medium flex items-center gap-1"
              >
                Tout voir
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {myRequests.map((request) => (
                <ExpenseRequestCard
                  key={request.ExpenseRequestId}
                  request={request}
                  onClick={() =>
                    router.push(`/expenses/requests/${request.ExpenseRequestId}`)
                  }
                  showDetails={false}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
