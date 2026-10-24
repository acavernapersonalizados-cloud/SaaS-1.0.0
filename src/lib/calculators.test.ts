// Corte a Laser, Papelaria e Cestas — valores do CHECKLIST-TESTES.md (seções 12, 14 e 15).
import { describe, expect, it } from 'vitest';
import {
  calcCestaJob,
  calcLaserJob,
  calcPapelariaJob,
  calcSublimationJob,
  laserTotalTimeMin,
  sumItemsCost,
} from './calculators';

describe('Corte a Laser (seção 12)', () => {
  // Máquina "TESTE Laser": 60 W, módulo de R$ 400 com 10.000 h. Trabalho: 10 + 5 min, 2 passadas,
  // material R$ 20 no lote, 4 peças, tarifa 0,78938, hora R$ 25, margem 60%.
  const input = {
    powerConsumptionW: 60,
    moduleReplacementCost: 400,
    diodeLifeH: 10000,
    cuttingTimeMin: 10,
    engravingTimeMin: 5,
    passes: 2,
    electricityRate: 0.78938,
    hourlyRate: 25,
    materialCost: 20,
    quantity: 4,
    markupPct: 150,
    manualPrice: null as number | null,
  };

  it('12.1 tempo por peça: 30 min', () => {
    expect(laserTotalTimeMin(10, 5, 2)).toBe(30);
  });
  it('12.2 custos por peça: energia R$ 0,02, desgaste R$ 0,02, mão de obra R$ 12,50, material R$ 5,00', () => {
    const r = calcLaserJob(input)!;
    expect(r.energyCost).toBeCloseTo(0.0236814, 7);
    expect(r.wearCost).toBeCloseTo(0.02, 10);
    expect(r.laborCost).toBeCloseTo(12.5, 10);
    expect(r.matPerUnit).toBeCloseTo(5, 10);
  });
  it('12.3 custo por peça R$ 17,54 e sugerido (60% do preço) R$ 43,86', () => {
    const r = calcLaserJob(input)!;
    expect(r.totalCostUnit).toBeCloseTo(17.54, 2);
    expect(r.suggestedUnit).toBeCloseTo(43.86, 2);
  });
  it('12.4 lote de 4: custo R$ 70,17 (4 × peça) e sugerido R$ 175,44', () => {
    const r = calcLaserJob(input)!;
    expect(r.totalCostBatch).toBeCloseTo(70.17, 2);
    expect(r.totalCostBatch).toBeCloseTo(r.totalCostUnit * 4, 10);
    expect(r.suggestedBatch).toBeCloseTo(175.44, 2);
  });
  it('12.5 preço manual R$ 15: prejuízo de R$ 2,54 por peça, margem −17,0%', () => {
    const r = calcLaserJob({ ...input, manualPrice: 15 })!;
    expect(r.profit).toBeCloseTo(-2.54, 2);
    expect(r.margin).toBeCloseTo(-16.96, 2);
  });
  it('canal Shopee (20% + R$ 4): (custo + 4) × (1 + markup) ÷ 0,8; lucro (custo + 4) × markup', () => {
    const base = calcLaserJob(input)!;
    const r = calcLaserJob({ ...input, channelFeePct: 20, channelFixedFee: 4 })!;
    expect(r.suggestedUnit).toBeCloseTo(((base.totalCostUnit + 4) * 2.5) / 0.8, 10);
    expect(r.profit).toBeCloseTo((base.totalCostUnit + 4) * 1.5, 10);
    expect(r.margin).toBeCloseTo((r.profit / r.suggestedUnit) * 100, 10);
  });
  it('Venda Direta (sem taxa) dá o mesmo resultado de antes', () => {
    expect(calcLaserJob({ ...input, channelFeePct: 0, channelFixedFee: 0 })).toEqual(calcLaserJob(input));
  });
  it('sem tempo de máquina não calcula; vida útil 0 não divide por zero', () => {
    expect(calcLaserJob({ ...input, cuttingTimeMin: 0, engravingTimeMin: 0 })).toBeNull();
    expect(calcLaserJob({ ...input, diodeLifeH: 0 })!.wearCost).toBe(0);
  });
});

