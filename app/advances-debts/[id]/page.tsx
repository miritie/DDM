/**
 * Page - Détails Avance/Dette
 * Module 7.5
 */

'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';
import { AdvanceDebt, AdvanceDebtMovement } from '@/types/modules';
import { DragDropUpload } from '@/components/upload/file-upload';

export default function AdvanceDebtDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [advanceDebt, setAdvanceDebt] = React.useState<AdvanceDebt | null>(null);
  const [movements, setMovements] = React.useState<AdvanceDebtMovement[]>([]);
  const [showPaymentModal, setShowPaymentModal] = React.useState(false);
  const [paymentAmount, setPaymentAmount] = React.useState('');
  const [paymentDescription, setPaymentDescription] = React.useState('');
  const [paymentAttachment, setPaymentAttachment] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      // Charger l'avance/dette
      const response = await fetch(`/api/advances-debts/${id}`);
      const data = await response.json();
      setAdvanceDebt(data.data);

      // Charger les mouvements
      const movementsResponse = await fetch(`/api/advances-debts/${id}/movements`);
      const movementsData = await movementsResponse.json();
      setMovements(movementsData.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePayment() {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      alert('Montant invalide');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/advances-debts/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          description: paymentDescription,
          attachmentUrl: paymentAttachment,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'enregistrement du paiement');
      }

      // Recharger les données
      await loadData();

      // Reset et fermer
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentDescription('');
      setPaymentAttachment('');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
    }).format(amount);
  }

  function formatDate(dateString: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  }

  function getStatusBadge(status: string) {
    const colors: Record<string, string> = {
      active: 'bg-blue-100 text-blue-800',
      partially_paid: 'bg-yellow-100 text-yellow-800',
      fully_paid: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };

    const labels: Record<string, string> = {
      active: 'Actif',
      partially_paid: 'Partiellement payé',
      fully_paid: 'Entièrement payé',
      cancelled: 'Annulé',
    };

    return (
      <span className={`px-3 py-1 text-sm font-medium rounded ${colors[status] || colors.active}`}>
        {labels[status] || status}
      </span>
    );
  }

  if (loading) {
    return (
      <ProtectedPage permission={PERMISSIONS.ADVANCE_VIEW}>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">Chargement...</div>
        </div>
      </ProtectedPage>
    );
  }

  if (!advanceDebt) {
    return (
      <ProtectedPage permission={PERMISSIONS.ADVANCE_VIEW}>
        <div className="container mx-auto p-6">
          <div className="text-center py-12 text-gray-500">
            Avance/Dette non trouvée
          </div>
        </div>
      </ProtectedPage>
    );
  }

  const progressPercentage = ((advanceDebt.Amount - advanceDebt.Balance) / advanceDebt.Amount) * 100;

  return (
    <ProtectedPage permission={PERMISSIONS.ADVANCE_VIEW}>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Retour
              </button>
              <h1 className="text-3xl font-bold text-gray-900">
                {advanceDebt.RecordNumber}
              </h1>
              {getStatusBadge(advanceDebt.Status)}
            </div>
            <p className="mt-1 text-gray-500">{advanceDebt.Reason}</p>
          </div>

          <Can permission={PERMISSIONS.ADVANCE_EDIT}>
            {advanceDebt.Balance > 0 && advanceDebt.Status !== 'cancelled' && (
              <Button onClick={() => setShowPaymentModal(true)}>
                Enregistrer un paiement
              </Button>
            )}
          </Can>
        </div>

        {/* Informations principales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Montant initial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(advanceDebt.Amount)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Montant payé
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(advanceDebt.Amount - advanceDebt.Balance)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Reste à payer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(advanceDebt.Balance)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Barre de progression */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progression du paiement</span>
                <span className="font-medium">{progressPercentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Historique des mouvements */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des paiements</CardTitle>
          </CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucun mouvement enregistré
              </div>
            ) : (
              <div className="space-y-3">
                {movements.map((movement) => (
                  <div
                    key={movement.MovementId}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex-grow">
                      <div className="font-medium">{formatCurrency(movement.Amount)}</div>
                      <div className="text-sm text-gray-500">
                        {movement.Description || 'Paiement'}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {formatDate(movement.ProcessedAt)}
                      </div>
                    </div>

                    {movement.AttachmentUrl && (
                      <a
                        href={movement.AttachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        📎 Justificatif
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de paiement */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md m-4">
              <CardHeader>
                <CardTitle>Enregistrer un paiement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Montant (FCFA)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    max={advanceDebt.Balance}
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum: {formatCurrency(advanceDebt.Balance)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optionnelle)
                  </label>
                  <textarea
                    value={paymentDescription}
                    onChange={(e) => setPaymentDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Justificatif (optionnel)
                  </label>
                  <DragDropUpload
                    onUploadComplete={(result) => setPaymentAttachment(result.url)}
                    onUploadError={(error) => alert(error)}
                    options={{
                      folder: 'payments',
                      maxSize: 5 * 1024 * 1024,
                      allowedTypes: ['image/*', 'application/pdf'],
                    }}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button onClick={handlePayment} disabled={submitting} className="flex-1">
                    {submitting ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowPaymentModal(false)}
                    disabled={submitting}
                  >
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
