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
  const energyCost = (safe(input.powerConsumptionW) / 1000) * hours * safe(input.electricityRate) * failFactor;
  const hotendWear =
    safe(input.hotendLifeH) > 0
      ? (safe(input.hotendReplacementCost) / safe(input.hotendLifeH)) * hours * failFactor
      : 0;
  const bedWear =
    safe(input.bedLifeH) > 0 ? (safe(input.bedReplacementCost) / safe(input.bedLifeH)) * hours * failFactor : 0;
  const machineWear =
    safe(input.lifetimeHours ?? 0) > 0
      ? (safe(input.acquisitionCost ?? 0) / safe(input.lifetimeHours ?? 0)) * hours * failFactor
      : 0;
  const maintenance = safe(input.maintenanceCostPerH) * hours * failFactor;
  const filamentCost = (safe(input.filamentUsedG) / 1000) * safe(input.filamentCostPerKg) * failFactor;
  const laborCost = safe(input.hourlyRate) * safe(input.postProcessHours) * failFactor;
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
  const suggestedUnit = (totalCostUnit * (1 + safe(input.profitMarginPct) / 100) + fixedFees) / (1 - feePercent / 100);
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
  const filamentUsedG = gramsMatch?.[1]
    ? gramsMatch[1]
        .split(/[;,]/)
        .map(value => Number(value.trim().replace(',', '.')))
        .filter(Number.isFinite)
        .reduce((sum, value) => sum + value, 0)
    : null;
  const slicer =
    sample.match(/;\s*generated by\s+([^\n\r,]+)/i)?.[1]?.trim() ??
    sample.match(/;\s*(PrusaSlicer|SuperSlicer|OrcaSlicer|BambuStudio|Cura)[^\n]*/i)?.[1] ??
    null;
  return { printTimeH, filamentUsedG: filamentUsedG && filamentUsedG > 0 ? filamentUsedG : null, slicer };
}
