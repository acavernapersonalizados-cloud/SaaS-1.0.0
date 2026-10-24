/**
 * sublimation.ts — tabela de sublimação e máquinas padrão (Etapa 8D-1).
 * Fonte: tabela-sublimacao.md (raiz do projeto): etiquetas/manuais das máquinas do usuário (todas em 220 V) e a
 * tabela SUGESTIVA da STC Smart Deko (varia conforme o material; testar antes de produzir).
 * Sem custo nem preço aqui: isso fica no 8D-2.
 */

export type SublimationEquipment =
  'Prensa de canetas' | 'Prensa plana' | 'Prensa de canecas e copos' | 'Prensa de pratos' | 'Prensa 3D';

export interface SublimationRow {
  equipment: SublimationEquipment;
  product: string;
  tempC: number;
  /** Tempo em segundos (a tabela da Prensa 3D vem em minutos). */
  timeS: number;
  /** Pressão sugerida; null quando a tabela não indica (Prensa 3D). */
  pressure: string | null;
}

const row = (
  equipment: SublimationEquipment,
  product: string,
  tempC: number,
  timeS: number,
  pressure: string | null,
): SublimationRow => ({ equipment, product, tempC, timeS, pressure });

const PLANA = 'Prensa plana';
const CANECAS = 'Prensa de canecas e copos';
const P3D = 'Prensa 3D';
const min = (m: number) => m * 60;

export const SUBLIMATION_TABLE: SublimationRow[] = [
  row('Prensa de canetas', 'Canetas', 180, 10, 'Fraca'),
  row(PLANA, 'Azulejo de cerâmica', 200, 400, 'Média/fraca'),
  row(PLANA, 'Azulejo de vidro', 200, 200, 'Média/fraca'),
  row(PLANA, 'Chinelo', 200, 25, 'Média'),
  row(PLANA, 'Guarda-chuva', 200, 25, 'Forte'),
  row(PLANA, 'Madeira (MDF)', 200, 25, 'Forte'),
  row(PLANA, 'Neoprene', 200, 20, 'Forte'),
  row(PLANA, 'Mouse pad', 200, 25, 'Forte'),
  row(PLANA, 'Papel adesivo', 200, 45, 'Forte'),
  row(PLANA, 'Papel ímã', 200, 25, 'Forte'),
  row(PLANA, 'Pedras', 200, 400, 'Média/fraca'),
  row(PLANA, 'Placa de alumínio', 200, 30, 'Forte'),
  row(PLANA, 'Porta-copos EVA/PET', 200, 25, 'Forte'),
  row(PLANA, 'Porta-retrato (vidro)', 200, 400, 'Média/fraca'),
  row(PLANA, 'Power film', 200, 12, 'Forte'),
  row(PLANA, 'Quebra-cabeça', 200, 40, 'Forte'),
  row(PLANA, 'Sacola PET', 200, 25, 'Forte'),
  row(PLANA, 'Tecidos convencionais', 200, 25, 'Forte'),
  row(PLANA, 'Tecidos em poliéster', 230, 35, 'Forte'),
  row(PLANA, 'TNT fino (Polipaper)', 150, 12, 'Forte'),
  row(PLANA, 'TNT grosso (Blue Paper)', 200, 20, 'Forte'),
  row(PLANA, 'Toalha comum', 200, 25, 'Forte'),
  row(PLANA, 'Toalha 100% sublimável', 200, 30, 'Forte'),
  row(CANECAS, 'Caneca de alumínio', 185, 160, 'Fraca'),
  row(CANECAS, 'Caneca de plástico/acrílico', 150, 150, 'Fraca'),
  row(CANECAS, 'Caneca de porcelana', 185, 200, 'Forte'),
  row(CANECAS, 'Caneca de vidro', 175, 200, 'Fraca'),
  row(CANECAS, 'Caneca de vidro (chopp)', 180, 215, 'Fraca'),
  row(CANECAS, 'Squeeze de alumínio', 200, 190, 'Fraca'),
  row('Prensa de pratos', 'Pratos', 195, 150, 'Fraca'),
  row(P3D, 'Azulejo de cerâmica', 200, min(7), null),
  row(P3D, 'Azulejo de vidro', 200, min(7), null),
  row(P3D, 'Caneca de porcelana', 200, min(9), null),
  row(P3D, 'Capinha de celular', 200, min(8), null),
  row(P3D, 'Chinelo', 200, min(3), null),
  row(P3D, 'Lata', 200, min(8), null),
  row(P3D, 'Pedras', 200, min(8), null),
  row(P3D, 'Placa de alumínio', 200, min(7), null),
  row(P3D, 'Porta-retrato (vidro)', 200, min(7), null),
  row(P3D, 'Quebra-cabeça', 200, min(4), null),
];

