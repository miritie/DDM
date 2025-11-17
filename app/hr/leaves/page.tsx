'use client';

/**
 * Page - Gestion des Congés
 * Module Ressources Humaines
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Leave, LeaveBalance } from '@/types/modules';

export default function LeavesPage() {
  const router = useRouter();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);

      const res = await fetch(`/api/hr/leaves?${params}`);

      if (res.ok) {
        const data = await res.json();
        setLeaves(data.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (leaveId: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/hr/leaves/${leaveId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          reviewedById: 'current-user-id', // TODO: Get from session
        }),
      });

      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Error reviewing leave:', error);
    }
  };

  const handleCancel = async (leaveId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler ce congé ?')) return;

    try {
      const res = await fetch(`/api/hr/leaves/${leaveId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Error cancelling leave:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'outline'> = {
      pending: 'outline',
      approved: 'default',
      rejected: 'destructive',
      cancelled: 'destructive',
    };
    const labels: Record<string, string> = {
      pending: 'En attente',
      approved: 'Approuvé',
      rejected: 'Rejeté',
      cancelled: 'Annulé',
    };
    return <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      annual: 'Congé annuel',
      sick: 'Congé maladie',
      maternity: 'Congé maternité',
      paternity: 'Congé paternité',
      unpaid: 'Sans solde',
      other: 'Autre',
    };
    return <Badge variant="outline">{labels[type] || type}</Badge>;
  };

  const pendingLeaves = leaves.filter((l) => l.Status === 'pending');
  const approvedLeaves = leaves.filter((l) => l.Status === 'approved');

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Congés</h1>
          <p className="text-muted-foreground">
            Module Ressources Humaines - {leaves.length} congé(s)
          </p>
        </div>
        <Button onClick={() => router.push('/hr/leaves/new')}>
          Nouvelle Demande
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Congés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leaves.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">En Attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingLeaves.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Approuvés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedLeaves.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="approved">Approuvé</SelectItem>
                <SelectItem value="rejected">Rejeté</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="annual">Congé annuel</SelectItem>
                <SelectItem value="sick">Congé maladie</SelectItem>
                <SelectItem value="maternity">Congé maternité</SelectItem>
                <SelectItem value="paternity">Congé paternité</SelectItem>
                <SelectItem value="unpaid">Sans solde</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Employé</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Début</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Jours</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Aucun congé trouvé
                  </TableCell>
                </TableRow>
              ) : (
                leaves.map((leave) => (
                  <TableRow key={leave.LeaveId}>
                    <TableCell className="font-medium">
                      {leave.LeaveNumber}
                    </TableCell>
                    <TableCell>{leave.EmployeeId}</TableCell>
                    <TableCell>{getTypeBadge(leave.Type)}</TableCell>
                    <TableCell>
                      {new Date(leave.StartDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(leave.EndDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{leave.DaysCount} jour(s)</TableCell>
                    <TableCell>{getStatusBadge(leave.Status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {leave.Status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReview(leave.LeaveId, 'approved')}
                            >
                              Approuver
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleReview(leave.LeaveId, 'rejected')}
                            >
                              Rejeter
                            </Button>
                          </>
                        )}
                        {leave.Status !== 'cancelled' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancel(leave.LeaveId)}
                          >
                            Annuler
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/hr/leaves/${leave.LeaveId}`)}
                        >
                          Voir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
