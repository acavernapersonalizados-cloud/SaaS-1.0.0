// Navegação (Etapa 8B, item 3): as 4 calculadoras ficam numa guia só, "Calculadoras".
// Os códigos internos das abas (laser, print3d, papelaria, cestas) continuam os mesmos:
// cada um ainda abre a sua calculadora, agora dentro da guia.

export const CALCULATOR_TABS = [
  { id: 'laser', label: 'Corte a Laser' },
  { id: 'print3d', label: 'Impressão 3D' },
  { id: 'papelaria', label: 'Papelaria' },
  { id: 'cestas', label: 'Cestas' },
] as const;

/** Código do item "Calculadoras" no menu; ao clicar, abre a primeira calculadora. */
export const CALCULATORS_MENU_ID = 'calculators';

export const isCalculatorTab = (tab: string) => CALCULATOR_TABS.some(t => t.id === tab);

/** Menu de baixo do celular (confirmado em 24/10/2026), com nome curto quando o do menu é longo. */
export const MOBILE_NAV: ReadonlyArray<{ id: string; shortLabel?: string }> = [
  { id: 'pricing' },
  { id: CALCULATORS_MENU_ID },
  { id: 'products' },
  { id: 'history', shortLabel: 'Histórico' },
  { id: 'inventory' },
];
