import { energyCost as energyFor, laborCostFromHours, priceForMargin, wearCost } from './pricingEngine';

export interface PrintChannelFees {
  commissionPercent: number;
  paymentPercent: number;
  fixedFee: number;
  logisticsCost: number;
}

export interface PrintChannelPreset {
  id: string;
  label: string;
  fees: PrintChannelFees;
}

const noFees: PrintChannelFees = {
  commissionPercent: 0,
  paymentPercent: 0,
  fixedFee: 0,
  logisticsCost: 0,
};

export const PRINT_CHANNELS: PrintChannelPreset[] = [
  { id: 'direct', label: 'Venda direta', fees: { ...noFees } },
  { id: 'instagram', label: 'Instagram / WhatsApp', fees: { ...noFees, paymentPercent: 3.5 } },
  { id: 'shopee', label: 'Shopee', fees: { ...noFees, commissionPercent: 14, fixedFee: 4 } },
  { id: 'mercado-livre', label: 'Mercado Livre', fees: { ...noFees, commissionPercent: 14, fixedFee: 6 } },
  { id: 'elo7', label: 'Elo7', fees: { ...noFees, commissionPercent: 12 } },
  { id: 'custom', label: 'Personalizado', fees: { ...noFees } },
];

export const getPrintChannel = (id: string) => PRINT_CHANNELS.find(channel => channel.id === id) ?? PRINT_CHANNELS[0];

const safe = (value: number) => (Number.isFinite(value) && value >= 0 ? value : 0);

export function calculatePrintPrice(input: {
  filamentUsedG: number;
  filamentCostPerKg: number;
  printTimeH: number;
  powerConsumptionW: number;
  electricityRate: number;
  acquisitionCost?: number;
  lifetimeHours?: number;
  hotendReplacementCost: number;
  hotendLifeH: number;
  bedReplacementCost: number;
  bedLifeH: number;
  maintenanceCostPerH: number;
  hourlyRate: number;
  postProcessHours: number;
  failureRatePct: number;
  packagingCost: number;
  extrasCost: number;
  profitMarginPct: number;
  quantity: number;
  manualPrice: number | null;
  fees: PrintChannelFees;
}) {
  const hours = safe(input.printTimeH);
  const failFactor = 1 + safe(input.failureRatePct) / 100;
  const energyCost = energyFor(safe(input.powerConsumptionW), hours, safe(input.electricityRate)) * failFactor;
  const hotendWear = wearCost(safe(input.hotendReplacementCost), safe(input.hotendLifeH), hours) * failFactor;
  const bedWear = wearCost(safe(input.bedReplacementCost), safe(input.bedLifeH), hours) * failFactor;
  const machineWear = wearCost(safe(input.acquisitionCost ?? 0), safe(input.lifetimeHours ?? 0), hours) * failFactor;
  const maintenance = safe(input.maintenanceCostPerH) * hours * failFactor;
  const filamentCost = (safe(input.filamentUsedG) / 1000) * safe(input.filamentCostPerKg) * failFactor;
  const laborCost = laborCostFromHours(safe(input.hourlyRate), safe(input.postProcessHours)) * failFactor;
  const totalCostUnit =
    energyCost +
    hotendWear +
    bedWear +
    machineWear +
    maintenance +
    filamentCost +
    laborCost +
    safe(input.packagingCost) +
    safe(input.extrasCost);
  const feePercent = Math.min(95, safe(input.fees.commissionPercent) + safe(input.fees.paymentPercent));
  const fixedFees = safe(input.fees.fixedFee) + safe(input.fees.logisticsCost);
  // Margem sobre o preço, líquida das taxas do canal (percentuais e fixas).
  const marginPrice = priceForMargin(totalCostUnit, safe(input.profitMarginPct), feePercent, fixedFees);
  const invalidMargin = marginPrice === null;
  const suggestedUnit = marginPrice ?? 0;
  const priceRef = input.manualPrice && input.manualPrice > 0 ? input.manualPrice : suggestedUnit;
  const channelCost = (priceRef * feePercent) / 100 + fixedFees;
  const profit = priceRef - totalCostUnit - channelCost;
  const quantity = Math.max(1, safe(input.quantity));
  return {
    energyCost,
    hotendWear,
    bedWear,
    machineWear,
    maintenance,
    filamentCost,
    laborCost,
    packagingCost: safe(input.packagingCost),
    extrasCost: safe(input.extrasCost),
    totalCostUnit,
    totalCostBatch: totalCostUnit * quantity,
    suggestedUnit,
    suggestedBatch: suggestedUnit * quantity,
    invalidMargin,
    channelCost,
    feePercent,
    profit,
    margin: priceRef > 0 ? (profit / priceRef) * 100 : 0,
  };
}

