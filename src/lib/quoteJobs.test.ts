// Item 34 (20/11/2026): trabalho de calculadora direto no orçamento.
import { describe, expect, it } from 'vitest';
import type { CostBase, Product } from '../types';
import { calcQuoteItem } from './pricingEngine';
import { isJobItemId, jobAsQuoteProduct, jobItemFields, jobItemId } from './quoteJobs';

const laserJob = {
  id: 'j1',
  name: 'Chaveiro NFC',
  totalCostUnit: 4.42,
  unitPrice: 8.84,
  quantity: 10,
  materialId: 'mdf',
  materialQty: 2,
  extraSupplies: [{ materialId: 'nfc', quantity: 1 }],
};
const costs = { fixedCosts: 0, productiveHours: 0, profitGoal: 0, hourlyRate: 30, storeId: 'loja' } as CostBase;

describe('Trabalho no orçamento', () => {
  it('vira produto só na tela: id do trabalho, custo e preço gravados, receita por peça', () => {
    const p = jobAsQuoteProduct('laser', laserJob as never, 'loja')!;
    expect(p.id).toBe('job:laser:j1');
    expect(isJobItemId(p.id)).toBe(true);
    expect(isJobItemId('produto-normal')).toBe(false);
    expect(p.name).toBe('Chaveiro NFC (trabalho Laser)');
    expect(p.jobCostUnit).toBe(4.42);
    expect(p.manualPrice).toBe(8.84);
    expect(p.materials).toEqual([
      { materialId: 'mdf', quantity: 0.2 },
      { materialId: 'nfc', quantity: 1 },
    ]);
  });

  it('no orçamento (venda direta), sai pelo preço do trabalho', () => {
    const p = jobAsQuoteProduct('laser', laserJob as never, 'loja')!;
    const r = calcQuoteItem({ productId: p.id, quantity: 3 }, p, [], costs, 0)!;
    expect(r.unitPrice).toBeCloseTo(8.84, 2);
    expect(r.totalPrice).toBeCloseTo(26.52, 2);
  });

  it('fica de fora: já é produto, sem custo ou sem preço', () => {
    expect(jobAsQuoteProduct('laser', { ...laserJob, productId: 'p1' } as never, 'loja')).toBeNull();
    expect(jobAsQuoteProduct('laser', { ...laserJob, totalCostUnit: undefined } as never, 'loja')).toBeNull();
    expect(jobAsQuoteProduct('laser', { ...laserJob, unitPrice: 0 } as never, 'loja')).toBeNull();
  });

  it('3D: filamento já baixado ao salvar sai da receita (não baixa duas vezes); o resto fica', () => {
    const job = {
      id: 'p3',
      name: 'Vaso',
      totalCostUnit: 10,
      unitPrice: 25,
      quantity: 1,
      filaments: [{ name: 'PLA', color: '', costPerKg: 100, grams: 50, materialId: 'pla' }],
      purgeG: 0,
      extraSupplies: [{ materialId: 'ima', quantity: 2 }],
    };
    const full = jobAsQuoteProduct('print3d', job as never, 'loja', false)!;
    expect(full.materials.map(m => m.materialId)).toContain('ima');
    const taken = jobAsQuoteProduct('print3d', job as never, 'loja', true)!;
    expect(taken.materials).toEqual([{ materialId: 'ima', quantity: 2 }]);
  });

  it('o item grava a receita do trabalho; produto normal não grava nada a mais', () => {
    const p = jobAsQuoteProduct('laser', laserJob as never, 'loja')!;
    const products = [p, { id: 'normal', name: 'Caneca', materials: [] } as unknown as Product];
    expect(jobItemFields(jobItemId('laser', 'j1'), products)).toEqual({ jobRecipe: p.materials });
    expect(jobItemFields('normal', products)).toEqual({});
  });
});
