// Lucro de um preço manual em cada canal da tabela da loja (Etapa 8B, item 5). Só exibição:
// as contas são as do orçamento (manualPriceByChannel em lib/channels.ts).
import React from 'react';
import type { SalesChannel } from '../types';
import { manualPriceByChannel } from '../lib/channels';
import { feeLabel } from '../lib/quoteFormat';
import { cn, formatCurrency, formatPercent } from '../lib/utils';

export function ChannelProfitTable({
  price,
  cost,
  channels,
  markupPct,
  extraFeePct = 0,
  selectedChannelId,
}: {
  price: number | null | undefined;
  cost: number;
  channels: SalesChannel[];
  /** Meta = markup sobre o custo (%). */
  markupPct: number;
  /** % somado às taxas de todos os canais (ex.: comissão do vendedor nas Cestas). */
  extraFeePct?: number;
  /** Canal escolhido na tela, destacado na tabela. */
  selectedChannelId?: string;
}) {
  if (price == null || !(price > 0) || !(cost > 0)) return null;
  const rows = manualPriceByChannel(price, cost, channels, markupPct, extraFeePct);
  return (
    <div className="space-y-2" data-testid="channel-profit-table">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">
          Lucro de {formatCurrency(price)} em cada canal
        </p>
        <p className="text-[10px] text-neutral-400 font-bold">Meta: markup {formatPercent(markupPct)}</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-neutral-100">
        <table className="w-full text-xs">
          <thead className="bg-neutral-50 text-[10px] text-neutral-400 uppercase">
            <tr>
              <th className="text-left px-3 py-2 font-black">Canal</th>
              <th className="text-left px-3 py-2 font-black">Taxas</th>
              <th className="text-right px-3 py-2 font-black">Lucro</th>
              <th className="text-right px-3 py-2 font-black">Margem</th>
              <th className="text-left px-3 py-2 font-black">Meta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {rows.map(r => (
              <tr key={r.channel.id} className={cn(r.channel.id === selectedChannelId && 'bg-neutral-50 font-bold')}>
                <td className="px-3 py-2 text-neutral-900 whitespace-nowrap">{r.channel.name}</td>
                <td className="px-3 py-2 text-neutral-500 whitespace-nowrap">{feeLabel(r.feePct, r.fixedFee)}</td>
                <td
                  className={cn(
                    'px-3 py-2 text-right font-black whitespace-nowrap',
                    r.profit >= 0 ? 'text-emerald-600' : 'text-red-600',
                  )}
                >
                  {formatCurrency(r.profit)}
                </td>
                <td
                  className={cn(
                    'px-3 py-2 text-right whitespace-nowrap',
                    r.margin >= 0 ? 'text-emerald-600' : 'text-red-600',
                  )}
                >
                  {formatPercent(r.margin)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.meetsGoal === null ? (
                    <span className="text-neutral-400">sem preço possível</span>
                  ) : r.meetsGoal ? (
                    <span className="text-emerald-700 font-bold">✓ na meta</span>
                  ) : (
                    <span className="text-amber-700 font-bold">abaixo · mín. {formatCurrency(r.goalPrice ?? 0)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
