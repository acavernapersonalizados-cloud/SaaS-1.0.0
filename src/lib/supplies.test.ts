// Outros insumos nas calculadoras (19/11/2026).
import { describe, expect, it } from 'vitest';
import type { Material } from '../types';
import { cleanSupplies, extraSuppliesCost } from './supplies';
import { calcLaserJob, calcSublimationJob } from './calculators';
import { calculatePrintPrice, NO_PRINT_FEES } from './printPricing';
import { jobProductDetails } from './jobProduct';

const materials = [
  { id: 'argola', name: 'Argola', unit: 'un', unitCost: 0.35 },
  { id: 'nfc', name: 'Tag NFC', unit: 'un', unitCost: 2.4 },
] as unknown as Material[];
const nfcLines = [
  { materialId: 'argola', quantity: 1 },
  { materialId: 'nfc', quantity: 1 },
];

const laser = {
  powerConsumptionW: 40,
  moduleReplacementCost: 0,
  diodeLifeH: 0,
  cuttingTimeMin: 6,
  engravingTimeMin: 0,
  passes: 1,
  electricityRate: 0,
  hourlyRate: 0,
  materialCost: 10,
  quantity: 10,
  markupPct: 100,
  manualPrice: null,
};

describe('Outros insumos', () => {
  it('custo por peça: argola R$ 0,35 + tag NFC R$ 2,40 = R$ 2,75', () => {
    expect(extraSuppliesCost(nfcLines, materials)).toBeCloseTo(2.75, 10);
    expect(extraSuppliesCost([{ materialId: 'nfc', quantity: 2 }], materials)).toBeCloseTo(4.8, 10);
    expect(extraSuppliesCost(undefined, materials)).toBe(0);
    expect(extraSuppliesCost([{ materialId: 'apagado', quantity: 3 }], materials)).toBe(0);
  });
  it('ao salvar, tira linha sem quantidade', () => {
    expect(cleanSupplies([...nfcLines, { materialId: 'nfc', quantity: 0 }])).toEqual(nfcLines);
  });
  it('Laser: soma ao custo da peça e entra no preço pelo markup; sem insumo, igual a antes', () => {
    const before = calcLaserJob(laser)!;
    const after = calcLaserJob({ ...laser, suppliesCost: 2.75 })!;
    expect(after.totalCostUnit).toBeCloseTo(before.totalCostUnit + 2.75, 10);
    expect(after.suggestedUnit).toBeCloseTo(before.suggestedUnit + 5.5, 10);
    expect(after.suppliesCost).toBe(2.75);
    expect(calcLaserJob({ ...laser, suppliesCost: 0 })).toEqual({ ...before, suppliesCost: 0 });
  });
  it('Sublimação: soma ao custo da peça', () => {
    const base = {
      baseCost: 12,
      sheetCost: 2.4,
      piecesPerSheet: 2,
      pressTimeS: 0,
      heatUpMin: 0,
      piecesPerBatch: 1,
      powerW: 0,
      electricityRate: 0,
      laborMinPerPiece: 0,
      hourlyRate: 0,
      packagingCost: 0,
      otherCost: 0,
      quantity: 1,
      markupPct: 100,
      manualPrice: null,
    };
    expect(calcSublimationJob({ ...base, suppliesCost: 2.75 })!.totalCostUnit).toBeCloseTo(13.2 + 2.75, 10);
    expect(calcSublimationJob(base)!.totalCostUnit).toBeCloseTo(13.2, 10);
  });
  it('3D: soma ao custo da peça, sem a taxa de falha (a peça pronta não falha)', () => {
    const base = {
      filamentUsedG: 10,
      filamentCostPerKg: 100,
      printTimeMin: 60,
      powerConsumptionW: 0,
      electricityRate: 0,
      hotendReplacementCost: 0,
      hotendLifeH: 0,
      bedReplacementCost: 0,
      bedLifeH: 0,
      maintenanceCostPerH: 0,
      hourlyRate: 0,
      failureRatePct: 10,
      packagingCost: 0,
      extrasCost: 0,
      markupPct: 100,
      quantity: 1,
      manualPrice: null,
      fees: NO_PRINT_FEES,
    };
    const before = calculatePrintPrice(base);
    const after = calculatePrintPrice({ ...base, suppliesCost: 2.75 });
    expect(after.totalCostUnit).toBeCloseTo(before.totalCostUnit + 2.75, 10);
    expect(after.suppliesCost).toBe(2.75);
  });
  it('produto criado do trabalho leva os insumos na receita, por peça', () => {
    const job = {
      id: 'j',
      name: 'Chaveiro NFC',
      quantity: 10,
      materialId: 'mdf',
      materialQty: 2,
      extraSupplies: nfcLines,
    };
    expect(jobProductDetails('laser', job as never).materials).toEqual([
      { materialId: 'mdf', quantity: 0.2 },
      { materialId: 'argola', quantity: 1 },
      { materialId: 'nfc', quantity: 1 },
    ]);
    expect(jobProductDetails('sublimacao', { ...job, baseMode: 'manual' } as never).materials).toEqual(nfcLines);
    const print = { ...job, filamentUsedG: 0, materialId: null };
    expect(jobProductDetails('print3d', print as never, () => 'g').materials).toEqual(nfcLines);
  });
  it('trabalho antigo, sem insumos: receita igual a antes', () => {
    const job = { id: 'j', name: 'x', quantity: 4, materialId: 'mdf', materialQty: 2 };
    expect(jobProductDetails('laser', job as never).materials).toEqual([{ materialId: 'mdf', quantity: 0.5 }]);
  });
});
