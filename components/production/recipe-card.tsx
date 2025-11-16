/**
 * Composant - RecipeCard (Mobile-First)
 * Carte visuelle pour afficher une recette de production
 */

'use client';

import { Recipe } from '@/types/modules';
import {
  FileText,
  Clock,
  TrendingUp,
  Package,
  ChevronRight,
  CheckCircle,
  Beaker,
} from 'lucide-react';
import Image from 'next/image';

interface RecipeCardProps {
  recipe: Recipe;
  onClick?: () => void;
  showDetails?: boolean;
  productImage?: string;
}

export function RecipeCard({
  recipe,
  onClick,
  showDetails = true,
  productImage,
}: RecipeCardProps) {
  const ingredientsCount = recipe.Lines?.length || 0;
  const estimatedHours = Math.floor(recipe.EstimatedDuration / 60);
  const estimatedMinutes = recipe.EstimatedDuration % 60;

  // Couleur selon status
  const statusColor = recipe.IsActive
    ? 'from-green-500 to-emerald-600'
    : 'from-gray-400 to-gray-600';

  return (
    <div
      className={`bg-white rounded-2xl shadow-md overflow-hidden transition-all ${
        onClick
          ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
          : ''
      }`}
      onClick={onClick}
    >
      {/* Header avec image produit */}
      <div className={`bg-gradient-to-r ${statusColor} p-4`}>
        <div className="flex items-start gap-3">
          {/* Image produit */}
          {productImage ? (
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/20 backdrop-blur-sm flex-shrink-0">
              <Image
                src={productImage}
                alt={recipe.ProductName || 'Produit'}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Beaker className="w-8 h-8 text-white" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-lg line-clamp-1">
              {recipe.Name}
            </h3>
            <p className="text-white/90 text-sm line-clamp-1">
              {recipe.RecipeNumber}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-semibold text-white">
                v{recipe.Version}
              </span>
              {recipe.IsActive && (
                <span className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-semibold text-white flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Active
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 space-y-3">
        {/* Produit fini */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-gray-600">Produit Fini</span>
          </div>
          <p className="font-semibold text-lg text-purple-900">
            {recipe.ProductName || 'Produit'}
          </p>
          <p className="text-sm text-purple-700 mt-1">
            {recipe.OutputQuantity} {recipe.OutputUnit} par batch
          </p>
        </div>

        {showDetails && (
          <>
            {/* Statistiques */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <FileText className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                <p className="text-xs text-gray-600">Ingrédients</p>
                <p className="text-xl font-bold text-blue-700">{ingredientsCount}</p>
              </div>

              <div className="bg-orange-50 rounded-xl p-3 text-center">
                <Clock className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                <p className="text-xs text-gray-600">Durée</p>
                <p className="text-lg font-bold text-orange-700">
                  {estimatedHours > 0 && `${estimatedHours}h`}
                  {estimatedMinutes > 0 && `${estimatedMinutes}m`}
                  {estimatedHours === 0 && estimatedMinutes === 0 && '-'}
                </p>
              </div>

              <div className="bg-green-50 rounded-xl p-3 text-center">
                <TrendingUp className="w-5 h-5 text-green-600 mx-auto mb-1" />
                <p className="text-xs text-gray-600">Rendement</p>
                <p className="text-xl font-bold text-green-700">{recipe.YieldRate}%</p>
              </div>
            </div>

            {/* Liste ingrédients (preview) */}
            {ingredientsCount > 0 && (
              <div className="border-t pt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Ingrédients principaux
                </p>
                <div className="space-y-2">
                  {recipe.Lines.slice(0, 3).map((line) => (
                    <div
                      key={line.RecipeLineId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700 line-clamp-1">
                        {line.IngredientName || `Ingrédient ${line.IngredientId}`}
                      </span>
                      <span className="font-semibold text-gray-900 ml-2 whitespace-nowrap">
                        {line.Quantity} {line.Unit}
                      </span>
                    </div>
                  ))}
                  {ingredientsCount > 3 && (
                    <p className="text-xs text-gray-500 italic">
                      +{ingredientsCount - 3} autre(s) ingrédient(s)
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Instructions preview */}
            {recipe.Instructions && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-600 mb-1">Instructions</p>
                <p className="text-sm text-gray-700 line-clamp-2">
                  {recipe.Instructions}
                </p>
              </div>
            )}
          </>
        )}

        {/* Indicateur pour voir plus */}
        {onClick && (
          <div className="flex items-center justify-center text-purple-600 pt-2">
            <FileText className="w-4 h-4 mr-1" />
            <span className="text-sm font-medium">Voir la recette</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}
