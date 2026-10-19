/**
 * calculators.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Contas das calculadoras de Corte a Laser, Papelaria e Cestas, fora das telas
 * para poderem ser testadas. As fórmulas são as mesmas que estavam dentro de
 * LaserCalculator.tsx, PapelariaCalculator.tsx e CestaCalculator.tsx.
 * A Impressão 3D fica em printPricing.ts; o motor de produtos e orçamentos em
 * pricingEngine.ts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { energyCost, laborCostFromMinutes, priceForMarkup, wearCost } from './pricingEngine';

/** Quanto o canal de venda cobra de uma venda: taxa % do preço + taxa fixa. */
const channelCostOf = (price: number, feePct: number, fixedFee: number) =>
  price > 0 ? price * (feePct / 100) + fixedFee : 0;

/** Soma de custo unitário × quantidade de uma lista de itens (materiais, produtos da cesta). */
export const sumItemsCost = (items: Array<{ unitCost: number; quantity: number }>) =>
  items.reduce((acc, i) => acc + i.unitCost * i.quantity, 0);

// ─── Corte a Laser ───────────────────────────────────────────────────────────

/** Tempo de máquina por peça, em minutos: (corte + gravação) × passadas. */
export const laserTotalTimeMin = (cuttingTimeMin: number, engravingTimeMin: number, passes: number) =>
  (cuttingTimeMin + engravingTimeMin) * passes;

export interface LaserJobInput {
  powerConsumptionW: number;
  moduleReplacementCost: number;
  diodeLifeH: number;
  cuttingTimeMin: number;
  engravingTimeMin: number;
  passes: number;
  electricityRate: number;
  hourlyRate: number;
  /** Custo do material do lote inteiro. */
  materialCost: number;
  quantity: number;
  /** Markup sobre o custo (%). */
  markupPct: number;
  /** Taxa do canal de venda (% do preço) e taxa fixa por unidade (R$); sem canal = 0. */
  channelFeePct?: number;
  channelFixedFee?: number;
  manualPrice: number | null;
}

export function calcLaserJob(input: LaserJobInput) {
  const totalTimeMin = laserTotalTimeMin(input.cuttingTimeMin, input.engravingTimeMin, input.passes);
  if (totalTimeMin <= 0) return null;
  const totalTimeH = totalTimeMin / 60;
  const energy = energyCost(input.powerConsumptionW, totalTimeH, input.electricityRate);
  const wear = wearCost(input.moduleReplacementCost, input.diodeLifeH, totalTimeH);
  const laborCost = laborCostFromMinutes(input.hourlyRate, totalTimeMin);
  const matPerUnit = input.materialCost / Math.max(input.quantity, 1);
  // Tempos são por peça: energia, desgaste e mão de obra se repetem em cada peça do lote.
  const totalCostUnit = energy + wear + laborCost + matPerUnit;
  const totalCostBatch = totalCostUnit * Math.max(input.quantity, 1);
  const fee = input.channelFeePct ?? 0;
  const fixed = input.channelFixedFee ?? 0;
  const suggestedUnit = priceForMarkup(totalCostUnit, input.markupPct, fee, fixed) ?? 0;
  const suggestedBatch = suggestedUnit * Math.max(input.quantity, 1);
  const priceRef = input.manualPrice ?? suggestedUnit;
  const profit = priceRef - totalCostUnit - channelCostOf(priceRef, fee, fixed);
  const margin = priceRef > 0 ? (profit / priceRef) * 100 : 0;
  return {
    energyCost: energy,
    wearCost: wear,
    laborCost,
    matPerUnit,
    totalCostUnit,
    totalCostBatch,
    suggestedUnit,
    suggestedBatch,
    profit,
    margin,
  };
}

// ─── Papelaria ───────────────────────────────────────────────────────────────

export interface PapelariaJobInput {
  /** Materiais do lote inteiro. */
  materials: Array<{ unitCost: number; quantity: number }>;
  laminationCost: number;
  bindingCost: number;
  assemblyTimeMin: number;
  finishingTimeMin: number;
  packagingTimeMin: number;
  hourlyRate: number;
  /** Quantidade final de kits/conjuntos. */
  quantity: number;
  /** Markup sobre o custo (%). */
  markupPct: number;
  /** Taxa do canal de venda (% do preço) e taxa fixa por unidade (R$); sem canal = 0. */
  channelFeePct?: number;
  channelFixedFee?: number;
  manualPrice: number | null;
}

