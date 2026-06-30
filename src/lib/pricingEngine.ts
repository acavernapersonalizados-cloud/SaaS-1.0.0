/**
 * pricingEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * FONTE ÚNICA DE VERDADE para todos os cálculos financeiros do sistema.
 *
 * Todos os módulos (Products, Pricing, Dashboard, LaserCalculator, IA)
 * devem importar SOMENTE daqui. Nunca duplicar lógica.
 *
 * Retrocompatível: aceita campos opcionais / undefined em todos os inputs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Product, Material, CostBase, QuoteItem } from '../types';
import { CHANNELS } from '../types';

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

export type ProfitStatus = 'excellent' | 'good' | 'low' | 'risky' | 'loss';

export interface ProfitStatusInfo {
  status: ProfitStatus;
  label: string;
  color: string;       // Tailwind text color class
  bg: string;          // Tailwind bg color class
  border: string;      // Tailwind border class
  badge: string;       // badge combined class
  emoji: string;
  description: string;
  recommendation: string;
}

export interface ProductCostResult {
  materialCost: number;
  laborCost: number;
  packagingCost: number;
  totalCost: number;
}

export interface ProductPricingResult extends ProductCostResult {
  suggestedPrice: number;       // using profitGoal margin
  manualPrice: number | null;   // null if not set
  effectivePrice: number;       // manualPrice ?? suggestedPrice
  profitPerUnit: number;        // effectivePrice - totalCost
  margin: number;               // (profit / effectivePrice) * 100
  markup: number;               // (profit / totalCost) * 100  — expressed as multiplier (e.g. 2.74)
  profitStatus: ProfitStatusInfo;
  minimumPrice: number;         // break-even (totalCost)
  hasCosts: boolean;            // true if costBase was available
}

export interface QuoteItemCalcResult {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  basePrice: number;
  finishingValue: number;
  accessoriesValue: number;
  selectedFinishingIds: string[];
  selectedAccessoryIds: string[];
  finishingNames: string[];
  accessoryNames: string[];
  itemProfit: number;
  itemTotalCost: number;
  itemPlatformFee: number;
  isPackage: boolean;
  packageQuantity: number;
  pricePerItem: number;
  customMargin: number | null;
  // Snapshots (persist in Firestore for history)
  materialCost: number;
  laborCost: number;
  productionCost: number;
  margin: number;
  platformFee: number;
}

// ─── Classificação de rentabilidade ──────────────────────────────────────────

/**
 * Regras de classificação (ajustáveis):
 * EXCELLENT  margem >= 55%
 * GOOD       margem >= 35%
 * LOW        margem >= 15%
 * RISKY      margem >= 0%
 * LOSS       margem < 0%
 */
export function getProfitStatus(margin: number): ProfitStatusInfo {
  if (margin >= 55) return {
    status: 'excellent',
    label: 'Excelente',
    emoji: '🟢',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    description: 'Margem saudável e sustentável para o seu negócio.',
    recommendation: 'Mantenha este preço. Você pode crescer com segurança.',
  };
  if (margin >= 35) return {
    status: 'good',
    label: 'Bom',
    emoji: '🟡',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    description: 'Margem adequada para a maioria dos produtos artesanais.',
    recommendation: 'Preço equilibrado. Avalie se há espaço para crescer.',
  };
  if (margin >= 15) return {
    status: 'low',
    label: 'Margem Baixa',
    emoji: '🟠',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    description: 'Margem abaixo do ideal para cobrir imprevistos.',
    recommendation: 'Considere reduzir custos ou aumentar o preço.',
  };
  if (margin >= 0) return {
    status: 'risky',
    label: 'Arriscado',
    emoji: '🔴',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    description: 'Margem muito baixa. Qualquer imprevisto gera prejuízo.',
    recommendation: 'Aumente o preço imediatamente ou reduza custos.',
  };
  return {
    status: 'loss',
    label: 'Prejuízo',
    emoji: '⛔',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
    description: 'Preço abaixo do custo. Você está vendendo com prejuízo.',
    recommendation: 'URGENTE: Aumente o preço para pelo menos R$ {minimumPrice}.',
  };
}

// ─── Cálculo de custo do produto ─────────────────────────────────────────────

