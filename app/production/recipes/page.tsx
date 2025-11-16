'use client';

/**
 * Page - Liste des Recettes (Mobile-First)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Plus,
  Filter,
  X,
  Search,
  Beaker,
} from 'lucide-react';
import { Recipe, Product } from '@/types/modules';
import { RecipeCard } from '@/components/production/recipe-card';
import { Button } from '@/components/ui/button';

interface RecipeStatistics {
  totalRecipes: number;
  activeRecipes: number;
  avgYieldRate: number;
  totalIngredients: number;
}

export default function RecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [statistics, setStatistics] = useState<RecipeStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    isActive?: boolean;
    search?: string;
  }>({});

  useEffect(() => {
    loadRecipes();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [recipes, filters]);

  async function loadRecipes() {
    try {
      setLoading(true);

      const [recipesRes, productsRes, statsRes] = await Promise.all([
        fetch('/api/production/recipes'),
        fetch('/api/products?isActive=true'),
        fetch('/api/production/recipes/statistics'),
      ]);

      if (recipesRes.ok) {
        const recipesData = await recipesRes.json();
        setRecipes(recipesData.data || []);
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData.data || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistics(statsData.data);
      }
    } catch (error) {
      console.error('Erreur chargement recettes:', error);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...recipes];

    if (filters.isActive !== undefined) {
      filtered = filtered.filter((r) => r.IsActive === filters.isActive);
    }

    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.Name.toLowerCase().includes(query) ||
          r.RecipeNumber.toLowerCase().includes(query) ||
          r.ProductName?.toLowerCase().includes(query)
      );
    }

    setFilteredRecipes(filtered);
  }

  function clearFilters() {
    setFilters({});
  }

  const hasActiveFilters = Object.keys(filters).some(
    (key) => filters[key as keyof typeof filters] !== undefined
  );

  // Récupérer l'image du produit
  function getProductImage(productId: string): string | undefined {
    return (products.find((p) => p.ProductId === productId) as any)?.ImageUrl;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-7 h-7" />
              Recettes
            </h1>

            <Button
              onClick={() => router.push('/production/recipes/new')}
              className="bg-white text-purple-600 hover:bg-purple-50 h-12 px-6 rounded-xl font-semibold shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nouvelle
            </Button>
          </div>

          {/* KPIs */}
          {statistics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm opacity-90">Total</span>
                </div>
                <p className="text-3xl font-bold">{statistics.totalRecipes}</p>
                <p className="text-xs opacity-80 mt-1">Recettes</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Beaker className="w-5 h-5" />
                  <span className="text-sm opacity-90">Actives</span>
                </div>
                <p className="text-3xl font-bold">{statistics.activeRecipes}</p>
                <p className="text-xs opacity-80 mt-1">En production</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm opacity-90">Ingrédients</span>
                </div>
                <p className="text-3xl font-bold">{statistics.totalIngredients}</p>
                <p className="text-xs opacity-80 mt-1">Total utilisés</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm opacity-90">Rendement</span>
                </div>
                <p className="text-3xl font-bold">{statistics.avgYieldRate}%</p>
                <p className="text-xs opacity-80 mt-1">Moyen</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 -mt-4">
        {/* Barre de recherche et filtres */}
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Rechercher une recette..."
              className="w-full pl-12 pr-24 h-12 text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 px-4 h-9 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                showFilters || hasActiveFilters
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filtres
            </button>
          </div>

          {/* Filtres dépliables */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statut
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      setFilters({
                        ...filters,
                        isActive: filters.isActive === true ? undefined : true,
                      })
                    }
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filters.isActive === true
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Actives
                  </button>
                  <button
                    onClick={() =>
                      setFilters({
                        ...filters,
                        isActive: filters.isActive === false ? undefined : false,
                      })
                    }
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filters.isActive === false
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Inactives
                  </button>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg font-medium flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Effacer les filtres
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Compteur */}
        <div className="mb-4 px-2">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">
              {filteredRecipes.length}
            </span>{' '}
            {filteredRecipes.length > 1 ? 'recettes trouvées' : 'recette trouvée'}
          </p>
        </div>

        {/* Grille de recettes */}
        {filteredRecipes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.RecipeId}
                recipe={recipe}
                onClick={() => router.push(`/production/recipes/${recipe.RecipeId}`)}
                showDetails={true}
                productImage={getProductImage(recipe.ProductId)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl shadow">
            <Beaker className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Aucune recette trouvée</p>
            <Button
              onClick={() => router.push('/production/recipes/new')}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Créer une recette
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
