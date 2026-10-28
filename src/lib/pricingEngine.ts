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

import type { Product, Material, CostBase, QuoteItem, WholesaleTier } from '../types';
import { applyWholesale } from './wholesale';

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

export type ProfitStatus = 'excellent' | 'good' | 'low' | 'risky' | 'loss';

export interface ProfitStatusInfo {
  status: ProfitStatus;
  label: string;
  color: string; // Tailwind text color class
  bg: string; // Tailwind bg color class
  border: string; // Tailwind border class
  badge: string; // badge combined class
  emoji: string;
  description: string;
  recommendation: string;
}

export interface ProductCostResult {
  materialCost: number;
  laborCost: number;
  packagingCost: number;
  /** Custo fixo do trabalho de calculadora que virou produto (Etapa 8C, item 4). */
  jobCost: number;
  totalCost: number;
}

export interface ProductPricingResult extends ProductCostResult {
  suggestedPrice: number; // custo × (1 + markup da Base de Custos)
  manualPrice: number | null; // null if not set
  effectivePrice: number; // manualPrice ?? suggestedPrice
  profitPerUnit: number; // effectivePrice - totalCost
  margin: number; // (profit / effectivePrice) * 100
  markup: number; // (profit / totalCost) * 100  — expressed as multiplier (e.g. 2.74)
  profitStatus: ProfitStatusInfo;
  minimumPrice: number; // break-even (totalCost)
  hasCosts: boolean; // true if costBase was available
  /** A meta de lucro da Base de Custos não permite preço (ex.: 100% de margem). */
  invalidProfitGoal: boolean;
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
  customMarkup: number | null;
  /** true quando a taxa do canal ≥ 95% (ou o markup é negativo): não há preço possível. */
  invalidMargin: boolean;
  // Snapshots (persist in Firestore for history)
  materialCost: number;
  laborCost: number;
  productionCost: number;
  /** Markup sobre o custo usado no preço. */
  markup: number;
  /** Margem real (%) depois do custo e da taxa do canal. */
  margin: number;
  platformFee: number;
  /** Preço de varejo da unidade, antes do desconto de atacado (Etapa 8C). */
  retailBasePrice: number;
  /** Desconto de atacado (%) da faixa da quantidade; 0 abaixo da primeira faixa. */
  wholesaleDiscountPct: number;
  /** O desconto passaria do piso e o preço ficou no piso. */
  wholesaleFloorApplied: boolean;
  /** Piso do canal (custo × 1,30 + taxas) por unidade; null quando não há preço possível. */
  wholesaleFloorPrice: number | null;
  /** Item 18: preço manual por unidade (Pix) usado no item, ou null quando o preço é o calculado. */
  manualUnitPrice: number | null;
  /** Item 18: o preço que a conta daria (markup, atacado, acabamentos), para comparar com o manual. */
  suggestedUnitPrice: number;
  /** Item 18: o preço não cobre o custo e as taxas (prejuízo). */
  belowCost: boolean;
  /** Item 18: preço manual abaixo do sugerido pela meta (markup da Base de Custos ou do item). */
  belowGoal: boolean;
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
export const MAX_CHANNEL_FEE_PERCENT = 95;

/** Margem a partir da qual a meta antiga (margem sobre o preço) não tinha preço possível. */
export const MAX_MARGIN_PLUS_FEES_PERCENT = 95;

// ─── Markup sobre o custo (Etapa 7) ───────────────────────────────────────────

/** Limite dos campos de markup. */
export const MAX_MARKUP_PERCENT = 500;

/** Mantém um campo de markup entre 0 e MAX_MARKUP_PERCENT. */
export const clampMarkup = (value: number) => Math.min(MAX_MARKUP_PERCENT, Math.max(0, Number(value) || 0));

/**
 * Converte a meta antiga (margem sobre o preço) no markup que dá o mesmo preço: m ÷ (1 − m).
 * Metas de 95% ou mais não eram possíveis como margem: foram gravadas antes de 17/10, quando a
 * meta já era markup (ex.: 100% da T&N = dobrar o custo), e continuam valendo como markup.
 */
export function marginToMarkup(marginPct: number): number {
  const m = Number(marginPct) || 0;
  return m >= MAX_MARGIN_PLUS_FEES_PERCENT ? m : (m / (100 - m)) * 100;
}

/** Markup da loja: o gravado (markupPct) ou, sem ele, a conversão da meta antiga. */
export function markupOf(costs: Pick<CostBase, 'profitGoal' | 'markupPct'> | null | undefined): number {
  if (!costs) return 0;
  if (costs.markupPct != null && Number.isFinite(Number(costs.markupPct))) return Number(costs.markupPct);
  return marginToMarkup(costs.profitGoal);
}

/**
 * Preço com markup sobre o custo, já cobrindo as taxas do canal:
 *   preço = (custo + taxas fixas) × (1 + markup) ÷ (1 − taxas %)
 * O lucro em R$ fica (custo + taxas fixas) × markup em qualquer canal.
 * Retorna null para markup negativo ou taxas % ≥ MAX_CHANNEL_FEE_PERCENT.
 */
export function priceForMarkup(cost: number, markupPct: number, feePct = 0, fixedFees = 0): number | null {
  const k = Number(markupPct);
  const fee = Number(feePct) || 0;
  if (!Number.isFinite(k) || k < 0 || fee >= MAX_CHANNEL_FEE_PERCENT) return null;
  return (((Number(cost) || 0) + (Number(fixedFees) || 0)) * (1 + k / 100)) / (1 - fee / 100);
}

/** Taxa do cartão de crédito coberta pelo preço no crédito (Etapa 8C). */
export const CREDIT_CARD_FEE_PCT = 5;

/** Preço no crédito: o preço no Pix ÷ 0,95, para os 5% do cartão não reduzirem o que entra. */
export const creditPrice = (pixPrice: number) => (Number(pixPrice) || 0) / (1 - CREDIT_CARD_FEE_PCT / 100);

/** Margem real (%) que sobra do preço depois do custo e das taxas do canal. */
export function realMargin(price: number, cost: number, feePct = 0, fixedFees = 0): number {
  if (!(price > 0)) return 0;
  return ((price * (1 - (Number(feePct) || 0) / 100) - (Number(fixedFees) || 0) - cost) / price) * 100;
}

// ─── Custos de produção (usados pelas calculadoras e pela Impressão 3D) ───────

/** Energia: (W ÷ 1000) × horas × tarifa (R$/kWh). */
export const energyCost = (watts: number, hours: number, tariffPerKwh: number) => (watts / 1000) * hours * tariffPerKwh;

/** Desgaste: (custo de reposição ÷ vida útil em horas) × horas de uso; 0 se não há vida útil. */
export const wearCost = (replacementCost: number, lifeHours: number, hours: number) =>
  lifeHours > 0 ? (replacementCost / lifeHours) * hours : 0;

/** Mão de obra em minutos: (valor da hora ÷ 60) × minutos. */
export const laborCostFromMinutes = (hourlyRate: number, minutes: number) => (hourlyRate / 60) * minutes;

/** Mão de obra em horas: valor da hora × horas. */
export const laborCostFromHours = (hourlyRate: number, hours: number) => hourlyRate * hours;

export function getProfitStatus(margin: number): ProfitStatusInfo {
  if (margin >= 55)
    return {
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
  if (margin >= 35)
    return {
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
  if (margin >= 15)
    return {
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
  if (margin >= 0)
    return {
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
  costs: CostBase | null,
): ProductCostResult {
  // Etapa 8C, item 4: produto criado de trabalho de calculadora. O custo é só o do trabalho, que já inclui
  // materiais, mão de obra, embalagem e máquina; tempo, embalagem e materiais do produto são só informação
  // (e a baixa de estoque), nunca somados de novo (correção de 26/10/2026).
  const jobCost = Number(product.jobCostUnit) || 0;
  if (jobCost > 0) return { materialCost: 0, laborCost: 0, packagingCost: 0, jobCost, totalCost: jobCost };

  const materialCost = (product.materials || []).reduce((acc, pm) => {
    const mat = materials.find(m => m.id === pm.materialId);
    return acc + (Number(mat?.unitCost) || 0) * (Number(pm.quantity) || 0);
  }, 0);

  const laborCost = costs ? ((Number(product.productionTime) || 0) / 60) * (Number(costs.hourlyRate) || 0) : 0;

  const packagingCost = Number(product.packagingCost) || 0;

  const totalCost = materialCost + laborCost + packagingCost;

  return { materialCost, laborCost, packagingCost, jobCost, totalCost };
}

// ─── Cálculo completo de precificação do produto ──────────────────────────────

export function calcProductPricing(
  product: Partial<Product>,
  materials: Material[],
  costs: CostBase | null,
): ProductPricingResult {
  const costResult = calcProductCost(product, materials, costs);
  const { totalCost } = costResult;

  // Meta de lucro = markup sobre o custo (Etapa 7). Sem markup gravado, converte a meta antiga.
  // Produto criado de trabalho: o sugerido é o mesmo da calculadora (gravado no trabalho), sem recalcular.
  const jobSuggested = Number(product.jobSuggestedUnit) || 0;
  const goalPrice =
    costResult.jobCost > 0 && jobSuggested > 0
      ? jobSuggested
      : totalCost > 0
        ? priceForMarkup(totalCost, markupOf(costs))
        : 0;
  const invalidProfitGoal = goalPrice === null;
  const suggestedPrice = goalPrice ?? 0;

  const manualPrice: number | null =
    product.manualPrice != null && product.manualPrice > 0 ? Number(product.manualPrice) : null;

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
    invalidProfitGoal,
  };
}

// ─── Cálculo de item de orçamento ─────────────────────────────────────────────

export function calcQuoteItem(
  item: Partial<QuoteItem & { selectedFinishingIds: string[]; selectedAccessoryIds: string[] }>,
  product: Product,
  materials: Material[],
  costs: CostBase,
  channelFeePercent: number,
  /** Taxa fixa do canal por unidade (R$), ex.: Shopee R$ 4,00. */
  channelFixedFee = 0,
  /** Faixas de atacado da loja (Etapa 8C); sem elas, não há desconto por quantidade. */
  wholesaleTiers: WholesaleTier[] = [],
): QuoteItemCalcResult | null {
  if (!product || !costs) return null;

  const { materialCost, laborCost, totalCost: totalProductionCost } = calcProductCost(product, materials, costs);

  // Markup: o personalizado do item ou o da Base de Custos (Etapa 7).
  const markup =
    item.customMarkup !== undefined && item.customMarkup !== null ? Number(item.customMarkup) : markupOf(costs);

  // Taxa de canal: limitada a 0–95%. Acima disso o preço tenderia ao infinito
  // e o cálculo antigo ignorava a taxa silenciosamente (prejuízo escondido).
  const rawFeePercent = Number(channelFeePercent) || 0;
  const platformFeePercent = Math.min(Math.max(rawFeePercent, 0), MAX_CHANNEL_FEE_PERCENT);

  // Markup sobre o custo, com a taxa do canal somada por cima: depois de pagar a taxa,
  // o lucro em R$ é o mesmo da venda direta (custo × markup).
  const fixedFee = Math.max(0, Number(channelFixedFee) || 0);
  const markupPrice = priceForMarkup(totalProductionCost, markup, platformFeePercent, fixedFee);
  const invalidMargin = markupPrice === null;
  const retailBasePrice = markupPrice ?? 0;

  // Atacado (Etapa 8C): desconto pela quantidade do item sobre o preço de varejo, nunca abaixo
  // do piso (custo × 1,30 + taxas do canal). Acabamentos e acessórios ficam sem desconto.
  const wholesale = applyWholesale(
    retailBasePrice,
    totalProductionCost,
    Number(item.quantity) || 1,
    wholesaleTiers,
    platformFeePercent,
    fixedFee,
  );
  const baseUnitPrice = wholesale.price;

  const finishingValue = (product.finishingOptions || [])
    .filter(o => item.selectedFinishingIds?.includes(o.id))
    .reduce((acc, o) => acc + (Number(o.additionalValue) || 0), 0);

  const accessoriesValue = (product.accessories || [])
    .filter(a => item.selectedAccessoryIds?.includes(a.id))
    .reduce((acc, a) => acc + (Number(a.additionalValue) || 0), 0);

  const suggestedUnitPrice =
    (isFinite(baseUnitPrice) ? baseUnitPrice : 0) +
    (isFinite(finishingValue) ? finishingValue : 0) +
    (isFinite(accessoriesValue) ? accessoriesValue : 0);
  // Item 18: com preço manual, ele é o preço final da unidade (Pix): sem atacado e sem somar acabamentos/acessórios.
  const manual = Number(item.manualUnitPrice) || 0;
  const useManual = manual > 0;
  const unitPrice = useManual ? manual : suggestedUnitPrice;

  const quantity = Number(item.quantity) || 1;
  const totalPrice = unitPrice * quantity;

  const isPackage = !!product.isPackage;
  const packageQuantity = Number(product.packageQuantity) || 1;
  const pricePerItem = isPackage ? unitPrice / packageQuantity : unitPrice;

  const itemTotalCost = totalProductionCost * quantity;
  const itemPlatformFee = totalPrice * (platformFeePercent / 100) + fixedFee * quantity;
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
    // Com preço manual, o preço base é o manual e acabamentos/acessórios não somam (já estão nele).
    basePrice: useManual ? manual : isFinite(baseUnitPrice) ? baseUnitPrice : 0,
    finishingValue: useManual ? 0 : isFinite(finishingValue) ? finishingValue : 0,
    accessoriesValue: useManual ? 0 : isFinite(accessoriesValue) ? accessoriesValue : 0,
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
    customMarkup: item.customMarkup ?? null,
    invalidMargin,
    materialCost,
    laborCost,
    productionCost: totalProductionCost,
    markup,
    // Margem real: o que sobra do preço depois do custo e da taxa do canal.
    margin: totalPrice > 0 && isFinite(itemProfit) ? (itemProfit / totalPrice) * 100 : 0,
    platformFee: platformFeePercent,
    retailBasePrice: isFinite(retailBasePrice) ? retailBasePrice : 0,
    // Com preço manual não há desconto de atacado.
    wholesaleDiscountPct: useManual ? 0 : wholesale.discountPct,
    wholesaleFloorApplied: useManual ? false : wholesale.floorApplied,
    wholesaleFloorPrice: wholesale.floorPrice,
    manualUnitPrice: useManual ? manual : null,
    suggestedUnitPrice: isFinite(suggestedUnitPrice) ? suggestedUnitPrice : 0,
    belowCost: isFinite(itemProfit) && itemProfit < -0.004,
    belowGoal: useManual && !invalidMargin && manual < suggestedUnitPrice - 0.004,
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

export function calcReversePrice(targetPrice: number, totalCost: number): ReversePricingResult {
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
  totalPotentialProfit: number; // sum of profitPerUnit for all priced products
  mostProfitable: Array<{ name: string; profit: number; margin: number }>;
  leastProfitable: Array<{ name: string; profit: number; margin: number }>;
}

export function calcCatalogKPIs(products: Product[], materials: Material[], costs: CostBase | null): CatalogKPIs {
  const pricings = products.map(p => ({
    name: p.name,
    ...calcProductPricing(p, materials, costs),
  }));

  const priced = pricings.filter(p => p.effectivePrice > 0 && p.hasCosts);

  const avgMargin = priced.length > 0 ? priced.reduce((a, p) => a + p.margin, 0) / priced.length : 0;

  const avgProfit = priced.length > 0 ? priced.reduce((a, p) => a + p.profitPerUnit, 0) / priced.length : 0;

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
    leastProfitable: sorted
      .slice(-5)
      .reverse()
      .map(p => ({ name: p.name, profit: p.profitPerUnit, margin: p.margin })),
  };
}
