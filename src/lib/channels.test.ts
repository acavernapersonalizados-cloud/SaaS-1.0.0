// Etapa 7, item 5 — tabela única de canais de venda por loja.
import { describe, expect, it } from 'vitest';
import { channelFees, channelsOf, DEFAULT_SALES_CHANNELS, findChannel, manualPriceByChannel } from './channels';
import type { Material, Product } from '../types';
import { calcProductCost, calcQuoteItem, markupOf } from './pricingEngine';
import { calcCestaJob, calcLaserJob } from './calculators';

describe('Tabela de canais', () => {
  it('valores aprovados em 19/10/2026', () => {
    const t = Object.fromEntries(
      DEFAULT_SALES_CHANNELS.map(c => [c.name, [c.commissionPct, c.fixedFee, c.paymentPct]]),
    );
    expect(t).toEqual({
      'Venda Direta': [0, 0, 0],
      Instagram: [0, 0, 3.5],
      Atacado: [5, 0, 0],
      Shopee: [20, 4, 0],
      'Mercado Livre': [18, 0, 0],
      iFood: [26.5, 0, 0],
      '99Food': [13, 0, 0],
    });
  });
  it('não tem Elo7 nem Keeta', () => {
    const names = DEFAULT_SALES_CHANNELS.map(c => c.name.toLowerCase());
    expect(names).not.toContain('elo7');
    expect(names).not.toContain('keeta');
  });
  it('loja sem tabela gravada usa a padrão; com tabela, usa a dela', () => {
    expect(channelsOf(null)).toEqual(DEFAULT_SALES_CHANNELS);
    expect(channelsOf({ salesChannels: [] })).toEqual(DEFAULT_SALES_CHANNELS);
    const propria = [{ id: 'x', name: 'Feira', commissionPct: 10, fixedFee: 0, paymentPct: 0 }];
    expect(channelsOf({ salesChannels: propria })).toEqual(propria);
  });
  it('taxas: comissão + pagamento (até 95%) e taxa fixa', () => {
    expect(channelFees({ commissionPct: 20, paymentPct: 0, fixedFee: 4 })).toEqual({ feePct: 20, fixedFee: 4 });
    expect(channelFees({ commissionPct: 0, paymentPct: 3.5, fixedFee: 0 })).toEqual({ feePct: 3.5, fixedFee: 0 });
    expect(channelFees({ commissionPct: 80, paymentPct: 30, fixedFee: -2 })).toEqual({ feePct: 95, fixedFee: 0 });
    expect(channelFees(undefined)).toEqual({ feePct: 0, fixedFee: 0 });
  });
  it('acha o canal pelo id ou pelo nome (orçamentos antigos guardam o nome)', () => {
    expect(findChannel(DEFAULT_SALES_CHANNELS, 'shopee')?.name).toBe('Shopee');
    expect(findChannel(DEFAULT_SALES_CHANNELS, 'Mercado Livre')?.id).toBe('mercado-livre');
    expect(findChannel(DEFAULT_SALES_CHANNELS, 'Elo7')).toBeUndefined();
  });
});

