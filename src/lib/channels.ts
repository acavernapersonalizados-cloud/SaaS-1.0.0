/**
 * channels.ts — tabela única de canais de venda, por loja (Etapa 7, item 5).
 * Fica no documento da Base de Custos (costBases/{loja}.salesChannels). Enquanto a loja não
 * salvar a sua, vale a tabela padrão abaixo. Usada pelos Orçamentos e pelas calculadoras.
 */
import type { SalesChannel } from '../types';
import { MAX_CHANNEL_FEE_PERCENT, priceForMarkup } from './pricingEngine';

/**
 * Valores aprovados em 19/10/2026. Mercado Livre fica editável até a consulta pela API (Etapa 9).
 * Etapa 8C: o Atacado saiu (virou desconto por quantidade, lib/wholesale.ts).
 */
export const DEFAULT_SALES_CHANNELS: SalesChannel[] = [
  { id: 'venda-direta', name: 'Venda Direta', commissionPct: 0, fixedFee: 0, paymentPct: 0 },
  { id: 'instagram', name: 'Instagram', commissionPct: 0, fixedFee: 0, paymentPct: 3.5 },
  { id: 'shopee', name: 'Shopee', commissionPct: 20, fixedFee: 4, paymentPct: 0, note: 'R$ 4,00 por produto' },
  { id: 'mercado-livre', name: 'Mercado Livre', commissionPct: 18, fixedFee: 0, paymentPct: 0 },
  { id: 'ifood', name: 'iFood', commissionPct: 26.5, fixedFee: 0, paymentPct: 0 },
  { id: '99food', name: '99Food', commissionPct: 13, fixedFee: 0, paymentPct: 0 },
];

/** Canais da loja: a tabela gravada na Base de Custos ou, sem ela, a padrão. */
export function channelsOf(costs: { salesChannels?: SalesChannel[] } | null | undefined): SalesChannel[] {
  return costs?.salesChannels?.length ? costs.salesChannels : DEFAULT_SALES_CHANNELS;
}

/** Acha um canal pelo id ou pelo nome (orçamentos antigos guardam só o nome). */
export function findChannel(channels: SalesChannel[], idOrName: string | null | undefined): SalesChannel | undefined {
  if (!idOrName) return undefined;
  return channels.find(c => c.id === idOrName) ?? channels.find(c => c.name === idOrName);
}

/** Taxas do canal para a conta do preço: % (comissão + pagamento, até 95%) e taxa fixa por unidade. */
export function channelFees(channel: Pick<SalesChannel, 'commissionPct' | 'paymentPct' | 'fixedFee'> | undefined): {
  feePct: number;
  fixedFee: number;
} {
  if (!channel) return { feePct: 0, fixedFee: 0 };
  const pct = (Number(channel.commissionPct) || 0) + (Number(channel.paymentPct) || 0);
  return {
    feePct: Math.min(MAX_CHANNEL_FEE_PERCENT, Math.max(0, pct)),
    fixedFee: Math.max(0, Number(channel.fixedFee) || 0),
  };
}

/** Resultado de um preço manual num canal (Etapa 8B, item 5). */
export interface ChannelProfit {
  channel: SalesChannel;
  /** Taxas % do canal (com o % extra, ex.: comissão do vendedor nas Cestas) e taxa fixa por unidade. */
  feePct: number;
  fixedFee: number;
  /** Quanto o canal cobra dessa venda (R$). */
  fees: number;
  /** O que sobra depois do custo e das taxas (R$) e em % do preço (margem real). */
  profit: number;
  margin: number;
  /** Preço que bate a meta (markup) neste canal; null quando não existe (taxas ≥ 95%). */
  goalPrice: number | null;
  /** O preço manual cobre a meta neste canal? null quando não existe preço de meta. */
  meetsGoal: boolean | null;
}

/**
 * Lucro de um preço manual em cada canal da tabela, com as mesmas contas do orçamento:
 * taxas = preço × % + taxa fixa; lucro = preço − custo − taxas; meta = priceForMarkup.
 */
export function manualPriceByChannel(
  price: number,
  cost: number,
  channels: SalesChannel[],
  markupPct: number,
  extraFeePct = 0,
): ChannelProfit[] {
  return channels.map(channel => {
    const base = channelFees(channel);
    const feePct = base.feePct + (Number(extraFeePct) || 0);
    const fixedFee = base.fixedFee;
    const fees = price > 0 ? price * (feePct / 100) + fixedFee : 0;
    const profit = price - cost - fees;
    const goalPrice = priceForMarkup(cost, markupPct, feePct, fixedFee);
    return {
      channel,
      feePct,
      fixedFee,
      fees,
      profit,
      margin: price > 0 ? (profit / price) * 100 : 0,
      goalPrice,
      // Meio centavo de folga: o preço da meta digitado arredondado conta como "na meta".
      meetsGoal: goalPrice === null ? null : price >= goalPrice - 0.005,
    };
  });
}

/**
 * Preço sugerido de um custo em cada canal da tabela (Etapa 8B, item 6): o mesmo do orçamento,
 * priceForMarkup(custo, markup, taxas %, taxa fixa). null quando o canal não tem preço possível.
 */
export function suggestedPriceByChannel(
  cost: number,
  channels: SalesChannel[],
  markupPct: number,
): Array<{ channel: SalesChannel; price: number | null }> {
  return channels.map(channel => {
    const { feePct, fixedFee } = channelFees(channel);
    return { channel, price: cost > 0 ? priceForMarkup(cost, markupPct, feePct, fixedFee) : null };
  });
}
