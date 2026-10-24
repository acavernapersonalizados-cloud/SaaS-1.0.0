// Lista de produtos (Etapa 8A): visão em tabela e em cartões, só exibição.
// Os dados (filtro, ordenação e preços) vêm calculados de Products.tsx.
import React from 'react';
import { Category, CostBase, Product, SalesChannel } from '../types';
import { suggestedPriceByChannel } from '../lib/channels';
import { formatCurrency, formatPercent } from '../lib/utils';
import { markupOf, ProductPricingResult } from '../lib/pricingEngine';
import { categoryNames } from '../hooks/useCategories';
import { AlertCircle, ArrowUpDown, Box, CheckCircle2, Clock, Edit2, Layers, Trash2 } from 'lucide-react';

export type SortField = 'name' | 'cost' | 'price' | 'margin' | 'profit';
export type ProductRow = { product: Product; pricing: ProductPricingResult };

interface ListProps {
  filteredAndSorted: ProductRow[];
  categories: Category[];
  canDelete: boolean;
  handleEdit: (product: Product) => void;
  setProductToDelete: (id: string) => void;
}

export function ProductTable({
  filteredAndSorted,
  categories,
  canDelete,
  handleEdit,
  setProductToDelete,
  sortField,
  handleSort,
}: ListProps & { sortField: SortField; handleSort: (field: SortField) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              {[
                { label: 'Produto', field: 'name' },
                { label: 'Categoria', field: null },
                { label: 'Custo', field: 'cost' },
                { label: 'Preço', field: 'price' },
                { label: 'Lucro/und', field: 'profit' },
                { label: 'Margem', field: 'margin' },
                { label: 'Status', field: null },
                { label: '', field: null },
              ].map(col => (
                <th
                  key={col.label}
                  className="text-left px-4 py-3 text-[10px] font-black text-neutral-400 uppercase tracking-wider"
                >
                  {col.field ? (
                    <button
                      onClick={() => handleSort(col.field as SortField)}
                      className="flex items-center gap-1 hover:text-neutral-900 transition-colors"
                    >
                      {col.label}
                      <ArrowUpDown
                        className={`w-3 h-3 ${sortField === col.field ? 'text-neutral-900' : 'text-neutral-300'}`}
                      />
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {filteredAndSorted.map(({ product: p, pricing }) => (
              <tr key={p.id} className="hover:bg-neutral-50 transition-colors group">
                <td className="px-4 py-3 font-bold text-neutral-900">{p.name}</td>
                <td className="px-4 py-3 text-neutral-500 text-xs">
                  {categoryNames(p.categoryIds, categories).join(', ') || p.category}
                </td>
                <td className="px-4 py-3 font-mono text-neutral-600 text-xs">
                  {pricing.hasCosts ? formatCurrency(pricing.totalCost) : '—'}
                </td>
                <td className="px-4 py-3 font-bold text-neutral-900">
                  {pricing.effectivePrice > 0 ? (
                    formatCurrency(pricing.effectivePrice)
                  ) : (
                    <span className="text-amber-500 text-xs">Sem preço</span>
                  )}
                </td>
                <td
                  className={`px-4 py-3 font-bold text-xs ${pricing.profitPerUnit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                >
                  {pricing.effectivePrice > 0 ? formatCurrency(pricing.profitPerUnit) : '—'}
                </td>
                <td className="px-4 py-3">
                  {pricing.effectivePrice > 0 ? (
                    <span
                      className={`text-xs font-bold ${pricing.profitPerUnit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                    >
                      {pricing.margin.toFixed(1)}%
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3">
                  {pricing.effectivePrice > 0 && (
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${pricing.profitStatus.badge}`}>
                      {pricing.profitStatus.emoji} {pricing.profitStatus.label}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleEdit(p)}
                      className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setProductToDelete(p.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-neutral-400 italic">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProductCards({
  filteredAndSorted,
  categories,
  canDelete,
  handleEdit,
  setProductToDelete,
  costs,
}: ListProps & { costs: CostBase | null }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {filteredAndSorted.map(({ product: p, pricing }) => (
        <div
          key={p.id}
          className="bg-white p-6 rounded-2xl border border-neutral-200 hover:border-neutral-400 transition-all group relative flex flex-col"
        >
          {/* Delete btn */}
          {canDelete && (
            <button
              onClick={() => setProductToDelete(p.id)}
              className="absolute top-4 right-4 p-1.5 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${pricing.effectivePrice > 0 ? pricing.profitStatus.bg : 'bg-neutral-100'}`}
            >
              <Box
                className={`w-5 h-5 ${pricing.effectivePrice > 0 ? pricing.profitStatus.color : 'text-neutral-400'}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-neutral-900 truncate">{p.name}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-neutral-400 uppercase tracking-wider font-bold">
                  {categoryNames(p.categoryIds, categories).join(' · ') || p.category}
                </span>
                {p.isPackage && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                    Pacote {p.packageQuantity}
                  </span>
                )}
                {pricing.effectivePrice > 0 && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${pricing.profitStatus.badge}`}>
                    {pricing.profitStatus.emoji} {pricing.profitStatus.label}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="flex items-center gap-1.5 text-neutral-500">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{p.productionTime} min</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-500">
              <Layers className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{p.materials?.length || 0} materiais</span>
            </div>
          </div>

          {/* Financial data */}
          <div className="mt-auto pt-4 border-t border-neutral-100 space-y-2">
            {pricing.hasCosts ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Custo</span>
                  <span className="text-xs font-bold text-neutral-500">{formatCurrency(pricing.totalCost)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">
                    Sugerido (markup {costs ? formatPercent(markupOf(costs)) : '?'})
                  </span>
                  {pricing.invalidProfitGoal ? (
                    <span className="text-[10px] font-bold text-red-600 text-right">
                      Meta inválida — ajuste na Base de Custos
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-600">{formatCurrency(pricing.suggestedPrice)}</span>
                  )}
                </div>
                {pricing.manualPrice != null && pricing.manualPrice > 0 && (
                  <div
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border ${pricing.profitStatus.bg} ${pricing.profitStatus.border}`}
                  >
                    <span className={`text-[10px] font-bold uppercase ${pricing.profitStatus.color}`}>
                      Preço Manual
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-black ${pricing.profitStatus.color}`}>
                        {formatCurrency(pricing.manualPrice)}
                      </span>
                      {pricing.profitPerUnit >= 0 ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => handleEdit(p)}
                    className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {pricing.effectivePrice > 0 && (
                    <div className="flex items-center gap-3 text-xs">
                      <div className="text-right">
                        <span className="text-neutral-400">Lucro </span>
                        <span
                          className={`font-black ${pricing.profitPerUnit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                        >
                          {formatCurrency(pricing.profitPerUnit)}
                        </span>
                      </div>
                      <div
                        className={`font-black text-sm ${pricing.profitPerUnit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                      >
                        {pricing.margin.toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleEdit(p)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <span className="text-xs text-amber-500 font-bold">Configure Base de Custos</span>
              </div>
            )}
          </div>
        </div>
      ))}
      {filteredAndSorted.length === 0 && (
        <div className="col-span-full py-20 text-center text-neutral-400 italic">Nenhum produto encontrado.</div>
      )}
    </div>
  );
}

/**
 * Preço sugerido de cada produto em cada canal da tabela da loja (Etapa 8B, item 6). Só exibição:
 * o mesmo preço que o orçamento calcula para o canal (suggestedPriceByChannel).
 */
export function ProductChannelTable({
  filteredAndSorted,
  channels,
  markupPct,
  hasCosts,
  handleEdit,
}: {
  filteredAndSorted: ProductRow[];
  channels: SalesChannel[];
  markupPct: number;
  hasCosts: boolean;
  handleEdit: (product: Product) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-black text-neutral-900 uppercase tracking-wider">Preço sugerido por canal</p>
        <p className="text-[10px] text-neutral-400 font-bold">
          Markup {formatPercent(markupPct)} sobre o custo, com as taxas de cada canal
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="text-left px-4 py-3 text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                Produto
              </th>
              <th className="text-right px-4 py-3 text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                Custo
              </th>
              {channels.map(c => (
                <th
                  key={c.id}
                  className="text-right px-4 py-3 text-[10px] font-black text-neutral-400 uppercase tracking-wider whitespace-nowrap"
                >
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {filteredAndSorted.map(({ product: p, pricing }) => (
              <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    onClick={() => handleEdit(p)}
                    className="font-bold text-neutral-900 hover:underline text-left"
                  >
                    {p.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-right font-mono text-neutral-600 text-xs whitespace-nowrap">
                  {hasCosts && pricing.totalCost > 0 ? formatCurrency(pricing.totalCost) : '—'}
                </td>
                {suggestedPriceByChannel(hasCosts ? pricing.totalCost : 0, channels, markupPct).map(
                  ({ channel, price }) => (
                    <td key={channel.id} className="px-4 py-3 text-right font-bold text-neutral-900 whitespace-nowrap">
                      {price != null ? formatCurrency(price) : '—'}
                    </td>
                  ),
                )}
              </tr>
            ))}
            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan={channels.length + 2} className="px-4 py-16 text-center text-neutral-400 italic">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
