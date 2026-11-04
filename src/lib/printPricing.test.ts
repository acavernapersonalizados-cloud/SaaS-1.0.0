// Impressão 3D — valores do CHECKLIST-TESTES.md (seção 13).
import { describe, expect, it } from 'vitest';
import {
  calculatePrintPrice,
  filamentsFromGcode,
  filamentStockDeductions,
  formatMinutes,
  minutesOf,
  NO_PRINT_FEES,
  parsePrintGcode,
  printFeesFromChannel,
  printFilamentLabel,
  printFilamentTotals,
  splitHms,
  hmsToMinutes,
} from './printPricing';
import { DEFAULT_SALES_CHANNELS, findChannel } from './channels';

const shopee = printFeesFromChannel(findChannel(DEFAULT_SALES_CHANNELS, 'shopee'));

describe('Canais da Impressão 3D (tabela da loja)', () => {
  it('Elo7 não aparece mais (plataforma encerrada pela Enjoei)', () => {
    expect(findChannel(DEFAULT_SALES_CHANNELS, 'elo7')).toBeUndefined();
    expect(findChannel(DEFAULT_SALES_CHANNELS, 'Elo7')).toBeUndefined();
  });
  it('taxas da 3D vêm da tabela: Shopee 20% + R$ 4', () => {
    expect(shopee).toEqual({ commissionPercent: 20, paymentPercent: 0, fixedFee: 4, logisticsCost: 0 });
    expect(printFeesFromChannel(undefined)).toEqual(NO_PRINT_FEES);
  });
});

// Impressora "TESTE 3D" + trabalho PLA da seção 13.
const base = {
  filamentUsedG: 50,
  filamentCostPerKg: 80,
  printTimeH: 2,
  powerConsumptionW: 200,
  electricityRate: 0.85,
  acquisitionCost: 2000,
  lifetimeHours: 5000,
  hotendReplacementCost: 80,
  hotendLifeH: 500,
  bedReplacementCost: 60,
  bedLifeH: 2000,
  maintenanceCostPerH: 0.1,
  hourlyRate: 12,
  postProcessHours: 0.5,
  failureRatePct: 5,
  packagingCost: 2,
  extrasCost: 0,
  markupPct: 150,
  quantity: 1,
  manualPrice: null as number | null,
};
const direct = NO_PRINT_FEES;

describe('Impressão 3D — custo (13.1)', () => {
  const r = calculatePrintPrice({ ...base, fees: direct });
  it('detalhamento com taxa de falha de 5%', () => {
    expect(r.energyCost).toBeCloseTo(0.357, 10);
    expect(r.filamentCost).toBeCloseTo(4.2, 10);
    expect(r.hotendWear).toBeCloseTo(0.336, 10);
    expect(r.bedWear).toBeCloseTo(0.063, 10);
    expect(r.machineWear).toBeCloseTo(0.84, 10);
    expect(r.maintenance).toBeCloseTo(0.21, 10);
    expect(r.laborCost).toBeCloseTo(6.3, 10);
    expect(r.packagingCost).toBe(2);
    expect(r.channelCost).toBe(0);
  });
  it('13.2 totais: custo R$ 14,31, sugerido R$ 35,77, lucro R$ 21,46, margem 60%', () => {
    expect(r.totalCostUnit).toBeCloseTo(14.306, 10);
    expect(r.suggestedUnit).toBeCloseTo(35.765, 10);
    expect(r.profit).toBeCloseTo(21.459, 10);
    expect(r.margin).toBeCloseTo(60, 10);
    expect(r.invalidMargin).toBe(false);
  });
});