export function calcPapelariaJob(input: PapelariaJobInput) {
  const materialsCost = sumItemsCost(input.materials);
  const totalTimeMin = input.assemblyTimeMin + input.finishingTimeMin + input.packagingTimeMin;
  if (totalTimeMin <= 0 && materialsCost <= 0) return null;
  const laborCost = laborCostFromMinutes(input.hourlyRate, totalTimeMin);
  const totalCostBatch = materialsCost + input.laminationCost + input.bindingCost + laborCost;
  const totalCostUnit = totalCostBatch / Math.max(input.quantity, 1);
  const fee = input.channelFeePct ?? 0;
  const fixed = input.channelFixedFee ?? 0;
  const suggestedUnit = priceForMarkup(totalCostUnit, input.markupPct, fee, fixed) ?? 0;
  const suggestedBatch = suggestedUnit * input.quantity;
  const priceRef = input.manualPrice ?? suggestedUnit;
  const profit = priceRef - totalCostUnit - channelCostOf(priceRef, fee, fixed);
  const margin = priceRef > 0 ? (profit / priceRef) * 100 : 0;
  return {
    materialsCost,
    laminationCost: input.laminationCost,
    bindingCost: input.bindingCost,
    laborCost,
    totalCostUnit,
    totalCostBatch,
    suggestedUnit,
    suggestedBatch,
    profit,
    margin,
  };
}

// ─── Cestas ──────────────────────────────────────────────────────────────────

export interface CestaJobInput {
  /** Produtos internos do lote inteiro. */
  items: Array<{ unitCost: number; quantity: number }>;
  packagingCost: number;
  ribbonCost: number;
  tagCost: number;
  assemblyTimeMin: number;
  hourlyRate: number;
  deliveryCost: number;
  commissionPct: number;
  /** Quantidade de cestas. */
  quantity: number;
  /** Markup sobre o custo (%). */
  markupPct: number;
  /** Taxa do canal de venda (% do preço) e taxa fixa por unidade (R$); sem canal = 0. */
  channelFeePct?: number;
  channelFixedFee?: number;
  manualPrice: number | null;
}

export function calcCestaJob(input: CestaJobInput) {
  const itemsCost = sumItemsCost(input.items);
  if (itemsCost <= 0 && input.assemblyTimeMin <= 0) return null;
  const laborCost = laborCostFromMinutes(input.hourlyRate, input.assemblyTimeMin);
  const packagingTotal = input.packagingCost + input.ribbonCost + input.tagCost;
  const subtotalBatch = itemsCost + packagingTotal + laborCost + input.deliveryCost;
  const totalCostUnit = subtotalBatch / Math.max(input.quantity, 1);
  // Markup sobre o custo, com comissão e taxa do canal somadas por cima: depois delas sobra custo × markup.
  const fee = input.channelFeePct ?? 0;
  const fixed = input.channelFixedFee ?? 0;
  const marginPrice = priceForMarkup(totalCostUnit, input.markupPct, input.commissionPct + fee, fixed);
  const invalidMargin = marginPrice === null;
  const suggestedUnit = marginPrice ?? 0;
  const suggestedBatch = suggestedUnit * input.quantity;
  const priceRef = input.manualPrice ?? suggestedUnit;
  const commissionValue = priceRef * (input.commissionPct / 100);
  const channelCost = channelCostOf(priceRef, fee, fixed);
  const profit = priceRef - totalCostUnit - commissionValue - channelCost;
  const margin = priceRef > 0 ? (profit / priceRef) * 100 : 0;
  return {
    itemsCost,
    packagingTotal,
    laborCost,
    deliveryCost: input.deliveryCost,
    totalCostUnit,
    suggestedUnit,
    suggestedBatch,
    profit,
    margin,
    invalidMargin,
    commissionValue,
    channelCost,
  };
}