describe('Papelaria (seção 14)', () => {
  // Papel 180g R$ 1,20 × 10 + Adesivo R$ 2,50 × 2; laminação R$ 8; encadernação R$ 5;
  // 30 + 15 + 15 min a R$ 25/h; 5 kits; margem 60%.
  const input = {
    materials: [
      { unitCost: 1.2, quantity: 10 },
      { unitCost: 2.5, quantity: 2 },
    ],
    laminationCost: 8,
    bindingCost: 5,
    assemblyTimeMin: 30,
    finishingTimeMin: 15,
    packagingTimeMin: 15,
    hourlyRate: 25,
    quantity: 5,
    markupPct: 150,
    manualPrice: null as number | null,
  };

  it('14.1 custo do lote: materiais R$ 17 + laminação R$ 8 + encadernação R$ 5 + mão de obra R$ 25 = R$ 55', () => {
    const r = calcPapelariaJob(input)!;
    expect(r.materialsCost).toBeCloseTo(17, 10);
    expect(r.laborCost).toBeCloseTo(25, 10);
    expect(r.totalCostBatch).toBeCloseTo(55, 10);
  });
  it('14.2 por kit: custo R$ 11,00, sugerido R$ 27,50, lote R$ 137,50, margem 60%', () => {
    const r = calcPapelariaJob(input)!;
    expect(r.totalCostUnit).toBeCloseTo(11, 10);
    expect(r.suggestedUnit).toBeCloseTo(27.5, 10);
    expect(r.suggestedBatch).toBeCloseTo(137.5, 10);
    expect(r.margin).toBeCloseTo(60, 10);
  });
  it('14.3 preço manual R$ 15: lucro R$ 4,00, margem 26,7%', () => {
    const r = calcPapelariaJob({ ...input, manualPrice: 15 })!;
    expect(r.profit).toBeCloseTo(4, 10);
    expect(r.margin).toBeCloseTo(26.67, 2);
  });
  it('14.4 material do estoque: TESTE Fita cetim R$ 1,20 × 3 = R$ 3,60', () => {
    expect(sumItemsCost([{ unitCost: 1.2, quantity: 3 }])).toBeCloseTo(3.6, 10);
  });
  it('canal Shopee (20% + R$ 4): sugerido R$ 46,88, lucro R$ 22,50', () => {
    const r = calcPapelariaJob({ ...input, channelFeePct: 20, channelFixedFee: 4 })!;
    expect(r.suggestedUnit).toBeCloseTo(46.875, 10);
    expect(r.profit).toBeCloseTo(22.5, 10);
  });
  it('sem materiais nem tempo não calcula', () => {
    expect(
      calcPapelariaJob({ ...input, materials: [], assemblyTimeMin: 0, finishingTimeMin: 0, packagingTimeMin: 0 }),
    ).toBeNull();
  });
});

describe('Cestas (seção 15)', () => {
  // Caneca R$ 15 × 1 + Chocolate R$ 4 × 3 + Café R$ 10 × 1; embalagem R$ 8, fitas R$ 3, tag R$ 1;
  // 30 min a R$ 25/h; frete R$ 10; comissão 10%; 1 cesta; margem 60%.
  const input = {
    items: [
      { unitCost: 15, quantity: 1 },
      { unitCost: 4, quantity: 3 },
      { unitCost: 10, quantity: 1 },
    ],
    packagingCost: 8,
    ribbonCost: 3,
    tagCost: 1,
    assemblyTimeMin: 30,
    hourlyRate: 25,
    deliveryCost: 10,
    commissionPct: 10,
    quantity: 1,
    markupPct: 150,
    manualPrice: null as number | null,
  };

  it('15.1 detalhamento: produtos R$ 37, embalagem R$ 12, mão de obra R$ 12,50, frete R$ 10, custo R$ 71,50', () => {
    const r = calcCestaJob(input)!;
    expect(r.itemsCost).toBeCloseTo(37, 10);
    expect(r.packagingTotal).toBeCloseTo(12, 10);
    expect(r.laborCost).toBeCloseTo(12.5, 10);
    expect(r.deliveryCost).toBe(10);
    expect(r.totalCostUnit).toBeCloseTo(71.5, 10);
  });
  it('15.2 markup 150% + comissão 10%: sugerido R$ 198,61, comissão R$ 19,86, lucro R$ 107,25 (custo × 1,5), margem real 54%', () => {
    const r = calcCestaJob(input)!;
    expect(r.suggestedUnit).toBeCloseTo(198.61, 2);
    expect(r.commissionValue).toBeCloseTo(19.86, 2);
    expect(r.profit).toBeCloseTo(107.25, 10);
    expect(r.margin).toBeCloseTo(54, 10);
  });
  it('15.3 comissão 0%: sugerido R$ 178,75', () => {
    expect(calcCestaJob({ ...input, commissionPct: 0 })!.suggestedUnit).toBeCloseTo(178.75, 10);
  });
  it('15.4 mesmos dados com 2 cestas: custo por cesta R$ 35,75 (itens são do lote inteiro)', () => {
    expect(calcCestaJob({ ...input, quantity: 2 })!.totalCostUnit).toBeCloseTo(35.75, 10);
  });
  it('comissão 10% + canal Shopee (20% + R$ 4): sugerido R$ 269,64, lucro R$ 113,25', () => {
    const r = calcCestaJob({ ...input, channelFeePct: 20, channelFixedFee: 4 })!;
    expect(r.suggestedUnit).toBeCloseTo((75.5 * 2.5) / 0.7, 10);
    expect(r.commissionValue).toBeCloseTo(r.suggestedUnit * 0.1, 10);
    expect(r.channelCost).toBeCloseTo(r.suggestedUnit * 0.2 + 4, 10);
    expect(r.profit).toBeCloseTo(113.25, 10);
  });
  it('15.6 comissão de 95%: sem preço possível, sugerido R$ 0,00', () => {
    const r = calcCestaJob({ ...input, commissionPct: 95 })!;
    expect(r.invalidMargin).toBe(true);
    expect(r.suggestedUnit).toBe(0);
  });
});

