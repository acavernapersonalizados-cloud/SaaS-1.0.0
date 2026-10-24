// Orçamentos: validade e rótulo das taxas do canal (Etapa 8A, saídos de Pricing.tsx).
import { formatCurrency, formatPercent } from './utils';

// Validade do orçamento: usada na data gravada (e no PDF) e no texto da tela.
export const QUOTE_VALIDITY_DAYS = 5;

/** Ex.: "20,0% + R$ 4,00/un" (a parte fixa só aparece quando existe). */
export const feeLabel = (pct: number, fixed: number) =>
  `${formatPercent(pct)}${fixed > 0 ? ` + ${formatCurrency(fixed)}/un` : ''}`;