describe('Impressão 3D — canais, lote e preço manual', () => {
  it('13.3 Shopee da tabela (20% + R$ 4), markup 150%: sugerido R$ 57,21, lucro (custo + R$ 4) × 1,5 = R$ 27,46', () => {
    const r = calculatePrintPrice({ ...base, fees: shopee });
    expect(r.suggestedUnit).toBeCloseTo(((14.306 + 4) * 2.5) / 0.8, 3);
    expect(r.profit).toBeCloseTo((14.306 + 4) * 1.5, 3);
    expect(r.margin).toBeCloseTo((r.profit / r.suggestedUnit) * 100, 10);
  });
  it('13.4 quantidade 3: custo do lote R$ 42,92, sugerido do lote R$ 107,30', () => {
    const r = calculatePrintPrice({ ...base, quantity: 3, fees: direct });
    expect(r.totalCostBatch).toBeCloseTo(42.918, 10);
    expect(r.suggestedBatch).toBeCloseTo(107.295, 10);
  });
  it('13.5 preço manual R$ 20: lucro R$ 5,69, margem 28,5%', () => {
    const r = calculatePrintPrice({ ...base, manualPrice: 20, fees: direct });
    expect(r.profit).toBeCloseTo(5.694, 10);
    expect(r.margin).toBeCloseTo(28.47, 2);
  });
  it('taxa percentual do canal limitada a 95%', () => {
    const r = calculatePrintPrice({
      ...base,
      markupPct: 0,
      fees: { commissionPercent: 120, paymentPercent: 0, fixedFee: 0, logisticsCost: 0 },
    });
    expect(r.feePercent).toBe(95);
  });
  it('13.8 taxas do canal de 95%: sem preço possível, sugerido R$ 0,00', () => {
    const r = calculatePrintPrice({
      ...base,
      fees: { commissionPercent: 95, paymentPercent: 0, fixedFee: 0, logisticsCost: 0 },
    });
    expect(r.invalidMargin).toBe(true);
    expect(r.suggestedUnit).toBe(0);
  });
});

describe('Item 24: tempo em minutos', () => {
  it('1,3 h = 78 min; trabalho antigo (só horas) é lido sem perda', () => {
    expect(minutesOf(undefined, 1.3)).toBeCloseTo(78, 10);
    expect(minutesOf(78, 1.3)).toBe(78);
    expect(splitHms(78)).toEqual({ h: 1, min: 18, s: 0 });
    expect(formatMinutes(78)).toBe('1 h 18 min');
  });
  it('correção: h, min e s inteiros; G-code de 7h05m31s → 7 / 5 / 31 e volta exato', () => {
    const r = parsePrintGcode('; estimated printing time (normal mode) = 7h 5m 31s\n');
    expect(splitHms(r.printTimeMin!)).toEqual({ h: 7, min: 5, s: 31 });
    expect(hmsToMinutes(7, 5, 31)).toBeCloseTo(r.printTimeMin!, 10);
    expect(hmsToMinutes(1, 18, 0)).toBe(78);
  });

  it('trabalho antigo: em minutos dá o mesmo custo e o mesmo preço que em horas', () => {
    const { printTimeH: _h, postProcessHours: _p, ...rest } = base;
    for (const [h, p] of [
      [2, 0.5],
      [1.3, 0.25],
      [5.62, 0],
    ]) {
      const old = calculatePrintPrice({ ...rest, printTimeH: h, postProcessHours: p, fees: shopee });
      const novo = calculatePrintPrice({ ...rest, printTimeMin: h * 60, postProcessMin: p * 60, fees: shopee });
      expect(novo.totalCostUnit).toBeCloseTo(old.totalCostUnit, 9);
      expect(novo.suggestedUnit).toBeCloseTo(old.suggestedUnit, 9);
    }
  });
});

