'use client';

/**
 * Page - Notifications
 * Module Notifications
 */

import { useEffect, useState } from 'react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Notification } from '@/types/modules';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'email' | 'sms'>('all');
  const [showTestModal, setShowTestModal] = useState(false);

  // Test notification form
  const [testForm, setTestForm] = useState({
    channel: 'email' as 'email' | 'sms' | 'both',
    to: '',
    subject: '',
    message: '',
    template: '' as '' | 'welcome' | 'advance_debt' | 'transaction' | 'reminder',
  });

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  async function loadNotifications() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('channel', filter);
      }

      const response = await fetch(`/api/notifications?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data || []);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function sendTestNotification() {
    try {
      const payload: any = {
        channel: testForm.channel,
        to: testForm.to,
        message: testForm.message,
      };

      if (testForm.channel === 'email' || testForm.channel === 'both') {
        payload.subject = testForm.subject || 'Test Notification';
      }

      if (testForm.template) {
        payload.template = testForm.template;
        payload.templateData = getTemplateData(testForm.template);
      }

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de l\'envoi');
      }

      alert('Notification envoyée avec succès!');
      setShowTestModal(false);
      setTestForm({
        channel: 'email',
        to: '',
        subject: '',
        message: '',
        template: '',
      });
      await loadNotifications();
    } catch (error: any) {
      alert(error.message);
    }
  }

  function getTemplateData(template: string) {
    switch (template) {
      case 'welcome':
        return { userName: 'John Doe' };
      case 'advance_debt':
        return {
          userName: 'John Doe',
          type: 'advance',
          amount: 50000,
          reason: 'Avance sur salaire',
          recordNumber: 'ADV-2025-001',
        };
      case 'transaction':
        return {
          userName: 'John Doe',
          type: 'income',
          amount: 100000,
          description: 'Vente de produits',
          transactionNumber: 'TRX-2025-001',
        };
      case 'reminder':
        return {
          userName: 'John Doe',
          amount: 25000,
          dueDate: new Date().toISOString(),
          recordNumber: 'ADV-2025-001',
        };
      default:
        return {};
    }
  }

  function formatDate(dateString: string) {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      sent: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      sent: 'Envoyé',
      pending: 'En attente',
      failed: 'Échec',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  }

  function getChannelIcon(channel: string) {
    return channel === 'email' ? '📧' : '📱';
  }

  return (
    <ProtectedPage permission={PERMISSIONS.NOTIFICATION_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="text-gray-600">Historique des emails et SMS envoyés</p>
          </div>
          <Button onClick={() => setShowTestModal(true)}>📤 Tester l'envoi</Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
              >
                Tous
              </Button>
              <Button
                variant={filter === 'email' ? 'default' : 'outline'}
                onClick={() => setFilter('email')}
              >
                📧 Emails
              </Button>
              <Button
                variant={filter === 'sms' ? 'default' : 'outline'}
                onClick={() => setFilter('sms')}
              >
                📱 SMS
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        <Card>
          <CardHeader>
            <CardTitle>Historique</CardTitle>
            <CardDescription>
              {notifications.length} notification{notifications.length > 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Chargement...</p>
            ) : notifications.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucune notification</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Canal
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Destinataire
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Sujet / Message
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {notifications.map((notification) => (
                      <tr key={notification.NotificationId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {formatDate(notification.SentAt || notification.CreatedAt)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {getChannelIcon(notification.Channel)} {notification.Channel}
                        </td>
                        <td className="px-4 py-3 text-sm">{notification.RecipientId}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="max-w-md">
                            {notification.Subject && (
                              <div className="font-medium">{notification.Subject}</div>
                            )}
                            <div className="text-gray-600 truncate">{notification.Message}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {getStatusBadge(notification.Status)}
                          {notification.ErrorMessage && (
                            <div className="text-xs text-red-600 mt-1">
                              {notification.ErrorMessage}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Modal */}
        {showTestModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">Tester l'envoi de notification</h2>

              <div className="space-y-4">
                {/* Channel Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">Canal</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'email', label: '📧 Email' },
                      { value: 'sms', label: '📱 SMS' },
                      { value: 'both', label: '📧📱 Les deux' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTestForm({ ...testForm, channel: option.value as any })}
                        className={`px-4 py-2 border-2 rounded-lg transition-all ${
                          testForm.channel === option.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Template Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">Template (optionnel)</label>
                  <select
                    value={testForm.template}
                    onChange={(e) => setTestForm({ ...testForm, template: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Aucun - Message personnalisé</option>
                    <option value="welcome">Bienvenue</option>
                    <option value="advance_debt">Avance/Dette</option>
                    <option value="transaction">Transaction</option>
                    <option value="reminder">Rappel d'échéance</option>
                  </select>
                  {testForm.template && (
                    <p className="text-xs text-gray-500 mt-1">
                      Le template utilisera des données de test automatiques
                    </p>
                  )}
                </div>

                {/* Recipient */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Destinataire {testForm.channel === 'email' ? '(Email)' : '(Téléphone)'}
                  </label>
                  <Input
                    type={testForm.channel === 'email' || testForm.channel === 'both' ? 'email' : 'tel'}
                    value={testForm.to}
                    onChange={(e) => setTestForm({ ...testForm, to: e.target.value })}
                    placeholder={
                      testForm.channel === 'sms'
                        ? '+224 XXX XXX XXX'
                        : 'email@example.com'
                    }
                  />
                </div>

                {/* Subject (Email only) */}
                {(testForm.channel === 'email' || testForm.channel === 'both') &&
                  !testForm.template && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Sujet</label>
                      <Input
                        value={testForm.subject}
                        onChange={(e) => setTestForm({ ...testForm, subject: e.target.value })}
                        placeholder="Sujet de l'email"
                      />
                    </div>
                  )}

                {/* Message (Custom only) */}
                {!testForm.template && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Message</label>
                    <textarea
                      value={testForm.message}
                      onChange={(e) => setTestForm({ ...testForm, message: e.target.value })}
                      placeholder="Votre message..."
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <Button onClick={sendTestNotification} className="flex-1">
                  Envoyer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowTestModal(false)}
                  className="flex-1"
                >
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
