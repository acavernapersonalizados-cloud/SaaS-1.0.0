/**
 * defaults.ts — valores iniciais dos campos das calculadoras.
 * Mudar um número aqui muda o preço sugerido de quem não altera o campo
 * (ver Etapa 7 do PLANO-ENXUGAMENTO.md antes de mexer).
 */
export const CALCULATOR_DEFAULTS = {
  // Tarifa: Enel São Paulo B1 (TUSD + TE), sem tributos e bandeira.
  laser: { hourlyRate: 25, markupPct: 150, electricityRate: 0.78938 },
  print3d: { hourlyRate: 12, markupPct: 150, electricityRate: 0.85 },
  papelaria: { hourlyRate: 25, markupPct: 150 },
  cesta: { hourlyRate: 25, markupPct: 150 },
};