/** Dicas da tabela (mostradas na tela junto do aviso de que ela é sugestiva). */
export const SUBLIMATION_TIPS = [
  'Papel ímã: colocar na quina da prensa para evitar entrada de ar.',
  'Caneca de vidro (chopp): pré-aquecer cerca de 15 s e cuidado ao retirar a fita adesiva para não descascar a resina.',
  'Se houver variação de temperatura na prensa, fazer testes antes de produzir.',
];

/** Parte da máquina que aquece (a 4 em 1 tem 4; as outras, 1), com potência própria em 220 V. */
export interface SublimationHead {
  id: string;
  name: string;
  powerW: number;
  /** Linhas da tabela que valem para esta parte; null = sem referência (usar os valores do fabricante). */
  equipment: SublimationEquipment | null;
}

export interface SublimationMachine {
  id: string;
  storeId: string;
  label: string;
  /** Tensão de uso (todas em 220 V). */
  voltage: number;
  heads: SublimationHead[];
  note?: string;
}

export type SublimationMachineData = Omit<SublimationMachine, 'id' | 'storeId'>;

/** As 4 máquinas do tabela-sublimacao.md, para cadastrar com um clique (o usuário pode editar depois). */
export const DEFAULT_SUBLIMATION_MACHINES: SublimationMachineData[] = [
  {
    label: 'Mini prensa portátil',
    voltage: 220,
    note: 'Base 6,2 × 10,6 cm; para bonés, sapatos e lugares difíceis.',
    heads: [{ id: 'base', name: 'Base 6,2 × 10,6 cm', powerW: 250, equipment: null }],
  },
  {
    label: 'Prensa plana 38 × 38 cm',
    voltage: 220,
    note: '0–250 °C, 0–999 s.',
    heads: [{ id: 'placa', name: 'Placa 38 × 38 cm', powerW: 1800, equipment: 'Prensa plana' }],
  },
  {
    label: 'Prensa 4 em 1',
    voltage: 220,
    note: 'Cada acessório tem potência própria.',
    heads: [
      { id: 'bone', name: 'Boné', powerW: 300, equipment: null },
      // Ajuste aprovado em 24/10/2026: a placa de logo é uma prensa plana pequena.
      { id: 'logo', name: 'Logo 15 × 15 cm', powerW: 600, equipment: 'Prensa plana' },
      { id: 'caneta', name: 'Caneta 10 × 15 cm', powerW: 200, equipment: 'Prensa de canetas' },
      { id: 'caneca', name: 'Caneca 11 oz', powerW: 300, equipment: 'Prensa de canecas e copos' },
    ],
  },
  {
    label: 'Prensa de caneca Sun Special SSH-012A-1',
    voltage: 220,
    note: 'Usada somente para canecas.',
    heads: [{ id: 'caneca', name: 'Caneca', powerW: 350, equipment: 'Prensa de canecas e copos' }],
  },
];

/** Linhas da tabela de um equipamento (vazio quando a parte da máquina não tem referência). */
export function rowsForEquipment(equipment: SublimationEquipment | null): SublimationRow[] {
  return equipment ? SUBLIMATION_TABLE.filter(r => r.equipment === equipment) : [];
}

/** Sem acento e em minúsculas, para a busca achar "ceramica" em "cerâmica". */
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Busca por produto ou equipamento (todas as palavras precisam aparecer). */
export function searchSublimationTable(query: string, rows: SublimationRow[] = SUBLIMATION_TABLE): SublimationRow[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return rows;
  return rows.filter(r => {
    const text = fold(`${r.product} ${r.equipment}`);
    return words.every(w => text.includes(w));
  });
}

/** Como na tabela: minutos inteiros a partir de 3 min ("7 min"); o resto em segundos ("400 s"). */
export function formatSublimationTime(seconds: number): string {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return s >= 180 && s % 60 === 0 ? `${s / 60} min` : `${s} s`;
}
