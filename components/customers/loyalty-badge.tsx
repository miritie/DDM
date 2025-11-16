'use client';

/**
 * Composant - Badge de Fidélité
 * Affiche le tier de fidélité avec style et animation
 */

import { LoyaltyTier } from '@/types/modules';
import { Star, Crown, Award, Gem, Medal } from 'lucide-react';

interface LoyaltyBadgeProps {
  tier: LoyaltyTier;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  animated?: boolean;
}

export function LoyaltyBadge({
  tier,
  size = 'md',
  showIcon = true,
  showLabel = true,
  animated = true,
}: LoyaltyBadgeProps) {
  const tierConfig = {
    bronze: {
      label: 'Bronze',
      icon: Medal,
      gradient: 'from-orange-400 to-orange-600',
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      border: 'border-orange-300',
      emoji: '🥉',
    },
    silver: {
      label: 'Argent',
      icon: Award,
      gradient: 'from-gray-400 to-gray-600',
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-300',
      emoji: '🥈',
    },
    gold: {
      label: 'Or',
      icon: Star,
      gradient: 'from-yellow-400 to-yellow-600',
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      border: 'border-yellow-300',
      emoji: '🥇',
    },
    platinum: {
      label: 'Platine',
      icon: Crown,
      gradient: 'from-blue-400 to-blue-600',
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-300',
      emoji: '💎',
    },
    diamond: {
      label: 'Diamant',
      icon: Gem,
      gradient: 'from-purple-400 to-purple-600',
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      border: 'border-purple-300',
      emoji: '💠',
    },
  };

  const config = tierConfig[tier];
  const Icon = config.icon;

  const sizeClasses = {
    sm: {
      container: 'px-2 py-1 text-xs gap-1',
      icon: 'w-3 h-3',
      emoji: 'text-sm',
    },
    md: {
      container: 'px-3 py-1.5 text-sm gap-1.5',
      icon: 'w-4 h-4',
      emoji: 'text-base',
    },
    lg: {
      container: 'px-4 py-2 text-base gap-2',
      icon: 'w-5 h-5',
      emoji: 'text-lg',
    },
  };

  const sizeClass = sizeClasses[size];

  return (
    <div
      className={`
        inline-flex items-center
        ${sizeClass.container}
        ${config.bg}
        ${config.text}
        border ${config.border}
        rounded-full
        font-semibold
        ${animated ? 'transition-all hover:scale-105 hover:shadow-md' : ''}
      `}
    >
      {showIcon && (
        <span className={sizeClass.emoji}>
          {config.emoji}
        </span>
      )}
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}

/**
 * Composant - Badge de Fidélité Gradient (Version Premium)
 */
export function LoyaltyBadgeGradient({
  tier,
  size = 'md',
  showLabel = true,
  animated = true,
}: Omit<LoyaltyBadgeProps, 'showIcon'>) {
  const tierConfig = {
    bronze: {
      label: 'Bronze',
      gradient: 'from-orange-400 to-orange-600',
      emoji: '🥉',
    },
    silver: {
      label: 'Argent',
      gradient: 'from-gray-400 to-gray-600',
      emoji: '🥈',
    },
    gold: {
      label: 'Or',
      gradient: 'from-yellow-400 to-yellow-600',
      emoji: '🥇',
    },
    platinum: {
      label: 'Platine',
      gradient: 'from-blue-400 to-blue-600',
      emoji: '💎',
    },
    diamond: {
      label: 'Diamant',
      gradient: 'from-purple-400 to-purple-600',
      emoji: '💠',
    },
  };

  const config = tierConfig[tier];

  const sizeClasses = {
    sm: {
      container: 'px-3 py-1 text-xs gap-1.5',
      emoji: 'text-sm',
    },
    md: {
      container: 'px-4 py-2 text-sm gap-2',
      emoji: 'text-base',
    },
    lg: {
      container: 'px-6 py-3 text-base gap-2.5',
      emoji: 'text-lg',
    },
  };

  const sizeClass = sizeClasses[size];

  return (
    <div
      className={`
        inline-flex items-center
        ${sizeClass.container}
        bg-gradient-to-r ${config.gradient}
        text-white
        rounded-full
        font-bold
        shadow-lg
        ${animated ? 'transition-all hover:scale-105 hover:shadow-xl' : ''}
      `}
    >
      <span className={sizeClass.emoji}>{config.emoji}</span>
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}

/**
 * Composant - Progression de Tier
 */
interface TierProgressProps {
  currentTier: LoyaltyTier;
  currentPoints: number;
  currentSpent: number;
  nextTierThreshold?: number;
}

export function TierProgress({
  currentTier,
  currentPoints,
  currentSpent,
  nextTierThreshold,
}: TierProgressProps) {
  const tierThresholds = {
    bronze: { next: 'silver', pointsRequired: 0, spentRequired: 500000 },
    silver: { next: 'gold', pointsRequired: 500, spentRequired: 1000000 },
    gold: { next: 'platinum', pointsRequired: 1500, spentRequired: 2000000 },
    platinum: { next: 'diamond', pointsRequired: 3000, spentRequired: 5000000 },
    diamond: { next: null, pointsRequired: 0, spentRequired: 0 },
  };

  const current = tierThresholds[currentTier];

  if (!current.next) {
    return (
      <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl">
        <p className="text-purple-800 font-semibold">
          Vous êtes au niveau maximum! 💠
        </p>
      </div>
    );
  }

  const progress = Math.min((currentSpent / current.spentRequired) * 100, 100);
  const remaining = current.spentRequired - currentSpent;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <LoyaltyBadge tier={currentTier} size="sm" />
        <span className="text-sm text-gray-600">→</span>
        <LoyaltyBadge tier={current.next as LoyaltyTier} size="sm" />
      </div>

      <div className="relative">
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white drop-shadow-md">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      <p className="text-sm text-center text-gray-600">
        Plus que{' '}
        <span className="font-bold text-blue-600">
          {new Intl.NumberFormat('fr-FR').format(remaining)} F
        </span>{' '}
        pour passer au niveau {current.next}
      </p>
    </div>
  );
}
