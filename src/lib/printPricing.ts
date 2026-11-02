import type { SalesChannel } from '../types';
import { energyCost as energyFor, laborCostFromHours, priceForMarkup, wearCost } from './pricingEngine';

export interface PrintChannelFees {
  commissionPercent: number;
  paymentPercent: number;
  fixedFee: number;
  logisticsCost: number;
}

export const NO_PRINT_FEES: PrintChannelFees = {
  commissionPercent: 0,
  paymentPercent: 0,
  fixedFee: 0,
  logisticsCost: 0,
};

/** Opção "Personalizado": taxas digitadas à mão na própria 3D. */
export const CUSTOM_PRINT_CHANNEL = 'custom';

/** Taxas da 3D a partir de um canal da tabela da loja (Etapa 7). Logística fica para digitar à mão. */
export const printFeesFromChannel = (channel: SalesChannel | undefined): PrintChannelFees =>
  channel
    ? {
        commissionPercent: channel.commissionPct,
        paymentPercent: channel.paymentPct,
        fixedFee: channel.fixedFee,
        logisticsCost: 0,
      }
    : { ...NO_PRINT_FEES };

const safe = (value: number) => (Number.isFinite(value) && value >= 0 ? value : 0);

/**
 * Item 24 (2/11/2026): o tempo da 3D é em MINUTOS (com fração, para os segundos do G-code). Trabalho salvo antes só
 * tem horas: horas × 60, sem perda (1,3 h = 78 min).
 */
export const minutesOf = (minutes: number | null | undefined, hours: number | null | undefined) =>
  minutes !== null && minutes !== undefined && Number.isFinite(Number(minutes))
    ? Number(minutes)
    : (Number(hours) || 0) * 60;

/** Minutos → campos "h" e "min" da tela (o "min" pode ter fração: 37,2 min = 37 min 12 s). */
export function splitMinutes(minutes: number): { h: number; min: number } {
  const total = Math.max(0, Number(minutes) || 0);
  const h = Math.floor(total / 60);
  return { h, min: Math.round((total - h * 60) * 1e6) / 1e6 };
}

/** "5 h 37 min 12 s" (sem as partes zeradas; 0 → "0 min"). */
export function formatMinutes(minutes: number): string {
  const totalSec = Math.round(Math.max(0, Number(minutes) || 0) * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [h ? `${h} h` : '', m ? `${m} min` : '', s ? `${s} s` : ''].filter(Boolean);
  return parts.length ? parts.join(' ') : '0 min';
}

export function calculatePrintPrice(input: {
  filamentUsedG: number;
  filamentCostPerKg: number;
  /** Tempo de impressão em minutos (item 24). Sem ele, vale `printTimeH`. */
  printTimeMin?: number;
  printTimeH?: number;
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
  /** Pós-processamento (mão de obra) em minutos (item 24). Sem ele, vale `postProcessHours`. */
  postProcessMin?: number;
  postProcessHours?: number;
  failureRatePct: number;
  packagingCost: number;
  extrasCost: number;
  /** Markup sobre o custo (%). */
  markupPct: number;
  quantity: number;
  manualPrice: number | null;
  fees: PrintChannelFees;
}) {
  // Minutos ÷ 60, sem arredondar antes do preço final.
  const hours = safe(minutesOf(input.printTimeMin, input.printTimeH)) / 60;
  const postProcessHours = safe(minutesOf(input.postProcessMin, input.postProcessHours)) / 60;
  const failFactor = 1 + safe(input.failureRatePct) / 100;
  const energyCost = energyFor(safe(input.powerConsumptionW), hours, safe(input.electricityRate)) * failFactor;
  const hotendWear = wearCost(safe(input.hotendReplacementCost), safe(input.hotendLifeH), hours) * failFactor;
  const bedWear = wearCost(safe(input.bedReplacementCost), safe(input.bedLifeH), hours) * failFactor;
  const machineWear = wearCost(safe(input.acquisitionCost ?? 0), safe(input.lifetimeHours ?? 0), hours) * failFactor;
  const maintenance = safe(input.maintenanceCostPerH) * hours * failFactor;
  const filamentCost = (safe(input.filamentUsedG) / 1000) * safe(input.filamentCostPerKg) * failFactor;
  const laborCost = laborCostFromHours(safe(input.hourlyRate), postProcessHours) * failFactor;
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
  const marginPrice = priceForMarkup(totalCostUnit, safe(input.markupPct), feePercent, fixedFees);
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

/**
 * Duração do slicer em SEGUNDOS exatos. Item 24: ";TIME:1800" (Cura) era lido com mínimo de 1 h (agora 30 min) e
 * "1.5h" virava 5 h (agora 1,5 h).
 */
function parseDurationSeconds(raw: string): number | null {
  const value = raw.trim();
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  let seconds = 0;
  let found = false;
  for (const [pattern, multiplier] of [
    [/(\d+(?:[.,]\d+)?)\s*d/i, 86400],
    [/(\d+(?:[.,]\d+)?)\s*h/i, 3600],
    [/(\d+(?:[.,]\d+)?)\s*m(?!m)/i, 60],
    [/(\d+(?:[.,]\d+)?)\s*s/i, 1],
  ] as const) {
    const match = value.match(pattern);
    if (match?.[1]) {
      seconds += Number(match[1].replace(',', '.')) * multiplier;
      found = true;
    }
  }
  return found ? seconds : null;
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
  let seconds: number | null = null;
  for (const pattern of timePatterns) {
    const match = sample.match(pattern);
    if (match?.[1]) {
      seconds = parseDurationSeconds(match[1]);
      if (seconds !== null) break;
    }
  }
  const printTimeMin = seconds !== null && seconds > 0 ? seconds / 60 : null;
  const printTimeH = printTimeMin !== null ? printTimeMin / 60 : null;
  const gramsMatch =
    sample.match(/;\s*(?:total\s+)?filament(?:[_ ](?:used|weight))?\s*\[g\]\s*[:=]\s*([0-9., ;]+)/i) ??
    sample.match(/;\s*Filament\s+weight\s*=\s*([0-9., ;]+)/i) ??
    sample.match(/;\s*filament_weight\s*[:=]\s*([0-9., ;]+)/i);
  const filamentUsedG = gramsMatch?.[1] ? sumGrams(gramsMatch[1]) : null;
  const slicer =
    sample.match(/;\s*generated by\s+([^\n\r,]+)/i)?.[1]?.trim() ??
    sample.match(/;\s*(PrusaSlicer|SuperSlicer|OrcaSlicer|BambuStudio|Cura)[^\n]*/i)?.[1] ??
    null;
  return {
    printTimeMin,
    printTimeH,
    filamentUsedG: filamentUsedG && filamentUsedG > 0 ? filamentUsedG : null,
    slicer,
  };
}
