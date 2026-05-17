'use client';

/**
 * Page /inbox — Centre de notifications personnel de l'utilisateur courant.
 *
 * Distinct de /notifications (outil admin pour envoyer des notifs test).
 * Cette page affiche ce qui a été reçu par l'utilisateur : approbations,
 * refus, transferts à recevoir, etc.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, ArrowLeft, CheckCheck, CheckCircle, XCircle, ShoppingCart,
  ArrowRightLeft, Factory, ShoppingBag, AlertCircle, FileText, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const CATEGORY_VISUALS: Record<string, { icon: any; bg: string; text: string }> = {
  expense_approved:           { icon: CheckCircle, bg: 'bg-green-100', text: 'text-green-700' },
  expense_rejected:           { icon: XCircle, bg: 'bg-red-100', text: 'text-red-700' },
  expense_paid:               { icon: CheckCircle, bg: 'bg-emerald-100', text: 'text-emerald-700' },
  transfer_incoming:          { icon: ArrowRightLeft, bg: 'bg-cyan-100', text: 'text-cyan-700' },
  transfer_recalled:          { icon: ArrowRightLeft, bg: 'bg-gray-100', text: 'text-gray-700' },
  transfer_shortfall:         { icon: AlertCircle, bg: 'bg-orange-100', text: 'text-orange-700' },
  customer_order_approved:    { icon: ShoppingCart, bg: 'bg-blue-100', text: 'text-blue-700' },
  production_order_approved:  { icon: Factory, bg: 'bg-purple-100', text: 'text-purple-700' },
  purchase_request_approved:  { icon: ShoppingBag, bg: 'bg-amber-100', text: 'text-amber-700' },
  generic:                    { icon: FileText, bg: 'bg-gray-100', text: 'text-gray-700' },
};

interface Notif {
  id: string;
  notification_id: string;
  subject: string;
  message: string;
  category: string | null;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

type Tab = 'unread' | 'all';

const fmtDate = (s: string) => {
  const d = new Date(s);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function InboxPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('unread');

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/notifications/inbox${tab === 'unread' ? '?onlyUnread=true' : ''}`, { cache: 'no-store' });
      if (r.ok) setItems(((await r.json()).data) || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  async function markAsRead(n: Notif) {
    if (n.read_at) return;
    await fetch(`/api/notifications/inbox/${n.notification_id}/read`, { method: 'POST' });
    setItems((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
    );
  }

  async function markAllRead() {
    await fetch('/api/notifications/inbox/mark-all-read', { method: 'POST' });
    load();
  }

  async function handleClick(n: Notif) {
    await markAsRead(n);
    if (n.action_url) router.push(n.action_url);
  }

  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 pb-8">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="w-7 h-7" /> Notifications
            </h1>
            <div className="flex gap-2">
              <button onClick={load} className="p-2 bg-white/20 rounded-full hover:bg-white/30" title="Rafraîchir">
                <RefreshCw className="w-4 h-4" />
              </button>
              {unreadCount > 0 && tab === 'unread' && (
                <Button onClick={markAllRead} className="bg-white/20 hover:bg-white/30 border border-white/40">
                  <CheckCheck className="w-4 h-4 mr-1" /> Tout marquer comme lu
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-xl p-3 mb-4 flex gap-2">
          {([
            { id: 'unread' as Tab, label: 'Non lues' },
            { id: 'all'    as Tab, label: 'Toutes' },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                tab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center text-gray-500">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center text-gray-500">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold">
              {tab === 'unread' ? 'Aucune notification non lue.' : 'Aucune notification.'}
            </p>
            <p className="text-sm mt-1">
              Tu seras notifié des validations / refus / livraisons qui te concernent.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((n) => {
              const cfg = CATEGORY_VISUALS[n.category || 'generic'] || CATEGORY_VISUALS.generic;
              const Icon = cfg.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left p-4 rounded-2xl shadow flex items-start gap-3 transition-all hover:shadow-lg ${
                    n.read_at ? 'bg-white opacity-80' : 'bg-white border-l-4 border-blue-500'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${cfg.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className={`font-semibold truncate ${n.read_at ? 'text-gray-700' : 'text-gray-900'}`}>
                        {n.subject}
                      </p>
                      <span className="text-xs text-gray-400 shrink-0">{fmtDate(n.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{n.message}</p>
                    {n.action_url && (
                      <p className="text-xs text-blue-600 mt-1">Voir →</p>
                    )}
                  </div>
                  {!n.read_at && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-2" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