function parseDuration(raw: string): number | null {
  const value = raw.trim();
  if (/^\d+$/.test(value)) return Math.max(1, Number(value) / 3600);
  let seconds = 0;
  let found = false;
  for (const [pattern, multiplier] of [
    [/(\d+)\s*d/i, 86400],
    [/(\d+)\s*h/i, 3600],
    [/(\d+)\s*m(?!m)/i, 60],
    [/(\d+)\s*s/i, 1],
  ] as const) {
    const match = value.match(pattern);
    if (match?.[1]) {
      seconds += Number(match[1]) * multiplier;
      found = true;
    }
  }
  return found ? seconds / 3600 : null;
}

// Soma o peso de cada extrusora. Separadores: ";" sempre; "," quando os
// números usam ponto decimal ("12.5, 3.2"); senão só ", " com espaço, para
// que "12,5" seja lido como 12,5 g e não como 12 + 5.
function sumGrams(raw: string): number {
  const value = raw.trim();
  const parts = value.includes(';') ? value.split(';') : value.includes('.') ? value.split(',') : value.split(/,\s+/);
  return parts
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => Number(part.replace(',', '.')))
    .filter(Number.isFinite)
    .reduce((sum, grams) => sum + grams, 0);
}

export function parsePrintGcode(content: string) {
  const sample = `${content.slice(0, 200000)}\n${content.slice(-200000)}`;
  const timePatterns = [
    /;\s*TIME\s*:\s*(\d+)/i,
    /;\s*estimated printing time.*?=\s*([^\n\r]+)/i,
    /;\s*total estimated time\s*:\s*([^\n\r]+)/i,
    /;\s*Print time\s*:\s*([^\n\r]+)/i,
    /;\s*model printing time\s*:\s*([^\n\r]+)/i,
  ];
  let printTimeH: number | null = null;
  for (const pattern of timePatterns) {
    const match = sample.match(pattern);
    if (match?.[1]) {
      printTimeH = parseDuration(match[1]);
      if (printTimeH !== null) break;
    }
  }
  const gramsMatch =
    sample.match(/;\s*(?:total\s+)?filament(?:[_ ](?:used|weight))?\s*\[g\]\s*[:=]\s*([0-9., ;]+)/i) ??
    sample.match(/;\s*Filament\s+weight\s*=\s*([0-9., ;]+)/i) ??
    sample.match(/;\s*filament_weight\s*[:=]\s*([0-9., ;]+)/i);
  const filamentUsedG = gramsMatch?.[1] ? sumGrams(gramsMatch[1]) : null;
  const slicer =
    sample.match(/;\s*generated by\s+([^\n\r,]+)/i)?.[1]?.trim() ??
    sample.match(/;\s*(PrusaSlicer|SuperSlicer|OrcaSlicer|BambuStudio|Cura)[^\n]*/i)?.[1] ??
    null;
  return { printTimeH, filamentUsedG: filamentUsedG && filamentUsedG > 0 ? filamentUsedG : null, slicer };
}
