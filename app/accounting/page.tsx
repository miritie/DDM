/**
 * Page - Comptabilité
 * Module Comptabilité
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JournalEntry } from '@/types/modules';

export default function AccountingPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/accounting/entries');
      if (res.ok) {
        const data = await res.json();
        setEntries(data.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInitialize = async (type: 'accounts' | 'journals') => {
    try {
      const endpoint = type === 'accounts'
        ? '/api/accounting/accounts/initialize'
        : '/api/accounting/journals/initialize';

      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        alert(`${type === 'accounts' ? 'Plan comptable' : 'Journaux'} initialisé avec succès`);
        loadData();
      }
    } catch (error) {
      console.error('Error initializing:', error);
    }
  };

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
          <h1 className="text-3xl font-bold">Comptabilité</h1>
          <p className="text-muted-foreground">Module Comptabilité OHADA</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleInitialize('accounts')}>
            Initialiser Plan Comptable
          </Button>
          <Button variant="outline" onClick={() => handleInitialize('journals')}>
            Initialiser Journaux
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:bg-accent" onClick={() => router.push('/accounting/accounts')}>
          <CardHeader>
            <CardTitle>Plan Comptable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Gestion des comptes comptables OHADA
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent" onClick={() => router.push('/accounting/journals')}>
          <CardHeader>
            <CardTitle>Journaux</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Journaux de ventes, achats, banque, caisse, OD
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent" onClick={() => router.push('/accounting/entries')}>
          <CardHeader>
            <CardTitle>Écritures Comptables</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {entries.length} écriture(s) enregistrée(s)
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:bg-accent" onClick={() => router.push('/accounting/reports/trial-balance')}>
          <CardHeader>
            <CardTitle>Balance Générale</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Balance des comptes par période
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent" onClick={() => router.push('/accounting/reports/balance-sheet')}>
          <CardHeader>
            <CardTitle>Bilan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Actif et Passif
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent" onClick={() => router.push('/accounting/reports/income-statement')}>
          <CardHeader>
            <CardTitle>Compte de Résultat</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Produits et Charges
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
