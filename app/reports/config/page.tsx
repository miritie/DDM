/**
 * Page - Configuration Rapports & Transmission
 * Mobile-First - Paramétrage Point Flash, Dépenses quotidiennes, Groupes WhatsApp
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Settings,
  Clock,
  Send,
  FileText,
  Users,
  Save,
  TestTube,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WhatsAppGroup {
  groupId: string;
  name: string;
  description?: string;
}

interface ReportConfig {
  pointFlash: {
    enabled: boolean;
    schedule: {
      dayOfWeek: number; // 0=dimanche
      hour: number;
      minute: number;
    };
    whatsappGroups: string[];
    includePDF: boolean;
    sendTextSummary: boolean;
  };
  dailyExpenses: {
    enabled: boolean;
    schedule: {
      hour: number;
      minute: number;
    };
    whatsappGroups: string[];
    includePDF: boolean;
  };
  dailySales: {
    enabled: boolean;
    schedule: {
      hour: number;
      minute: number;
    };
    whatsappGroups: string[];
    includePDF: boolean;
  };
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dimanche' },
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
];

export default function ReportsConfigPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [config, setConfig] = useState<ReportConfig>({
    pointFlash: {
      enabled: true,
      schedule: { dayOfWeek: 0, hour: 19, minute: 0 },
      whatsappGroups: [],
      includePDF: true,
      sendTextSummary: true,
    },
    dailyExpenses: {
      enabled: false,
      schedule: { hour: 18, minute: 0 },
      whatsappGroups: [],
      includePDF: false,
    },
    dailySales: {
      enabled: false,
      schedule: { hour: 20, minute: 0 },
      whatsappGroups: [],
      includePDF: false,
    },
  });

  const [whatsappGroups, setWhatsappGroups] = useState<WhatsAppGroup[]>([]);
  const [newGroupId, setNewGroupId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    loadConfig();
    loadWhatsAppGroups();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/reports/config');
      const result = await response.json();

      if (response.ok && result.data) {
        setConfig(result.data);
      }
    } catch (err) {
      console.error('Erreur chargement config:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadWhatsAppGroups = async () => {
    try {
      const response = await fetch('/api/whatsapp/groups');
      const result = await response.json();

      if (response.ok && result.data) {
        setWhatsappGroups(result.data);
      }
    } catch (err) {
      console.error('Erreur chargement groupes:', err);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await fetch('/api/reports/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la sauvegarde');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setError(null);

      const testGroupId = config.pointFlash.whatsappGroups[0] || whatsappGroups[0]?.groupId;

      if (!testGroupId) {
        throw new Error('Aucun groupe configuré pour le test');
      }

      const response = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: testGroupId }),
      });

      const result = await response.json();

      if (response.ok) {
        alert('✅ Test réussi ! Message envoyé au groupe');
      } else {
        throw new Error(result.error || 'Échec du test');
      }
    } catch (err: any) {
      alert(`❌ Erreur: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleAddGroup = () => {
    if (!newGroupId.trim() || !newGroupName.trim()) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    const newGroup: WhatsAppGroup = {
      groupId: newGroupId.trim(),
      name: newGroupName.trim(),
    };

    setWhatsappGroups([...whatsappGroups, newGroup]);
    setNewGroupId('');
    setNewGroupName('');

    // Sauvegarder les groupes
    fetch('/api/whatsapp/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groups: [...whatsappGroups, newGroup] }),
    });
  };

  const handleRemoveGroup = (groupId: string) => {
    if (!confirm('Supprimer ce groupe ?')) return;

    const updated = whatsappGroups.filter((g) => g.groupId !== groupId);
    setWhatsappGroups(updated);

    // Sauvegarder
    fetch('/api/whatsapp/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groups: updated }),
    });
  };

  const toggleGroupForReport = (reportType: 'pointFlash' | 'dailyExpenses' | 'dailySales', groupId: string) => {
    setConfig((prev) => {
      const currentGroups = prev[reportType].whatsappGroups;
      const newGroups = currentGroups.includes(groupId)
        ? currentGroups.filter((id) => id !== groupId)
        : [...currentGroups, groupId];

      return {
        ...prev,
        [reportType]: {
          ...prev[reportType],
          whatsappGroups: newGroups,
        },
      };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => router.push('/reports')}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Configuration Rapports</h1>
            <p className="text-sm opacity-90">Automatisation & Transmission</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Messages */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">Configuration sauvegardée avec succès</p>
          </div>
        )}

        {/* Section 1: Point Flash Hebdomadaire */}
        <div className="bg-white rounded-2xl shadow-md border-2 border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <h2 className="font-bold text-gray-900">Point Flash Hebdomadaire</h2>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.pointFlash.enabled}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    pointFlash: { ...config.pointFlash, enabled: e.target.checked },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="space-y-4">
            {/* Horaire */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Programmation
              </label>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={config.pointFlash.schedule.dayOfWeek}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      pointFlash: {
                        ...config.pointFlash,
                        schedule: {
                          ...config.pointFlash.schedule,
                          dayOfWeek: parseInt(e.target.value),
                        },
                      },
                    })
                  }
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg"
                >
                  {DAYS_OF_WEEK.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>

                <input
                  type="time"
                  value={`${String(config.pointFlash.schedule.hour).padStart(2, '0')}:${String(config.pointFlash.schedule.minute).padStart(2, '0')}`}
                  onChange={(e) => {
                    const [hour, minute] = e.target.value.split(':');
                    setConfig({
                      ...config,
                      pointFlash: {
                        ...config.pointFlash,
                        schedule: {
                          ...config.pointFlash.schedule,
                          hour: parseInt(hour),
                          minute: parseInt(minute),
                        },
                      },
                    });
                  }}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.pointFlash.includePDF}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      pointFlash: { ...config.pointFlash, includePDF: e.target.checked },
                    })
                  }
                  className="w-5 h-5 accent-blue-600"
                />
                <span className="text-sm font-medium text-gray-800">Inclure PDF</span>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.pointFlash.sendTextSummary}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      pointFlash: { ...config.pointFlash, sendTextSummary: e.target.checked },
                    })
                  }
                  className="w-5 h-5 accent-blue-600"
                />
                <span className="text-sm font-medium text-gray-800">Résumé texte</span>
              </label>
            </div>

            {/* Groupes WhatsApp */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Send className="w-4 h-4 inline mr-2" />
                Groupes WhatsApp
              </label>
              <div className="space-y-2">
                {whatsappGroups.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Aucun groupe configuré
                  </p>
                ) : (
                  whatsappGroups.map((group) => (
                    <label
                      key={group.groupId}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={config.pointFlash.whatsappGroups.includes(group.groupId)}
                        onChange={() => toggleGroupForReport('pointFlash', group.groupId)}
                        className="w-5 h-5 accent-blue-600"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{group.name}</p>
                        <p className="text-xs text-gray-500">{group.groupId}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Dépenses Quotidiennes */}
        <div className="bg-white rounded-2xl shadow-md border-2 border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-600" />
              <h2 className="font-bold text-gray-900">Dépenses Quotidiennes</h2>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.dailyExpenses.enabled}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    dailyExpenses: { ...config.dailyExpenses, enabled: e.target.checked },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Heure d'envoi</label>
              <input
                type="time"
                value={`${String(config.dailyExpenses.schedule.hour).padStart(2, '0')}:${String(config.dailyExpenses.schedule.minute).padStart(2, '0')}`}
                onChange={(e) => {
                  const [hour, minute] = e.target.value.split(':');
                  setConfig({
                    ...config,
                    dailyExpenses: {
                      ...config.dailyExpenses,
                      schedule: {
                        hour: parseInt(hour),
                        minute: parseInt(minute),
                      },
                    },
                  });
                }}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
              />
            </div>

            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={config.dailyExpenses.includePDF}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    dailyExpenses: { ...config.dailyExpenses, includePDF: e.target.checked },
                  })
                }
                className="w-5 h-5 accent-blue-600"
              />
              <span className="text-sm font-medium text-gray-800">Inclure PDF</span>
            </label>
          </div>
        </div>

        {/* Section 3: Groupes WhatsApp */}
        <div className="bg-white rounded-2xl shadow-md border-2 border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-green-600" />
            <h2 className="font-bold text-gray-900">Groupes WhatsApp</h2>
          </div>

          {/* Ajouter groupe */}
          <div className="space-y-3 mb-4">
            <input
              type="text"
              value={newGroupId}
              onChange={(e) => setNewGroupId(e.target.value)}
              placeholder="ID du groupe (ex: 120363...)"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl"
            />
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Nom du groupe"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl"
            />
            <Button onClick={handleAddGroup} className="w-full">
              <Plus className="w-5 h-5 mr-2" />
              Ajouter le groupe
            </Button>
          </div>

          {/* Liste groupes */}
          <div className="space-y-2">
            {whatsappGroups.map((group) => (
              <div
                key={group.groupId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-semibold text-gray-900">{group.name}</p>
                  <p className="text-xs text-gray-500">{group.groupId}</p>
                </div>
                <button
                  onClick={() => handleRemoveGroup(group.groupId)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90"
          >
            {saving ? (
              <>
                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <Save className="w-6 h-6 mr-2" />
                Sauvegarder la Configuration
              </>
            )}
          </Button>

          <Button
            onClick={handleTestConnection}
            disabled={testing}
            variant="outline"
            className="w-full h-14 text-lg font-bold border-2"
          >
            {testing ? (
              <>
                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                Test en cours...
              </>
            ) : (
              <>
                <TestTube className="w-6 h-6 mr-2" />
                Tester WhatsApp
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
