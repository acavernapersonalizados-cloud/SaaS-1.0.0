import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Quote, Material, Product, CostBase } from '../types';
import { formatCurrency, formatPercent, cn } from '../lib/utils';
import { calcCatalogKPIs, calcProductPricing, getProfitStatus } from '../lib/pricingEngine';
import { useStore } from '../contexts/StoreContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  TrendingUp, DollarSign, PieChart, Clock, AlertCircle,
  ArrowRight, Package, ShoppingBag, TrendingDown, Star, Zap
} from 'lucide-react';

export function Dashboard() {
  const { activeStore } = useStore();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [costs, setCosts] = useState<CostBase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeStore) { setLoading(false); return; }

    const unsubQ = onSnapshot(
      query(collection(db, 'quotes'), where('storeId', '==', activeStore.id), orderBy('date', 'desc'), limit(100)),
      snap => { setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quote))); setLoading(false); },
      err => { handleFirestoreError(err, OperationType.LIST, 'quotes'); setLoading(false); }
    );

    const unsubP = onSnapshot(
      query(collection(db, 'products'), where('storeId', '==', activeStore.id)),
      snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product))),
      err => handleFirestoreError(err, OperationType.LIST, 'products')
    );

    const unsubM = onSnapshot(
      query(collection(db, 'materials'), where('storeId', '==', activeStore.id)),
      snap => setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material))),
      err => handleFirestoreError(err, OperationType.LIST, 'materials')
    );

    const unsubC = onSnapshot(doc(db, 'costBases', activeStore.id),
      snap => { if (snap.exists()) setCosts(snap.data() as CostBase); else setCosts(null); },
      () => {}
    );

    return () => { unsubQ(); unsubP(); unsubM(); unsubC(); };
  }, [activeStore]);

  // ── KPIs from quotes ──────────────────────────────────────────────────────
  const approvedQuotes = quotes.filter(q => q.status === 'Aprovado' || q.status === 'Em produção' || q.status === 'Finalizado');
  const pendingQuotes = quotes.filter(q => q.status === 'Pendente');

  const totalRevenue = approvedQuotes.reduce((a, q) => a + (q.totalAmount || 0), 0);
  const totalProfit = approvedQuotes.reduce((a, q) => a + (q.totalProfit || 0), 0);
  const avgMargin = approvedQuotes.length > 0
    ? approvedQuotes.reduce((a, q) => a + (q.avgMargin || 0), 0) / approvedQuotes.length
    : 0;
  const pendingRevenue = pendingQuotes.reduce((a, q) => a + (q.totalAmount || 0), 0);

  // ── Catalog KPIs ──────────────────────────────────────────────────────────
  const kpis = calcCatalogKPIs(products, materials, costs);

  // ── Low stock ─────────────────────────────────────────────────────────────
  const lowStockItems = materials.filter(m => (m.stockQuantity || 0) <= (m.minStockQuantity || 0) && (m.minStockQuantity || 0) > 0);

  // ── Chart: top products by revenue ───────────────────────────────────────
  const productRevenue: Record<string, number> = {};
  quotes.forEach(q => (q.items || []).forEach(item => {
    productRevenue[item.productName] = (productRevenue[item.productName] || 0) + item.totalPrice;
  }));
  const chartData = Object.entries(productRevenue)
    .map(([name, value]) => ({ name: name.length > 16 ? name.slice(0, 14) + '…' : name, value }))
    .sort((a, b) => b.value - a.value).slice(0, 6);

  const COLORS = ['#171717', '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4'];

  if (loading) return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-28 bg-neutral-200 rounded-2xl"/>)}</div>
      <div className="h-80 bg-neutral-200 rounded-2xl"/>
    </div>
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Dashboard</h1>
        <p className="text-neutral-500 mt-1">Visão financeira completa do seu ateliê.</p>
      </header>

      {/* ── KPIs principais ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Faturamento Aprovado', value: formatCurrency(totalRevenue), icon: DollarSign, color: 'text-neutral-900', sub: `${approvedQuotes.length} orçamentos` },
          { label: 'Lucro Total', value: formatCurrency(totalProfit), icon: TrendingUp, color: 'text-emerald-600', sub: `${avgMargin.toFixed(1)}% margem média` },
          { label: 'Pendente de Aprovação', value: formatCurrency(pendingRevenue), icon: Clock, color: 'text-amber-500', sub: `${pendingQuotes.length} orçamentos` },
          { label: 'Produtos Cadastrados', value: products.length, icon: Package, color: 'text-blue-600', sub: `${kpis.productsWithPrice} com preço` },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider leading-tight">{stat.label}</span>
              <stat.icon className={cn('w-4 h-4', stat.color)} />
            </div>
            <p className="text-2xl font-black text-neutral-900">{stat.value}</p>
            <p className="text-xs text-neutral-400 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Alertas ─────────────────────────────────────────────────────────── */}
      {(kpis.productsWithLoss > 0 || kpis.productsWithoutPrice > 0 || lowStockItems.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {kpis.productsWithLoss > 0 && (
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-2xl border border-red-100">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-sm font-bold text-red-800">{kpis.productsWithLoss} produto{kpis.productsWithLoss > 1 ? 's' : ''} com prejuízo</p>
                <p className="text-xs text-red-600 mt-0.5">Preço abaixo do custo de produção.</p>
              </div>
            </div>
          )}
          {kpis.productsWithoutPrice > 0 && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-sm font-bold text-amber-800">{kpis.productsWithoutPrice} sem preço definido</p>
                <p className="text-xs text-amber-600 mt-0.5">Configure a Base de Custos e defina preços.</p>
              </div>
            </div>
          )}
          {lowStockItems.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-2xl border border-orange-100">
              <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="text-sm font-bold text-orange-800">{lowStockItems.length} material{lowStockItems.length > 1 ? 'is' : ''} com estoque baixo</p>
                <p className="text-xs text-orange-600 mt-0.5">{lowStockItems.map(m => m.name).slice(0,2).join(', ')}{lowStockItems.length > 2 ? '…' : ''}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Gráficos ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Produtos por faturamento */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <h2 className="text-base font-bold text-neutral-900 mb-5">Top Produtos por Faturamento</h2>
          {chartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f5f5f5"/>
                  <XAxis type="number" tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/>
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: 12 }}/>
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-64 flex items-center justify-center text-neutral-400 italic text-sm">Nenhum orçamento aprovado.</div>}
        </div>

        {/* Saúde do catálogo */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <h2 className="text-base font-bold text-neutral-900 mb-5">Saúde do Catálogo</h2>
          {costs && products.length > 0 ? (
            <div className="space-y-3">
              {[
                { label: '🟢 Excelente', count: kpis.productsExcellent, color: 'bg-emerald-500' },
                { label: '🟡 Bom', count: kpis.productsGood, color: 'bg-blue-400' },
                { label: '🟠 Margem Baixa', count: kpis.productsLowMargin, color: 'bg-amber-400' },
                { label: '🔴 Arriscado', count: kpis.productsRisky, color: 'bg-orange-500' },
                { label: '⛔ Prejuízo', count: kpis.productsWithLoss, color: 'bg-red-500' },
                { label: '⚪ Sem Preço', count: kpis.productsWithoutPrice, color: 'bg-neutral-300' },
              ].filter(r => r.count > 0).map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="w-24 text-xs font-bold text-neutral-600 truncate">{row.label}</div>
                  <div className="flex-1 bg-neutral-100 rounded-full h-2">
                    <div className={`${row.color} h-2 rounded-full transition-all`} style={{ width: `${(row.count / products.length) * 100}%` }}/>
                  </div>
                  <span className="text-xs font-black text-neutral-700 w-6 text-right">{row.count}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-neutral-100 grid grid-cols-2 gap-3">
                <div className="p-3 bg-neutral-50 rounded-xl text-center">
                  <p className="text-[10px] text-neutral-400 font-bold uppercase">Margem Média</p>
                  <p className="text-lg font-black text-neutral-900">{kpis.avgMargin.toFixed(1)}%</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl text-center">
                  <p className="text-[10px] text-emerald-600 font-bold uppercase">Lucro Médio/und</p>
                  <p className="text-lg font-black text-emerald-700">{formatCurrency(kpis.avgProfit)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-neutral-400">
              <PieChart className="w-8 h-8"/>
              <p className="text-sm italic">{!costs ? 'Configure a Base de Custos para ver dados.' : 'Nenhum produto cadastrado.'}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Produtos mais e menos lucrativos ─────────────────────────────────── */}
      {costs && kpis.mostProfitable.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Star className="w-4 h-4 text-emerald-600"/>
              <h2 className="text-base font-bold text-neutral-900">Mais Lucrativos</h2>
            </div>
            <div className="space-y-3">
              {kpis.mostProfitable.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-neutral-300 w-4">{i + 1}</span>
                    <span className="text-sm font-bold text-neutral-800 truncate max-w-[160px]">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-500">{p.margin.toFixed(1)}%</span>
                    <span className="text-sm font-black text-emerald-700">{formatCurrency(p.profit)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <TrendingDown className="w-4 h-4 text-red-500"/>
              <h2 className="text-base font-bold text-neutral-900">Menos Lucrativos</h2>
            </div>
            <div className="space-y-3">
              {kpis.leastProfitable.map((p, i) => {
                const st = getProfitStatus(p.margin);
                return (
                  <div key={p.name} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-neutral-300 w-4">{i + 1}</span>
                      <span className="text-sm font-bold text-neutral-800 truncate max-w-[140px]">{p.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${st.badge}`}>{st.emoji}</span>
                    </div>
                    <span className={`text-sm font-black ${p.profit >= 0 ? 'text-neutral-600' : 'text-red-600'}`}>{formatCurrency(p.profit)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Últimos orçamentos ───────────────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
        <h2 className="text-base font-bold text-neutral-900 mb-5">Últimos Orçamentos</h2>
        <div className="space-y-3">
          {quotes.slice(0, 6).map(quote => (
            <div key={quote.id} className="flex items-center justify-between p-4 rounded-xl border border-neutral-100 hover:bg-neutral-50 transition-colors">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-neutral-900">
                    {quote.items?.[0]?.productName || 'Vários itens'}{quote.items?.length > 1 ? ` +${quote.items.length - 1}` : ''}
                  </span>
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold uppercase',
                    quote.status === 'Aprovado' ? 'bg-emerald-100 text-emerald-700' :
                    quote.status === 'Em produção' ? 'bg-blue-100 text-blue-700' :
                    quote.status === 'Finalizado' ? 'bg-neutral-100 text-neutral-600' : 'bg-amber-100 text-amber-700')}>
                    {quote.status || 'Pendente'}
                  </span>
                </div>
                <span className="text-xs text-neutral-400">{quote.clientName} · {new Date(quote.date).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-neutral-900">{formatCurrency(quote.totalAmount)}</p>
                <p className="text-xs text-emerald-600 font-bold">{formatCurrency(quote.totalProfit)} lucro</p>
              </div>
            </div>
          ))}
          {quotes.length === 0 && <p className="text-center py-10 text-neutral-400 italic text-sm">Nenhum orçamento encontrado.</p>}
        </div>
      </div>
    </div>
  );
}
