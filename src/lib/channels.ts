/**
 * channels.ts — tabela única de canais de venda, por loja (Etapa 7, item 5).
 * Fica no documento da Base de Custos (costBases/{loja}.salesChannels). Enquanto a loja não
 * salvar a sua, vale a tabela padrão abaixo. Usada pelos Orçamentos e pelas calculadoras.
 */
import type { SalesChannel } from '../types';
import { MAX_CHANNEL_FEE_PERCENT } from './pricingEngine';

/** Valores aprovados em 19/10/2026. Mercado Livre fica editável até a consulta pela API (Etapa 9). */
export const DEFAULT_SALES_CHANNELS: SalesChannel[] = [
  { id: 'venda-direta', name: 'Venda Direta', commissionPct: 0, fixedFee: 0, paymentPct: 0 },
  { id: 'instagram', name: 'Instagram', commissionPct: 0, fixedFee: 0, paymentPct: 3.5 },
  { id: 'atacado', name: 'Atacado', commissionPct: 5, fixedFee: 0, paymentPct: 0 },
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
