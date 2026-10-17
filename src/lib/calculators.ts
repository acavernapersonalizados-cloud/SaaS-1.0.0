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

import { priceForMargin } from './pricingEngine';

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
  profitMarginPct: number;
  manualPrice: number | null;
}

export function calcLaserJob(input: LaserJobInput) {
  const totalTimeMin = laserTotalTimeMin(input.cuttingTimeMin, input.engravingTimeMin, input.passes);
  if (totalTimeMin <= 0) return null;
  const totalTimeH = totalTimeMin / 60;
  const energyCost = (input.powerConsumptionW / 1000) * totalTimeH * input.electricityRate;
  const wearCost = input.diodeLifeH > 0 ? (input.moduleReplacementCost / input.diodeLifeH) * totalTimeH : 0;
  const laborCost = (input.hourlyRate / 60) * totalTimeMin;
  const matPerUnit = input.materialCost / Math.max(input.quantity, 1);
  // Tempos são por peça: energia, desgaste e mão de obra se repetem em cada peça do lote.
  const totalCostUnit = energyCost + wearCost + laborCost + matPerUnit;
  const totalCostBatch = totalCostUnit * Math.max(input.quantity, 1);
  const suggestedUnit = priceForMargin(totalCostUnit, input.profitMarginPct) ?? 0;
  const suggestedBatch = suggestedUnit * Math.max(input.quantity, 1);
  const priceRef = input.manualPrice ?? suggestedUnit;
  const profit = priceRef - totalCostUnit;
  const margin = priceRef > 0 ? (profit / priceRef) * 100 : 0;
  return {
    energyCost,
    wearCost,
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
  profitMarginPct: number;
  manualPrice: number | null;
}

export function calcPapelariaJob(input: PapelariaJobInput) {
  const materialsCost = sumItemsCost(input.materials);
  const totalTimeMin = input.assemblyTimeMin + input.finishingTimeMin + input.packagingTimeMin;
  if (totalTimeMin <= 0 && materialsCost <= 0) return null;
  const laborCost = (input.hourlyRate / 60) * totalTimeMin;
  const totalCostBatch = materialsCost + input.laminationCost + input.bindingCost + laborCost;
  const totalCostUnit = totalCostBatch / Math.max(input.quantity, 1);
  const suggestedUnit = priceForMargin(totalCostUnit, input.profitMarginPct) ?? 0;
  const suggestedBatch = suggestedUnit * input.quantity;
  const priceRef = input.manualPrice ?? suggestedUnit;
  const profit = priceRef - totalCostUnit;
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
  profitMarginPct: number;
  manualPrice: number | null;
}

export function calcCestaJob(input: CestaJobInput) {
  const itemsCost = sumItemsCost(input.items);
  if (itemsCost <= 0 && input.assemblyTimeMin <= 0) return null;
  const laborCost = (input.hourlyRate / 60) * input.assemblyTimeMin;
  const packagingTotal = input.packagingCost + input.ribbonCost + input.tagCost;
  const subtotalBatch = itemsCost + packagingTotal + laborCost + input.deliveryCost;
  const totalCostUnit = subtotalBatch / Math.max(input.quantity, 1);
  // Margem sobre o preço, líquida da comissão: depois da comissão sobra exatamente a margem.
  const marginPrice = priceForMargin(totalCostUnit, input.profitMarginPct, input.commissionPct);
  const invalidMargin = marginPrice === null;
  const suggestedUnit = marginPrice ?? 0;
  const suggestedBatch = suggestedUnit * input.quantity;
  const priceRef = input.manualPrice ?? suggestedUnit;
  const commissionValue = priceRef * (input.commissionPct / 100);
  const profit = priceRef - totalCostUnit - commissionValue;
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
  };
}
