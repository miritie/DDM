'use client';

/**
 * Header sticky du POS : nom de l'outlet, état de session, icônes Stock /
 * Caisse et menu kebab d'actions secondaires.
 * Extrait de app/sales/quick/page.tsx — l'état d'ouverture du menu est
 * local au composant (aucun autre morceau de la page n'en dépend).
 */

import { useState } from 'react';
import {
  MapPin, Package, Wallet, MoreVertical, Loader2,
  ClipboardList, ArrowRightLeft, Truck, BarChart3, List, LayoutGrid,
} from 'lucide-react';

export function PosHeader({
  outletName, openingSession, sessionId, incomingCount, viewMode,
  onOpenIncoming, onOpenCashRegister,
  onJournal, onSendStock, onReceive, onCloseCash, onPerformances,
  onToggleViewMode, onChangeOutlet,
}: {
  outletName: string;
  openingSession: boolean;
  sessionId: string | null;
  incomingCount: number;
  viewMode: 'compact' | 'list';
  onOpenIncoming: () => void;
  onOpenCashRegister: () => void;
  onJournal: () => void;
  onSendStock: () => void;
  onReceive: () => void;
  onCloseCash: () => void;
  onPerformances: () => void;
  onToggleViewMode: () => void;
  onChangeOutlet: () => void;
}) {
  // UI mobile : menu kebab local au header.
  const [showMenu, setShowMenu] = useState(false);
  const closeThen = (fn: () => void) => () => { fn(); setShowMenu(false); };

  return (
    <div className="sticky top-14 z-10 bg-white border-b px-3 py-2 flex items-center gap-2">
      <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold truncate leading-tight">{outletName || '…'}</p>
        <p className="text-[10px] leading-tight">
          {openingSession
            ? <span className="text-gray-500"><Loader2 className="w-2.5 h-2.5 inline animate-spin mr-1" />ouverture session…</span>
            : sessionId
              ? <span className="text-emerald-600">● Session active</span>
              : <span className="text-gray-400">—</span>}
        </p>
      </div>
      {/* Icône 📦 Stock — ouvre directement les réceptions à confirmer
          (cas le plus fréquent) ; le bouton « Envoyer du stock » est
          dans le modal lui-même. Badge violet si réceptions en attente. */}
      <button
        onClick={onOpenIncoming}
        className="relative p-2 rounded-lg border border-gray-200 hover:bg-gray-100"
        title="Stock : recevoir / envoyer"
        aria-label="Stock"
      >
        <Package className="w-5 h-5 text-purple-600" />
        {incomingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
            {incomingCount}
          </span>
        )}
      </button>

      {/* Icône 💰 Caisse — ouvre la vue caisse (solde + dépôt) */}
      <button
        onClick={onOpenCashRegister}
        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100"
        title="Caisse stand"
        aria-label="Caisse"
      >
        <Wallet className="w-5 h-5 text-emerald-600" />
      </button>

      {/* Bouton kebab actions secondaires */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(v => !v)}
          className="relative p-2 rounded-lg border border-gray-200 hover:bg-gray-100"
          aria-label="Actions"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-xl z-30 overflow-hidden">
              <MenuItem icon={<ClipboardList className="w-4 h-4 text-emerald-600" />} label="Journal de caisse"
                onClick={closeThen(onJournal)} />
              <MenuItem icon={<ArrowRightLeft className="w-4 h-4 text-purple-600" />} label="Envoyer du stock vers un autre stand"
                onClick={closeThen(onSendStock)} />
              <MenuItem icon={<Truck className="w-4 h-4 text-gray-600" />} label="Réception ad hoc"
                onClick={closeThen(onReceive)} />
              <MenuItem icon={<Wallet className="w-4 h-4 text-amber-600" />} label="Clôturer ma caisse"
                onClick={closeThen(onCloseCash)} />
              <MenuItem icon={<BarChart3 className="w-4 h-4 text-amber-600" />} label="Mes performances"
                onClick={closeThen(onPerformances)} />
              <div className="border-t my-1" />
              <MenuItem
                icon={viewMode === 'compact'
                  ? <List className="w-4 h-4 text-gray-600" />
                  : <LayoutGrid className="w-4 h-4 text-gray-600" />}
                label={viewMode === 'compact' ? 'Vue liste (max produits)' : 'Vue grille (avec images)'}
                onClick={closeThen(onToggleViewMode)} />
              <div className="border-t my-1" />
              <MenuItem icon={<MapPin className="w-4 h-4 text-gray-600" />} label="Changer de stand"
                onClick={closeThen(onChangeOutlet)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Ligne du menu kebab — icône colorée + libellé + badge optionnel. */
function MenuItem({
  icon, label, badge, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-gray-100 text-left text-sm"
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}
