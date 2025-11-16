'use client';

/**
 * Composant - Recherche rapide de clients (Mobile-First)
 * Optimisé pour utilisation tactile sur le terrain
 */

import { useState, useEffect, useRef } from 'react';
import { Search, Phone, User, Building2, X } from 'lucide-react';
import { Customer } from '@/types/modules';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface CustomerQuickSearchProps {
  onSelectCustomer: (customer: Customer) => void;
  placeholder?: string;
  autoFocus?: boolean;
  showCreateNew?: boolean;
  onCreateNew?: () => void;
}

export function CustomerQuickSearch({
  onSelectCustomer,
  placeholder = 'Rechercher un client...',
  autoFocus = false,
  showCreateNew = true,
  onCreateNew,
}: CustomerQuickSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const searchCustomers = async () => {
      if (query.length < 2) {
        setResults([]);
        setShowResults(false);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/customers?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.data || []);
          setShowResults(true);
        }
      } catch (error) {
        console.error('Erreur recherche clients:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchCustomers, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (customer: Customer) => {
    onSelectCustomer(customer);
    setQuery('');
    setShowResults(false);
  };

  const getLoyaltyBadgeColor = (tier: string) => {
    const colors = {
      bronze: 'bg-orange-100 text-orange-800',
      silver: 'bg-gray-100 text-gray-800',
      gold: 'bg-yellow-100 text-yellow-800',
      platinum: 'bg-blue-100 text-blue-800',
      diamond: 'bg-purple-100 text-purple-800',
    };
    return colors[tier as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="relative w-full">
      {/* Input de recherche */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-12 pr-12 h-14 text-lg rounded-xl border-2 focus:border-blue-500"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setShowResults(false);
            }}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Résultats de recherche */}
      {showResults && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border-2 border-gray-100 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2">Recherche en cours...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {results.map((customer) => (
                <button
                  key={customer.CustomerId}
                  onClick={() => handleSelect(customer)}
                  className="w-full p-4 hover:bg-blue-50 transition-colors text-left active:bg-blue-100"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                      {customer.Type === 'business' ? (
                        <Building2 className="w-6 h-6" />
                      ) : (
                        <User className="w-6 h-6" />
                      )}
                    </div>

                    {/* Infos client */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-base">
                          {customer.FullName}
                        </p>
                        <Badge className={`text-xs ${getLoyaltyBadgeColor(customer.LoyaltyTier)}`}>
                          {customer.LoyaltyTier}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span>{customer.Phone}</span>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="font-medium text-blue-600">
                          {customer.LoyaltyPoints} pts
                        </span>
                        <span>{customer.TotalOrders} achats</span>
                        <span className="font-semibold">
                          {new Intl.NumberFormat('fr-FR').format(customer.TotalSpent)} F
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-500 mb-4">Aucun client trouvé</p>
              {showCreateNew && onCreateNew && (
                <button
                  onClick={onCreateNew}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Créer un nouveau client
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
