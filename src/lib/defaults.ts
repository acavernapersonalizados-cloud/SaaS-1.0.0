/**
 * defaults.ts — valores iniciais dos campos das calculadoras.
 * Mudar um número aqui muda o preço sugerido de quem não altera o campo
 * (ver Etapa 7 do PLANO-ENXUGAMENTO.md antes de mexer).
 */

/**
 * Tarifa de energia padrão (R$/kWh), usada pelo Laser e pela Impressão 3D (Etapa 7.2):
 * conta da Enel, TU 0,39492 + TE 0,39401 com tributos, faixa sem desconto social.
 * Cada loja pode gravar a sua na Base de Custos.
 */
export const DEFAULT_ELECTRICITY_RATE = 0.79;

/** Tarifa da loja (Base de Custos) ou, sem ela, a padrão. */
export function electricityRateOf(costs: { electricityRate?: number } | null | undefined): number {
  const rate = Number(costs?.electricityRate);
  return rate > 0 ? rate : DEFAULT_ELECTRICITY_RATE;
}

export const CALCULATOR_DEFAULTS = {
  laser: { hourlyRate: 25, markupPct: 150, electricityRate: DEFAULT_ELECTRICITY_RATE },
  print3d: { hourlyRate: 12, markupPct: 150, electricityRate: DEFAULT_ELECTRICITY_RATE },
  papelaria: { hourlyRate: 25, markupPct: 150 },
  cesta: { hourlyRate: 25, markupPct: 150 },
  // Etapa 8D-2: mesmos padrões das outras; aquecimento padrão de 10 min por leva.
  sublimacao: { hourlyRate: 25, markupPct: 150, electricityRate: DEFAULT_ELECTRICITY_RATE, heatUpMin: 10 },
};
