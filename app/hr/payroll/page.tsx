/**
 * Page - Gestion de la Paie
 * Module Ressources Humaines
 */

'use client';

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
import { Payroll } from '@/types/modules';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function PayrollPage() {
  const router = useRouter();
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkPeriod, setBulkPeriod] = useState('');

  useEffect(() => {
    loadData();
  }, [periodFilter, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (periodFilter) params.append('period', periodFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const statsParams = new URLSearchParams();
      if (periodFilter) statsParams.append('period', periodFilter);

      const [payrollsRes, statsRes] = await Promise.all([
        fetch(`/api/hr/payroll?${params}`),
        fetch(`/api/hr/payroll/statistics?${statsParams}`),
      ]);

      if (payrollsRes.ok) {
        const data = await payrollsRes.json();
        setPayrolls(data.data || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStatistics(data.data || null);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (!bulkPeriod) return;

    try {
      const res = await fetch('/api/hr/payroll/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: bulkPeriod }),
      });

      if (res.ok) {
        setShowBulkDialog(false);
        setBulkPeriod('');
        loadData();
      }
    } catch (error) {
      console.error('Error generating payrolls:', error);
    }
  };

  const handleValidate = async (payrollId: string) => {
    try {
      const res = await fetch(`/api/hr/payroll/${payrollId}/validate`, {
        method: 'POST',
      });

      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Error validating payroll:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'outline'> = {
      draft: 'outline',
      validated: 'default',
      paid: 'default',
      cancelled: 'destructive',
    };
    const labels: Record<string, string> = {
      draft: 'Brouillon',
      validated: 'Validée',
      paid: 'Payée',
      cancelled: 'Annulée',
    };
    return <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>;
  };

  const currentPeriod = new Date().toISOString().slice(0, 7);
  const periods = Array.from(new Set(payrolls.map((p) => p.Period))).sort().reverse();

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
          <h1 className="text-3xl font-bold">Gestion de la Paie</h1>
          <p className="text-muted-foreground">
            Module Ressources Humaines - {payrolls.length} paie(s)
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowBulkDialog(true)}>
            Générer Paies du Mois
          </Button>
          <Button onClick={() => router.push('/hr/payroll/new')}>
            Nouvelle Paie
          </Button>
        </div>
      </div>

      {statistics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Paies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.totalPayrolls}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Salaire Brut Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.totalGrossSalary.toLocaleString()} F
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Salaire Net Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.totalNetSalary.toLocaleString()} F
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Déductions Avances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.totalAdvanceDeductions.toLocaleString()} F
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex gap-4">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toutes périodes</SelectItem>
                {periods.map((period) => (
                  <SelectItem key={period} value={period}>
                    {period}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="validated">Validée</SelectItem>
                <SelectItem value="paid">Payée</SelectItem>
                <SelectItem value="cancelled">Annulée</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Employé</TableHead>
                <TableHead>Salaire Brut</TableHead>
                <TableHead>Déductions</TableHead>
                <TableHead>Avances</TableHead>
                <TableHead>Salaire Net</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrolls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Aucune paie trouvée
                  </TableCell>
                </TableRow>
              ) : (
                payrolls.map((payroll) => (
                  <TableRow key={payroll.PayrollId}>
                    <TableCell className="font-medium">
                      {payroll.PayrollNumber}
                    </TableCell>
                    <TableCell>{payroll.Period}</TableCell>
                    <TableCell>{payroll.EmployeeId}</TableCell>
                    <TableCell>
                      {payroll.BaseSalary.toLocaleString()} F
                    </TableCell>
                    <TableCell>
                      {payroll.Deductions.toLocaleString()} F
                    </TableCell>
                    <TableCell>
                      {payroll.AdvanceDeduction.toLocaleString()} F
                    </TableCell>
                    <TableCell className="font-bold">
                      {payroll.NetSalary.toLocaleString()} F
                    </TableCell>
                    <TableCell>{getStatusBadge(payroll.Status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {payroll.Status === 'draft' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleValidate(payroll.PayrollId)}
                          >
                            Valider
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/hr/payroll/${payroll.PayrollId}`)}
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

      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Générer les Paies</DialogTitle>
            <DialogDescription>
              Générer automatiquement les paies pour tous les employés actifs
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="period">Période (YYYY-MM)</Label>
              <Input
                id="period"
                type="month"
                value={bulkPeriod}
                onChange={(e) => setBulkPeriod(e.target.value)}
                placeholder={currentPeriod}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleBulkGenerate}>Générer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
