/**
 * Composant - ProductVisualCard (Mobile-First)
 * Carte produit avec IMAGE pour sélection visuelle rapide
 * Optimisé pour terrain: stands, dépôts, entrepôts, production
 */

'use client';

import { Product } from '@/types/modules';
import { Package, AlertTriangle, CheckCircle, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface ProductVisualCardProps {
  product: Product;
  stockQuantity?: number;
  minimumStock?: number;
  warehouseName?: string;
  onClick?: () => void;
  onQuickAction?: () => void;
  selected?: boolean;
  showStock?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ProductVisualCard({
  product,
  stockQuantity,
  minimumStock,
  warehouseName,
  onClick,
  onQuickAction,
  selected = false,
  showStock = true,
  size = 'md',
}: ProductVisualCardProps) {
  // Déterminer le statut du stock
  const getStockStatus = () => {
    if (stockQuantity === undefined) return null;
    if (stockQuantity === 0) return 'out';
    if (minimumStock && stockQuantity <= minimumStock) return 'low';
    return 'ok';
  };

  const stockStatus = getStockStatus();

  // Configuration taille
  const sizeConfig = {
    sm: {
      card: 'h-24',
      image: 'w-16 h-16',
      text: 'text-xs',
      title: 'text-sm',
      badge: 'text-[10px] px-1.5 py-0.5',
    },
    md: {
      card: 'h-32',
      image: 'w-24 h-24',
      text: 'text-sm',
      title: 'text-base',
      badge: 'text-xs px-2 py-1',
    },
    lg: {
      card: 'h-40',
      image: 'w-32 h-32',
      text: 'text-base',
      title: 'text-lg',
      badge: 'text-sm px-3 py-1',
    },
  };

  const config = sizeConfig[size];

  // Badge statut stock
  const getStockBadge = () => {
    if (!showStock || stockStatus === null) return null;

    const badges = {
      out: {
        bg: 'bg-red-100 border-red-300 text-red-800',
        icon: AlertTriangle,
        label: 'Rupture',
      },
      low: {
        bg: 'bg-orange-100 border-orange-300 text-orange-800',
        icon: AlertTriangle,
        label: 'Stock faible',
      },
      ok: {
        bg: 'bg-green-100 border-green-300 text-green-800',
        icon: CheckCircle,
        label: 'En stock',
      },
    };

    const badge = badges[stockStatus];
    const Icon = badge.icon;

    return (
      <div
        className={`absolute top-2 right-2 flex items-center gap-1 ${config.badge} font-semibold rounded-full border-2 ${badge.bg} backdrop-blur-sm`}
      >
        <Icon className="w-3 h-3" />
        {stockQuantity}
      </div>
    );
  };

  return (
    <div
      className={`relative bg-white rounded-2xl shadow-md overflow-hidden transition-all ${config.card} ${
        onClick ? 'cursor-pointer hover:shadow-xl active:scale-95' : ''
      } ${
        selected
          ? 'ring-4 ring-blue-500 shadow-xl scale-105'
          : 'hover:scale-102'
      }`}
      onClick={onClick}
    >
      {/* Badge stock */}
      {getStockBadge()}

      {/* Badge sélection */}
      {selected && (
        <div className="absolute top-2 left-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
          <CheckCircle className="w-4 h-4 text-white" />
        </div>
      )}

      <div className="flex items-center gap-3 p-3 h-full">
        {/* Image produit */}
        <div
          className={`${config.image} flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center border-2 border-gray-200`}
        >
          {(product as any).ImageUrl ? (
            <Image
              src={(product as any).ImageUrl}
              alt={product.Name}
              width={128}
              height={128}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback si image ne charge pas
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-400">
              <ImageIcon className="w-8 h-8 mb-1" />
              <span className="text-[10px]">Pas d'image</span>
            </div>
          )}
        </div>

        {/* Informations */}
        <div className="flex-1 min-w-0">
          <h3
            className={`font-bold text-gray-900 truncate ${config.title}`}
          >
            {product.Name}
          </h3>

          {(product as any).SKU && (
            <p className={`text-gray-500 ${config.text}`}>
              Réf: {(product as any).SKU}
            </p>
          )}

          {warehouseName && (
            <div className="flex items-center gap-1 mt-1">
              <Package className="w-3 h-3 text-gray-400" />
              <p className={`text-gray-600 truncate ${config.text}`}>
                {warehouseName}
              </p>
            </div>
          )}

          {/* Prix */}
          {(product as any).SalePrice && (
            <p className={`font-semibold text-blue-700 mt-1 ${config.text}`}>
              {new Intl.NumberFormat('fr-FR').format((product as any).SalePrice)} F
            </p>
          )}
        </div>

        {/* Action rapide */}
        {onQuickAction && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickAction();
            }}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 flex items-center justify-center transition-all"
          >
            <Package className="w-5 h-5 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}