describe('Item 29: vários filamentos na mesma peça', () => {
  const line = (name: string, costPerKg: number, grams: number, materialId: string | null = null) => ({
    name,
    color: '#000000',
    costPerKg,
    grams,
    materialId,
  });

  it('um filamento só: mesma conta de antes, com os mesmos totais e o mesmo preço', () => {
    for (const [grams, cost] of [
      [50, 80],
      [82.02, 129.9],
      [0.37, 77.77],
    ] as const) {
      const totals = printFilamentTotals([line('PLA', cost, grams)]);
      expect(totals.usedG).toBe(grams);
      expect(totals.costPerKg).toBe(cost);
      const old = calculatePrintPrice({ ...base, filamentUsedG: grams, filamentCostPerKg: cost, fees: shopee });
      const novo = calculatePrintPrice({
        ...base,
        filamentUsedG: totals.usedG,
        filamentCostPerKg: totals.costPerKg,
        fees: shopee,
      });
      expect(novo).toEqual(old);
    }
  });
  it('duas cores: cada grama pelo preço do seu filamento (30 g a R$ 100 + 10 g a R$ 200 = R$ 5,00)', () => {
    const totals = printFilamentTotals([line('PLA', 100, 30), line('PETG', 200, 10)]);
    expect(totals.usedG).toBe(40);
    expect(totals.costPerKg).toBeCloseTo(125, 10);
    expect((totals.usedG / 1000) * totals.costPerKg).toBeCloseTo(5, 10);
  });
  it('purga: entra no custo e divide pelas gramas (30 + 10, purga 8 → 36 + 12 = R$ 6,00)', () => {
    const totals = printFilamentTotals([line('PLA', 100, 30), line('PETG', 200, 10)], 8);
    expect(totals.gramsWithPurge).toEqual([36, 12]);
    expect(totals.usedG).toBe(48);
    expect((totals.usedG / 1000) * totals.costPerKg).toBeCloseTo(6, 10);
  });
  it('sem gramas, a purga divide em partes iguais; nome junta os filamentos', () => {
    const lines = [line('PLA', 100, 0), line('PETG', 200, 0)];
    expect(printFilamentTotals(lines, 10).gramsWithPurge).toEqual([5, 5]);
    expect(printFilamentLabel(lines)).toBe('PLA + PETG');
  });
  it('baixa: por material, com purga e quantidade, na unidade de cada um', () => {
    const lines = [line('Preto', 100, 30, 'preto'), line('Branco', 200, 10, 'branco'), line('Sem vínculo', 90, 10)];
    const unit = (id: string) => (id === 'preto' ? 'kg' : 'g');
    expect(filamentStockDeductions(lines, 10, 2, unit)).toEqual([
      { materialId: 'preto', grams: 72, amount: 0.072 },
      { materialId: 'branco', grams: 24, amount: 24 },
    ]);
  });
  it('baixa: mesmo rolo em duas linhas soma; unidade que não é peso volta null', () => {
    const lines = [line('A', 100, 30, 'rolo'), line('B', 100, 10, 'rolo'), line('C', 100, 5, 'fita')];
    expect(filamentStockDeductions(lines, 0, 1, id => (id === 'rolo' ? 'KG' : 'm'))).toEqual([
      { materialId: 'rolo', grams: 40, amount: 0.04 },
      { materialId: 'fita', grams: 5, amount: null },
    ]);
  });
  it('sem vínculo ou sem gramas: nada sai do estoque', () => {
    expect(filamentStockDeductions([line('A', 100, 30), line('B', 100, 0, 'rolo')], 0, 1, () => 'g')).toEqual([]);
  });
});

describe('Item 29: G-code com vários filamentos', () => {
  const prusa = [
    '; filament used [g] = 12.50, 0.00, 3.20',
    '; total filament used [g] = 15.70',
    '; filament_colour = #FF0000;#00FF00;#0000FF',
    '; filament_type = PLA;PETG;ABS',
  ].join('\n');

  it('Creality Print (arquivo real de 4/11): 4 slots, 2 usados; tempo exato e nome do slicer sem a data', () => {
    const r = parsePrintGcode(
      [
        '; generated by Creality_Print V7.3.0.6157 on 2026-11-04 at 10:49:27',
        '; filament_density: 1.27,1.25,1.25,1.25',
        '; filament used [mm] = 2613.41, 0.00, 13131.71, 0.00',
        '; filament used [g] = 7.98, 0.00, 39.48, 0.00',
        '; filament cost = 0.11, 0.00, 0.24, 0.00',
        '; total filament used [g] = 47.47',
        '; estimated printing time (normal mode) = 2h 29m 19s',
        '; default_filament_colour = #ffffff;;#000000;',
        '; filament_colour = #ffffff;#BA8C63;#000000;#FFFF00',
        '; filament_type = PETG;PLA;PLA;PLA',
      ].join('\n'),
    );
    expect(r.slicer).toBe('Creality_Print V7.3.0.6157');
    expect(splitHms(r.printTimeMin!)).toEqual({ h: 2, min: 29, s: 19 });
    expect(r.filaments).toEqual([
      { grams: 7.98, color: '#ffffff', type: 'PETG' },
      { grams: 39.48, color: '#000000', type: 'PLA' },
    ]);
  });
  it('Prusa: gramas, cor e tipo da mesma posição; extrusora sem uso sai', () => {
    const r = parsePrintGcode(prusa);
    expect(r.filamentUsedG).toBeCloseTo(15.7, 10);
    expect(r.filaments).toEqual([
      { grams: 12.5, color: '#ff0000', type: 'PLA' },
      { grams: 3.2, color: '#0000ff', type: 'ABS' },
    ]);
  });
  it('Orca e Bambu: total em cima e lista no fim; sem espaço depois da vírgula', () => {
    const r = parsePrintGcode(
      [
        '; total filament weight [g] : 20.5',
        '; filament used [g] = 15.25,5.25',
        '; filament_colour = #000000FF;"#FFFFFF"',
        '; filament_type = PLA;PLA',
      ].join('\n'),
    );
    expect(r.filamentUsedG).toBeCloseTo(20.5, 10);
    expect(r.filaments).toEqual([
      { grams: 15.25, color: '#000000', type: 'PLA' },
      { grams: 5.25, color: '#ffffff', type: 'PLA' },
    ]);
  });
  it('uma cor e arquivo sem lista: leitura de antes', () => {
    const r = parsePrintGcode('; filament used [g] = 50.5\n');
    expect(r.filaments).toEqual([{ grams: 50.5, color: null, type: null }]);
    expect(parsePrintGcode('; total filament weight [g] : 9\n').filaments).toEqual([]);
  });
  it('linhas da tela: mantém vínculo e preço; filamento novo entra com o preço do primeiro', () => {
    const current = [
      { name: 'Preto 3DLAB', color: '#111111', costPerKg: 120, grams: 1, materialId: 'preto' },
      { name: 'PLA', color: '#222222', costPerKg: 90, grams: 1, materialId: null },
    ];
    const lines = filamentsFromGcode(current, [
      { grams: 10.123, color: '#ff0000', type: 'PLA' },
      { grams: 5, color: null, type: 'PETG' },
      { grams: 2, color: '#00ff00', type: 'TPU' },
    ]);
    expect(lines).toEqual([
      { name: 'Preto 3DLAB', color: '#ff0000', costPerKg: 120, grams: 10.12, materialId: 'preto' },
      { name: 'PETG', color: '#222222', costPerKg: 90, grams: 5, materialId: null },
      { name: 'TPU', color: '#00ff00', costPerKg: 120, grams: 2, materialId: null },
    ]);
  });
});

