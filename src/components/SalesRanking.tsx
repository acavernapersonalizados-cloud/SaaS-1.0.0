import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, Quote } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { periodStart, RANKING_PERIODS, RankingPeriod, RankingSort, salesRanking } from '../lib/salesRanking';
import { TrendingUp } from 'lucide-react';

/**
 * Estacionamento item 23 (2/11/2026): mais vendidos da loja ativa, por quantidade ou faturamento (no Pix), com filtro
 * de período. Lê só os orçamentos do período (em "Tudo", todos os da loja).
 */
export function SalesRanking({ storeId, products }: { storeId: string; products: Product[] }) {
  const [period, setPeriod] = useState<RankingPeriod>('30d');
  const [sort, setSort] = useState<RankingSort>('quantity');
  const [showAll, setShowAll] = useState(false);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const since = useMemo(() => periodStart(period), [period]);

  useEffect(() => {
    setQuotes(null);
    const filters = [where('storeId', '==', storeId), ...(since ? [where('date', '>=', since)] : [])];
    return onSnapshot(
      query(collection(db, 'quotes'), ...filters, orderBy('date', 'desc')),
      snap => setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Quote)),
      err => {
        handleFirestoreError(err, OperationType.LIST, 'quotes');
        setQuotes([]);
      },
    );
  }, [storeId, since]);

  const rows = useMemo(() => {
    const currentNames = Object.fromEntries(products.map(p => [p.id, p.name]));
    return salesRanking(quotes ?? [], { since, sort, currentNames });
  }, [quotes, products, since, sort]);
  const shown = showAll ? rows : rows.slice(0, 10);
  const totals = rows.reduce((t, r) => ({ quantity: t.quantity + r.quantity, revenue: t.revenue + r.revenue }), {
    quantity: 0,
    revenue: 0,
  });

  const chip = (active: boolean) =>
    cn(
      'px-3 py-1.5 rounded-full text-xs font-bold border transition-colors',
      active ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200',
    );

  return (
    <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
      <h2 className="text-base font-bold text-neutral-900 mb-1 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-emerald-500" /> Mais Vendidos
      </h2>
      <p className="text-xs text-neutral-400 mb-4">
        Orçamentos aprovados, em produção e finalizados, pela data do orçamento. Faturamento no Pix.
      </p>

      <div className="flex flex-wrap gap-2 mb-2" role="group" aria-label="Período">
        {RANKING_PERIODS.map(p => (
          <button key={p.value} type="button" className={chip(period === p.value)} onClick={() => setPeriod(p.value)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Ordenar por">
        <button type="button" className={chip(sort === 'quantity')} onClick={() => setSort('quantity')}>
          Por quantidade
        </button>
        <button type="button" className={chip(sort === 'revenue')} onClick={() => setSort('revenue')}>
          Por faturamento
        </button>
      </div>

      {quotes === null ? (
        <div className="h-40 animate-pulse bg-neutral-100 rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="text-neutral-400 italic text-sm py-8 text-center">Nenhuma venda neste período.</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-neutral-400">
                <th className="text-left font-bold pb-2 w-6">#</th>
                <th className="text-left font-bold pb-2">Produto</th>
                <th className="text-right font-bold pb-2 pl-2">Qtd</th>
                <th className="text-right font-bold pb-2 pl-2">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.key} className="border-t border-neutral-100">
                  <td className="py-2 text-xs font-black text-neutral-300">{i + 1}</td>
                  <td className="py-2 font-bold text-neutral-900 max-w-0 truncate" title={r.name}>
                    {r.name}
                  </td>
                  <td className="py-2 pl-2 text-right font-black text-neutral-700 whitespace-nowrap">{r.quantity}</td>
                  <td className="py-2 pl-2 text-right font-bold text-neutral-700 whitespace-nowrap">
                    {formatCurrency(r.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-200 text-neutral-500">
                <td />
                <td className="py-2 text-xs font-bold">Total ({rows.length} produtos)</td>
                <td className="py-2 pl-2 text-right text-xs font-black whitespace-nowrap">{totals.quantity}</td>
                <td className="py-2 pl-2 text-right text-xs font-black whitespace-nowrap">
                  {formatCurrency(totals.revenue)}
                </td>
              </tr>
            </tfoot>
          </table>
          {rows.length > 10 && (
            <button
              type="button"
              className="mt-3 text-xs font-bold text-neutral-600 underline"
              onClick={() => setShowAll(v => !v)}
            >
              {showAll ? 'Mostrar só os 10 primeiros' : `Ver todos (${rows.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
