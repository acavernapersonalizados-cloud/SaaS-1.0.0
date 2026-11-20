// Item 35 (20/11/2026): produto da 3D em várias mesas.
import { describe, expect, it } from 'vitest';
import type { PrintPlate } from '../types';
import { filamentStockDeductions, printPerProduct } from './printPricing';

const pla = { name: 'PLA', color: '#fff', costPerKg: 100, grams: 0, materialId: 'pla' };
const petg = { name: 'PETG', color: '#000', costPerKg: 120, grams: 0, materialId: 'petg' };
const plate = (p: Partial<PrintPlate>): PrintPlate => ({
  name: '',
  printTimeMin: 0,
  filaments: [],
  purgeG: 0,
  yieldCount: 1,
  ...p,
});

describe('Mesas da 3D', () => {
  it('uma mesa que rende 1: igual a antes', () => {
    const one = plate({ printTimeMin: 120, filaments: [{ ...pla, grams: 50 }], purgeG: 3 });
    expect(printPerProduct([one])).toEqual({ printTimeMin: 120, filaments: one.filaments, purgeG: 3 });
  });

  it('exemplo do plano: base 2 h e 40 g (rende 1) + tampas 3 h e 60 g (rende 4) = 2 h 45 min e 55 g', () => {
    const r = printPerProduct([
      plate({ name: 'Base', printTimeMin: 120, filaments: [{ ...pla, grams: 40 }] }),
      plate({ name: 'Tampa', printTimeMin: 180, filaments: [{ ...pla, grams: 60 }], yieldCount: 4 }),
    ]);
    expect(r.printTimeMin).toBe(165);
    expect(r.filaments).toEqual([{ ...pla, grams: 55 }]);
    expect(r.purgeG).toBe(0);
  });

  it('filamentos diferentes ficam em linhas separadas; a purga entra nas gramas da mesa', () => {
    const r = printPerProduct([
      plate({ printTimeMin: 60, filaments: [{ ...pla, grams: 30 }], purgeG: 10 }),
      plate({ printTimeMin: 60, filaments: [{ ...petg, grams: 20 }], yieldCount: 2 }),
    ]);
    expect(r.filaments).toEqual([
      { ...pla, grams: 40 },
      { ...petg, grams: 10 },
    ]);
    expect(r.printTimeMin).toBe(90);
  });

  it('uma mesa que rende várias: divide tempo, gramas e purga', () => {
    const r = printPerProduct([
      plate({ printTimeMin: 200, filaments: [{ ...pla, grams: 80 }], purgeG: 4, yieldCount: 4 }),
    ]);
    expect(r).toEqual({ printTimeMin: 50, filaments: [{ ...pla, grams: 20 }], purgeG: 1 });
  });

  it('rende 0 ou vazio conta como 1; a baixa soma o mesmo rolo das duas mesas', () => {
    const r = printPerProduct([
      plate({ printTimeMin: 10, filaments: [{ ...pla, grams: 10 }], yieldCount: 0 }),
      plate({ printTimeMin: 10, filaments: [{ ...pla, grams: 10 }] }),
    ]);
    expect(r.printTimeMin).toBe(20);
    expect(filamentStockDeductions(r.filaments, r.purgeG, 3, () => 'g')).toEqual([
      { materialId: 'pla', grams: 60, amount: 60 },
    ]);
  });
});
