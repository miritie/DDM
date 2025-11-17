'use client';

/**
 * Page - Dashboard Analytics avec KPIs et Graphiques
 * Module Rapports & Analytics
 */

import { useEffect, useState } from 'react';
import { GlobalDashboard, DashboardKPI } from '@/types/modules';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, DollarSign, ShoppingCart, Users, Package } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function AnalyticsPage() {
  const [dashboard, setDashboard] = useState<GlobalDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range - default to current month
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadDashboard();
  }, [startDate, endDate]);

  async function loadDashboard() {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports/dashboard?startDate=${startDate}&endDate=${endDate}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors du chargement du dashboard');
      }

      setDashboard(result.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(value);
  }

  function formatNumber(value: number): string {
    return new Intl.NumberFormat('fr-FR').format(value);
  }

  function formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  function formatKPIValue(kpi: DashboardKPI): string {
    switch (kpi.format) {
      case 'currency':
        return formatCurrency(kpi.value);
      case 'percentage':
        return formatPercentage(kpi.value);
      default:
        return formatNumber(kpi.value);
    }
  }

  function getTrendIcon(trend: 'up' | 'down' | 'stable') {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  }

  function getKPIIcon(label: string) {
    if (label.includes('Chiffre')) return <DollarSign className="h-8 w-8 text-green-600" />;
    if (label.includes('Ventes')) return <ShoppingCart className="h-8 w-8 text-blue-600" />;
    if (label.includes('Clients') || label.includes('Employés')) return <Users className="h-8 w-8 text-purple-600" />;
    if (label.includes('Stock')) return <Package className="h-8 w-8 text-orange-600" />;
    return <DollarSign className="h-8 w-8 text-gray-600" />;
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  // Prepare chart data
  const revenueExpensesData = dashboard.charts.revenueVsExpenses.labels.map((label, index) => ({
    month: label,
    revenus: dashboard.charts.revenueVsExpenses.datasets[0].data[index],
    depenses: dashboard.charts.revenueVsExpenses.datasets[1].data[index],
  }));

  const salesTrendData = dashboard.charts.salesTrend.labels.map((label, index) => ({
    date: label,
    ventes: dashboard.charts.salesTrend.datasets[0].data[index],
  }));

  const topProductsData = dashboard.charts.topProducts.labels.map((label, index) => ({
    name: label,
    value: dashboard.charts.topProducts.datasets[0].data[index],
  }));

  const expensesCategoryData = dashboard.charts.expensesByCategory.labels.map((label, index) => ({
    name: label,
    value: dashboard.charts.expensesByCategory.datasets[0].data[index],
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard Analytics</h1>
        <div className="flex gap-4">
          <div>
            <label className="text-sm text-gray-600">Du</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="ml-2 border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Au</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="ml-2 border rounded px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(dashboard.kpis).map(([key, kpi]) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {kpi.label}
              </CardTitle>
              {getKPIIcon(kpi.label)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatKPIValue(kpi)}</div>
              {kpi.previousValue !== undefined && (
                <div className="flex items-center gap-2 mt-2 text-sm">
                  {getTrendIcon(kpi.trend)}
                  <span className={kpi.trend === 'up' ? 'text-green-600' : kpi.trend === 'down' ? 'text-red-600' : 'text-gray-500'}>
                    {kpi.changePercent !== undefined && `${kpi.changePercent > 0 ? '+' : ''}${kpi.changePercent.toFixed(1)}%`}
                  </span>
                  <span className="text-gray-500">vs période précédente</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Expenses */}
        <Card>
          <CardHeader>
            <CardTitle>Revenus vs Dépenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueExpensesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Bar dataKey="revenus" fill="#10b981" name="Revenus" />
                <Bar dataKey="depenses" fill="#ef4444" name="Dépenses" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sales Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tendance des Ventes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Line type="monotone" dataKey="ventes" stroke="#3b82f6" name="Ventes" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Produits</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={topProductsData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {topProductsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Dépenses par Catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expensesCategoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expensesCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