export function calcProductCost(
  product: Partial<Product>,
  materials: Material[],
  costs: CostBase | null
): ProductCostResult {
  const materialCost = (product.materials || []).reduce((acc, pm) => {
    const mat = materials.find(m => m.id === pm.materialId);
    return acc + (Number(mat?.unitCost) || 0) * (Number(pm.quantity) || 0);
  }, 0);

  const laborCost = costs
    ? ((Number(product.productionTime) || 0) / 60) * (Number(costs.hourlyRate) || 0)
    : 0;

  const packagingCost = Number(product.packagingCost) || 0;

  const totalCost = materialCost + laborCost + packagingCost;

  return { materialCost, laborCost, packagingCost, totalCost };
}

// ─── Cálculo completo de precificação do produto ──────────────────────────────

export function calcProductPricing(
  product: Partial<Product>,
  materials: Material[],
  costs: CostBase | null
): ProductPricingResult {
  const costResult = calcProductCost(product, materials, costs);
  const { totalCost } = costResult;

  const profitGoalPct = Number(costs?.profitGoal) || 30;
  const suggestedPrice = totalCost > 0 ? totalCost * (1 + profitGoalPct / 100) : 0;

  const manualPrice: number | null =
    product.manualPrice != null && product.manualPrice > 0
      ? Number(product.manualPrice)
      : null;

  const effectivePrice = manualPrice ?? suggestedPrice;
  const profitPerUnit = effectivePrice - totalCost;
  const margin = effectivePrice > 0 ? (profitPerUnit / effectivePrice) * 100 : 0;
  const markupMultiplier = totalCost > 0 ? effectivePrice / totalCost : 0;

  const statusInfo = getProfitStatus(margin);

  return {
    ...costResult,
    suggestedPrice,
    manualPrice,
    effectivePrice,
    profitPerUnit,
    margin,
    markup: markupMultiplier,
    profitStatus: {
      ...statusInfo,
      recommendation: statusInfo.recommendation.replace('{minimumPrice}', totalCost.toFixed(2)),
    },
    minimumPrice: totalCost,
    hasCosts: !!costs,
  };
}

// ─── Cálculo de item de orçamento ─────────────────────────────────────────────

export function calcQuoteItem(
  item: Partial<QuoteItem & { selectedFinishingIds: string[]; selectedAccessoryIds: string[] }>,
  product: Product,
  materials: Material[],
  costs: CostBase,
  channelFeePercent: number
): QuoteItemCalcResult | null {
  if (!product || !costs) return null;

  const { materialCost, laborCost, totalCost: totalProductionCost } =
    calcProductCost(product, materials, costs);

  // Margin: item custom > default profitGoal
  const margin =
    item.customMargin !== undefined && item.customMargin !== null
      ? Number(item.customMargin)
      : Number(costs.profitGoal) || 0;

  const platformFeePercent = channelFeePercent;

  // Base unit price accounting for platform fee
  const baseUnitPrice =
    platformFeePercent < 100
      ? (totalProductionCost * (1 + margin / 100)) / (1 - platformFeePercent / 100)
      : totalProductionCost * (1 + margin / 100);

  const finishingValue = (product.finishingOptions || [])
    .filter(o => item.selectedFinishingIds?.includes(o.id))
    .reduce((acc, o) => acc + (Number(o.additionalValue) || 0), 0);

  const accessoriesValue = (product.accessories || [])
    .filter(a => item.selectedAccessoryIds?.includes(a.id))
    .reduce((acc, a) => acc + (Number(a.additionalValue) || 0), 0);

  const unitPrice =
    (isFinite(baseUnitPrice) ? baseUnitPrice : 0) +
    (isFinite(finishingValue) ? finishingValue : 0) +
    (isFinite(accessoriesValue) ? accessoriesValue : 0);

  const quantity = Number(item.quantity) || 1;
  const totalPrice = unitPrice * quantity;

  const isPackage = !!product.isPackage;
  const packageQuantity = Number(product.packageQuantity) || 1;
  const pricePerItem = isPackage ? unitPrice / packageQuantity : unitPrice;

  const itemTotalCost = totalProductionCost * quantity;
  const itemPlatformFee = totalPrice * (platformFeePercent / 100);
  const itemProfit = totalPrice - itemTotalCost - itemPlatformFee;

  const finishingNames = (product.finishingOptions || [])
    .filter(o => item.selectedFinishingIds?.includes(o.id))
    .map(o => o.name);

  const accessoryNames = (product.accessories || [])
    .filter(a => item.selectedAccessoryIds?.includes(a.id))
    .map(a => a.name);

  return {
    productId: product.id,
    productName: product.name || 'Produto sem nome',
    quantity,
    unitPrice: isFinite(unitPrice) ? unitPrice : 0,
    totalPrice: isFinite(totalPrice) ? totalPrice : 0,
    basePrice: isFinite(baseUnitPrice) ? baseUnitPrice : 0,
    finishingValue: isFinite(finishingValue) ? finishingValue : 0,
    accessoriesValue: isFinite(accessoriesValue) ? accessoriesValue : 0,
    selectedFinishingIds: item.selectedFinishingIds || [],
    selectedAccessoryIds: item.selectedAccessoryIds || [],
    finishingNames,
    accessoryNames,
    itemProfit: isFinite(itemProfit) ? itemProfit : 0,
    itemTotalCost: isFinite(itemTotalCost) ? itemTotalCost : 0,
    itemPlatformFee: isFinite(itemPlatformFee) ? itemPlatformFee : 0,
    isPackage,
    packageQuantity,
    pricePerItem: isFinite(pricePerItem) ? pricePerItem : 0,
    customMargin: item.customMargin ?? null,
    materialCost,
    laborCost,
    productionCost: totalProductionCost,
    margin,
    platformFee: platformFeePercent,
  };
}