// Etapa 8B, item 5 — lucro de um preço manual em cada canal: tem que bater, centavo a centavo,
// com o orçamento (calcQuoteItem) e com as calculadoras (Laser e Cestas com comissão).
describe('Preço manual em cada canal (manualPriceByChannel)', () => {
  const costs = { storeId: 'loja', fixedCosts: 0, productiveHours: 0, profitGoal: 0, markupPct: 150, hourlyRate: 20 };
  const materials = [
    { id: 'mdf', unitCost: 15 },
    { id: 'argola', unitCost: 0.25 },
  ] as Material[];
  const chaveiro = {
    id: 'chaveiro',
    name: 'TESTE Chaveiro',
    productionTime: 15,
    packagingCost: 0.75,
    materials: [
      { materialId: 'mdf', quantity: 0.1 },
      { materialId: 'argola', quantity: 1 },
    ],
  } as unknown as Product;

  it('o preço do orçamento em cada canal, digitado como manual, dá o mesmo lucro e fica na meta', () => {
    const cost = calcProductCost(chaveiro, materials, costs).totalCost; // R$ 7,00
    for (const channel of DEFAULT_SALES_CHANNELS) {
      const { feePct, fixedFee } = channelFees(channel);
      const quote = calcQuoteItem(
        { productId: 'chaveiro', quantity: 1 },
        chaveiro,
        materials,
        costs,
        feePct,
        fixedFee,
      )!;
      const [row] = manualPriceByChannel(quote.unitPrice, cost, [channel], markupOf(costs));
      expect(row.profit).toBeCloseTo(quote.itemProfit, 10);
      expect(row.fees).toBeCloseTo(quote.itemPlatformFee, 10);
      expect(row.margin).toBeCloseTo(quote.margin, 10);
      expect(row.goalPrice).toBeCloseTo(quote.unitPrice, 10);
      expect(row.meetsGoal).toBe(true);
    }
  });

  it('abaixo da meta: R$ 20 no chaveiro (custo R$ 7, markup 150%)', () => {
    const rows = manualPriceByChannel(20, 7, DEFAULT_SALES_CHANNELS, 150);
    const direta = rows.find(r => r.channel.id === 'venda-direta')!;
    expect(direta.profit).toBeCloseTo(13, 10);
    expect(direta.goalPrice).toBeCloseTo(17.5, 10);
    expect(direta.meetsGoal).toBe(true);
    const shopee = rows.find(r => r.channel.id === 'shopee')!;
    expect(shopee.fees).toBeCloseTo(8, 10); // 20% de R$ 20 + R$ 4
    expect(shopee.profit).toBeCloseTo(5, 10);
    expect(shopee.goalPrice).toBeCloseTo(34.375, 10); // (7 + 4) × 2,5 ÷ 0,8
    expect(shopee.meetsGoal).toBe(false);
  });

  it('bate com o Corte a Laser no canal escolhido (seção 12, preço manual R$ 15, Shopee)', () => {
    const shopee = findChannel(DEFAULT_SALES_CHANNELS, 'shopee')!;
    const { feePct, fixedFee } = channelFees(shopee);
    const r = calcLaserJob({
      powerConsumptionW: 60,
      moduleReplacementCost: 400,
      diodeLifeH: 10000,
      cuttingTimeMin: 10,
      engravingTimeMin: 5,
      passes: 2,
      electricityRate: 0.79,
      hourlyRate: 25,
      materialCost: 20,
      quantity: 4,
      markupPct: 150,
      channelFeePct: feePct,
      channelFixedFee: fixedFee,
      manualPrice: 15,
    })!;
    const [row] = manualPriceByChannel(15, r.totalCostUnit, [shopee], 150);
    expect(row.profit).toBeCloseTo(r.profit, 10);
    expect(row.margin).toBeCloseTo(r.margin, 10);
    expect(row.goalPrice).toBeCloseTo(r.suggestedUnit, 10);
  });

  it('Cestas: a comissão do vendedor entra como % extra em todos os canais', () => {
    const ifood = findChannel(DEFAULT_SALES_CHANNELS, 'ifood')!;
    const { feePct, fixedFee } = channelFees(ifood);
    const r = calcCestaJob({
      items: [{ unitCost: 30, quantity: 1 }],
      assemblyTimeMin: 30,
      hourlyRate: 25,
      packagingCost: 5,
      ribbonCost: 2,
      tagCost: 1,
      deliveryCost: 0,
      commissionPct: 10,
      quantity: 1,
      markupPct: 100,
      channelFeePct: feePct,
      channelFixedFee: fixedFee,
      manualPrice: 120,
    })!;
    const [row] = manualPriceByChannel(120, r.totalCostUnit, [ifood], 100, 10);
    expect(row.profit).toBeCloseTo(r.profit, 10);
    expect(row.goalPrice).toBeCloseTo(r.suggestedUnit, 10);
  });

  it('taxas de 95% ou mais: sem preço de meta', () => {
    const caro = { id: 'x', name: 'X', commissionPct: 90, fixedFee: 0, paymentPct: 10 };
    const [row] = manualPriceByChannel(50, 10, [caro], 150);
    expect(row.goalPrice).toBeNull();
    expect(row.meetsGoal).toBeNull();
  });
});
