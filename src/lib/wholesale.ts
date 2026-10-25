/**
 * wholesale.ts — desconto de atacado por faixa de quantidade (Etapa 8C, item 3a).
 * O Atacado deixou de ser canal (+5%): agora é um desconto sobre o preço de varejo do item do
 * orçamento, pela quantidade, em qualquer canal. As faixas ficam na Base de Custos
 * (costBases/{loja}.wholesaleTiers); enquanto a loja não salvar as suas, valem as padrão abaixo.
 */
import type { WholesaleTier } from '../types';
import { priceForMarkup } from './pricingEngine';

/** Faixas aprovadas em 25/10/2026: 10–29 un = 10%, 30–99 = 20%, 100+ = 30%. */
export const DEFAULT_WHOLESALE_TIERS: WholesaleTier[] = [
  { minQty: 10, discountPct: 10 },
  { minQty: 30, discountPct: 20 },
  { minQty: 100, discountPct: 30 },
];

/** Piso: o preço nunca fica abaixo de custo × 1,30 + taxas do canal (markup de 30%). */
export const WHOLESALE_FLOOR_MARKUP_PCT = 30;

/** Maior desconto aceito numa faixa. */
export const MAX_WHOLESALE_DISCOUNT_PCT = 90;

/** Faixas válidas, em ordem de quantidade: quantidade mínima ≥ 2 e desconto entre 0 e 90%. */
export function normalizeWholesaleTiers(tiers: WholesaleTier[]): WholesaleTier[] {
  return tiers
    .map(t => ({
      minQty: Math.floor(Number(t.minQty) || 0),
      discountPct: Math.min(MAX_WHOLESALE_DISCOUNT_PCT, Math.max(0, Number(t.discountPct) || 0)),
    }))
    .filter(t => t.minQty >= 2)
    .sort((a, b) => a.minQty - b.minQty);
}

/** Faixas da loja: as gravadas na Base de Custos ou, sem elas, as padrão. */
export function wholesaleTiersOf(costs: { wholesaleTiers?: WholesaleTier[] } | null | undefined): WholesaleTier[] {
  return costs?.wholesaleTiers?.length ? normalizeWholesaleTiers(costs.wholesaleTiers) : DEFAULT_WHOLESALE_TIERS;
}

/** Desconto (%) da maior faixa que a quantidade alcança; 0 abaixo da primeira. */
export function wholesaleDiscountFor(tiers: WholesaleTier[], quantity: number): number {
  const qty = Number(quantity) || 0;
  return normalizeWholesaleTiers(tiers).reduce((pct, t) => (qty >= t.minQty ? t.discountPct : pct), 0);
}

/** Rótulo da faixa ("10–29 un", "100+ un") a partir das faixas em ordem. */
export function wholesaleTierLabel(tiers: WholesaleTier[], index: number): string {
  const sorted = normalizeWholesaleTiers(tiers);
  const t = sorted[index];
  if (!t) return '';
  const next = sorted[index + 1];
  return next ? `${t.minQty}–${next.minQty - 1} un` : `${t.minQty}+ un`;
}

export interface WholesaleResult {
  /** Preço por unidade depois do desconto (ou do piso). */
  price: number;
  /** Desconto da faixa (%); 0 quando a quantidade não chega à primeira faixa. */
  discountPct: number;
  /** Piso do canal: custo × 1,30 + taxas; null quando o canal não tem preço possível. */
  floorPrice: number | null;
  /** O desconto passaria do piso e o preço ficou no piso. */
  floorApplied: boolean;
}

/**
 * Aplica o desconto de atacado ao preço de varejo de uma unidade.
 * Piso = priceForMarkup(custo, 30%, taxas % do canal, taxa fixa): depois das taxas sobra custo × 1,30.
 * O piso nunca deixa o preço acima do varejo (ex.: markup personalizado abaixo de 30%).
 */
export function applyWholesale(
  retailPrice: number,
  cost: number,
  quantity: number,
  tiers: WholesaleTier[],
  feePct = 0,
  fixedFee = 0,
): WholesaleResult {
  const discountPct = wholesaleDiscountFor(tiers, quantity);
  const floorPrice = priceForMarkup(cost, WHOLESALE_FLOOR_MARKUP_PCT, feePct, fixedFee);
  if (discountPct <= 0 || !(retailPrice > 0))
    return { price: retailPrice, discountPct: 0, floorPrice, floorApplied: false };
  const discounted = retailPrice * (1 - discountPct / 100);
  const floor = Math.min(floorPrice ?? 0, retailPrice);
  return discounted < floor
    ? { price: floor, discountPct, floorPrice, floorApplied: true }
    : { price: discounted, discountPct, floorPrice, floorApplied: false };
}