// ─── Precificação reversa ─────────────────────────────────────────────────────

export interface ReversePricingResult {
  targetPrice: number;
  totalCost: number;
  profit: number;
  margin: number;
  markup: number;
  profitStatus: ProfitStatusInfo;
  isBelowCost: boolean;
  breakEvenPrice: number;
}

export function calcReversePrice(
  targetPrice: number,
  totalCost: number
): ReversePricingResult {
  const profit = targetPrice - totalCost;
  const margin = targetPrice > 0 ? (profit / targetPrice) * 100 : -999;
  const markup = totalCost > 0 ? targetPrice / totalCost : 0;
  const profitStatus = getProfitStatus(margin);

  return {
    targetPrice,
    totalCost,
    profit,
    margin,
    markup,
    profitStatus: {
      ...profitStatus,
      recommendation: profitStatus.recommendation.replace('{minimumPrice}', totalCost.toFixed(2)),
    },
    isBelowCost: profit < 0,
    breakEvenPrice: totalCost,
  };
}

// ─── KPIs de catálogo de produtos (para Dashboard) ───────────────────────────

export interface CatalogKPIs {
  totalProducts: number;
  productsWithPrice: number;
  productsWithoutPrice: number;
  productsWithLoss: number;
  productsRisky: number;
  productsLowMargin: number;
  productsGood: number;
  productsExcellent: number;
  avgMargin: number;
  avgProfit: number;
  totalPotentialProfit: number;      // sum of profitPerUnit for all priced products
  mostProfitable: Array<{ name: string; profit: number; margin: number }>;
  leastProfitable: Array<{ name: string; profit: number; margin: number }>;
}

export function calcCatalogKPIs(
  products: Product[],
  materials: Material[],
  costs: CostBase | null
): CatalogKPIs {
  const pricings = products.map(p => ({
    name: p.name,
    ...calcProductPricing(p, materials, costs),
  }));

  const priced = pricings.filter(p => p.effectivePrice > 0 && p.hasCosts);

  const avgMargin = priced.length > 0
    ? priced.reduce((a, p) => a + p.margin, 0) / priced.length
    : 0;

  const avgProfit = priced.length > 0
    ? priced.reduce((a, p) => a + p.profitPerUnit, 0) / priced.length
    : 0;

  const sorted = [...priced].sort((a, b) => b.profitPerUnit - a.profitPerUnit);

  return {
    totalProducts: products.length,
    productsWithPrice: priced.length,
    productsWithoutPrice: products.length - priced.length,
    productsWithLoss: priced.filter(p => p.profitStatus.status === 'loss').length,
    productsRisky: priced.filter(p => p.profitStatus.status === 'risky').length,
    productsLowMargin: priced.filter(p => p.profitStatus.status === 'low').length,
    productsGood: priced.filter(p => p.profitStatus.status === 'good').length,
    productsExcellent: priced.filter(p => p.profitStatus.status === 'excellent').length,
    avgMargin,
    avgProfit,
    totalPotentialProfit: priced.reduce((a, p) => a + p.profitPerUnit, 0),
    mostProfitable: sorted.slice(0, 5).map(p => ({ name: p.name, profit: p.profitPerUnit, margin: p.margin })),
    leastProfitable: sorted.slice(-5).reverse().map(p => ({ name: p.name, profit: p.profitPerUnit, margin: p.margin })),
  };
}