describe('Sublimação (Etapa 8D-2) — caneca de porcelana na Sun Special, conferida à mão', () => {
  // Sun Special SSH-012A-1: 350 W; tabela: caneca de porcelana 185 °C, 200 s. Aquecimento 10 min para uma leva
  // de 10 canecas (60 s por caneca). Tarifa 0,79. Peça base R$ 12,00; folha A4 (papel + tinta) R$ 2,40 com 2 canecas
  // por folha; mão de obra 5 min a R$ 25/h; embalagem R$ 1,50; outros R$ 0,50; 10 canecas; markup 150%.
  const input = {
    baseCost: 12,
    sheetCost: 2.4,
    piecesPerSheet: 2,
    pressTimeS: 200,
    heatUpMin: 10,
    piecesPerBatch: 10,
    powerW: 350,
    electricityRate: 0.79,
    laborMinPerPiece: 5,
    hourlyRate: 25,
    packagingCost: 1.5,
    otherCost: 0.5,
    quantity: 10,
    markupPct: 150,
    manualPrice: null,
  };
  it('partes do custo: papel R$ 1,20; aquecimento 60 s/caneca; energia 0,35 kW × 260 s × 0,79 = R$ 0,0200; mão de obra R$ 2,0833', () => {
    const r = calcSublimationJob(input)!;
    expect(r.paperInkCost).toBeCloseTo(1.2, 10);
    expect(r.heatShareS).toBeCloseTo(60, 10);
    expect(r.energyCost).toBeCloseTo(0.35 * (260 / 3600) * 0.79, 10); // 0,019969…
    expect(r.energyCost).toBeCloseTo(0.02, 4);
    expect(r.laborCost).toBeCloseTo(25 / 12, 10); // 2,0833…
  });
  it('custo por caneca R$ 17,30 e lote de 10 R$ 173,03', () => {
    const r = calcSublimationJob(input)!;
    expect(r.totalCostUnit).toBeCloseTo(17.3033, 4);
    expect(r.totalCostBatch).toBeCloseTo(173.033, 3);
  });
  it('sugerido com markup 150%: Venda Direta R$ 43,26; Shopee (20% + R$ 4) R$ 66,57', () => {
    expect(calcSublimationJob(input)!.suggestedUnit).toBeCloseTo(43.2583, 4);
    const shopee = calcSublimationJob({ ...input, channelFeePct: 20, channelFixedFee: 4 })!;
    expect(shopee.suggestedUnit).toBeCloseTo(((17.303302 + 4) * 2.5) / 0.8, 3); // 66,57
  });
  it('preço manual R$ 40 na Venda Direta: lucro R$ 22,70; na Shopee: R$ 40 − 17,30 − (8 + 4) = R$ 10,70', () => {
    expect(calcSublimationJob({ ...input, manualPrice: 40 })!.profit).toBeCloseTo(22.6967, 4);
    const shopee = calcSublimationJob({ ...input, manualPrice: 40, channelFeePct: 20, channelFixedFee: 4 })!;
    expect(shopee.profit).toBeCloseTo(40 - 17.303302 - 12, 4);
  });
  it('mesmas funções das outras calculadoras: sem peças na leva/folha conta 1; sem custo nenhum, sem resultado', () => {
    const umaPorVez = calcSublimationJob({ ...input, piecesPerBatch: 0, piecesPerSheet: 0 })!;
    expect(umaPorVez.heatShareS).toBe(600);
    expect(umaPorVez.paperInkCost).toBeCloseTo(2.4, 10);
    const zero = {
      ...input,
      baseCost: 0,
      sheetCost: 0,
      pressTimeS: 0,
      heatUpMin: 0,
      laborMinPerPiece: 0,
      packagingCost: 0,
      otherCost: 0,
    };
    expect(calcSublimationJob(zero)).toBeNull();
  });
});
