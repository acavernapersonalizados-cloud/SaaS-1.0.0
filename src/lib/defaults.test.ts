// Valores padrão das calculadoras — comportamento atual (Etapa 4, A5).
// Mudar qualquer um destes números muda o preço sugerido de quem não altera os campos.
import { describe, expect, it } from 'vitest';
import { CALCULATOR_DEFAULTS } from './defaults';

describe('Valores padrão das calculadoras', () => {
  it('Corte a Laser: hora R$ 25, margem 60%, tarifa 0,78938 (Enel SP B1)', () => {
    expect(CALCULATOR_DEFAULTS.laser).toEqual({ hourlyRate: 25, profitMarginPct: 60, electricityRate: 0.78938 });
  });
  it('Impressão 3D: hora R$ 12, margem 60%, tarifa 0,85', () => {
    expect(CALCULATOR_DEFAULTS.print3d).toEqual({ hourlyRate: 12, profitMarginPct: 60, electricityRate: 0.85 });
  });
  it('Papelaria: hora R$ 25, margem 60%', () => {
    expect(CALCULATOR_DEFAULTS.papelaria).toEqual({ hourlyRate: 25, profitMarginPct: 60 });
  });
  it('Cestas: hora R$ 25, margem 60%', () => {
    expect(CALCULATOR_DEFAULTS.cesta).toEqual({ hourlyRate: 25, profitMarginPct: 60 });
  });
});