describe('Leitura de G-code (seção 13)', () => {
  const grams = (line: string) => parsePrintGcode(`;TIME:3600\n${line}\n`).filamentUsedG;

  it('arquivo de exemplo: 2 h, 50,5 g, PrusaSlicer 2.7', () => {
    const r = parsePrintGcode(';TIME:7200\n; filament used [g] = 50.5\n; generated by PrusaSlicer 2.7\n');
    expect(r.printTimeH).toBe(2);
    expect(r.filamentUsedG).toBe(50.5);
    expect(r.slicer).toBe('PrusaSlicer 2.7');
  });
  it('vírgula decimal: "12,5" → 12,5 g', () => {
    expect(grams('; filament used [g] = 12,5')).toBe(12.5);
  });
  it('duas extrusoras: "12.5, 3.2" → 15,7 g; "12, 5" → 17 g; "12,5;3,2" → 15,7 g', () => {
    expect(grams('; filament used [g] = 12.5, 3.2')).toBeCloseTo(15.7, 10);
    expect(grams('; filament used [g] = 12, 5')).toBe(17);
    expect(grams('; filament used [g] = 12,5;3,2')).toBeCloseTo(15.7, 10);
  });
  it('tempo no formato "1h 30m 0s" → 1,5 h', () => {
    expect(parsePrintGcode('; estimated printing time (normal mode) = 1h 30m 0s\n').printTimeH).toBe(1.5);
  });
  it('item 24: G-code de 5h37m12s → 337,2 min exatos (sem arredondar)', () => {
    const r = parsePrintGcode('; estimated printing time (normal mode) = 5h 37m 12s\n');
    expect(r.printTimeMin).toBeCloseTo(337.2, 10);
    expect(formatMinutes(r.printTimeMin!)).toBe('5 h 37 min 12 s');
    expect(splitHms(r.printTimeMin!)).toEqual({ h: 5, min: 37, s: 12 });
    expect(parsePrintGcode(';TIME:20232\n').printTimeMin).toBeCloseTo(337.2, 10);
  });
  it('item 24: Cura com menos de 1 h não vira 1 h; "1.5h" é 1,5 h (antes virava 5 h)', () => {
    expect(parsePrintGcode(';TIME:1800\n').printTimeMin).toBe(30);
    expect(parsePrintGcode('; Print time: 1.5h\n').printTimeMin).toBe(90);
  });
  it('arquivo sem tempo nem peso → null', () => {
    const r = parsePrintGcode('G1 X0 Y0\n');
    expect(r.printTimeH).toBeNull();
    expect(r.filamentUsedG).toBeNull();
  });
});
