// Valores padrão das calculadoras (Etapa 4, A5; markup na Etapa 7; tarifa única na Etapa 7.2).
// Mudar qualquer um destes números muda o preço sugerido de quem não altera os campos.
import { describe, expect, it } from 'vitest';
import { CALCULATOR_DEFAULTS, DEFAULT_ELECTRICITY_RATE, electricityRateOf } from './defaults';

describe('Valores padrão das calculadoras', () => {
  it('Corte a Laser: hora R$ 25, markup 150%, tarifa 0,79 (Enel, com tributos)', () => {
    expect(CALCULATOR_DEFAULTS.laser).toEqual({ hourlyRate: 25, markupPct: 150, electricityRate: 0.79 });
  });
  it('Impressão 3D: hora R$ 12, markup 150%, tarifa 0,79 (a mesma do Laser)', () => {
    expect(CALCULATOR_DEFAULTS.print3d).toEqual({ hourlyRate: 12, markupPct: 150, electricityRate: 0.79 });
  });
  it('Papelaria: hora R$ 25, markup 150%', () => {
    expect(CALCULATOR_DEFAULTS.papelaria).toEqual({ hourlyRate: 25, markupPct: 150 });
  });
  it('Cestas: hora R$ 25, markup 150%', () => {
    expect(CALCULATOR_DEFAULTS.cesta).toEqual({ hourlyRate: 25, markupPct: 150 });
  });
});

describe('Tarifa de energia da loja (Etapa 7.2)', () => {
  it('padrão R$ 0,79/kWh (TU 0,39492 + TE 0,39401 com tributos)', () => {
    expect(DEFAULT_ELECTRICITY_RATE).toBe(0.79);
  });
  it('usa a tarifa gravada na Base de Custos; sem ela (ou inválida), a padrão', () => {
    expect(electricityRateOf({ electricityRate: 0.83 })).toBe(0.83);
    expect(electricityRateOf({})).toBe(0.79);
    expect(electricityRateOf({ electricityRate: 0 })).toBe(0.79);
    expect(electricityRateOf(null)).toBe(0.79);
  });
});
