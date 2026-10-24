// Etapa 8D-1 — tabela de sublimação e máquinas padrão. A tabela do app tem que ser igual, linha a linha,
// à do tabela-sublimacao.md (fonte aprovada pelo usuário).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SUBLIMATION_MACHINES,
  formatSublimationTime,
  rowsForEquipment,
  searchSublimationTable,
  SUBLIMATION_TABLE,
} from './sublimation';

/** Linhas "| Equipamento | Produto | Temp. | Tempo | Pressão |" do arquivo, com o tempo em segundos. */
function tableFromMarkdown() {
  const md = readFileSync(resolve(__dirname, '../../tabela-sublimacao.md'), 'utf8');
  // Só a seção da tabela (a de máquinas, antes dela, também tem linhas "| Prensa ...").
  const section = md.slice(md.indexOf('## Tabela de tempo'), md.indexOf('## Dicas'));
  return section
    .split('\n')
    .filter(l => l.startsWith('| Prensa'))
    .map(l => {
      const [equipment, product, temp, time, pressure] = l
        .split('|')
        .slice(1, 6)
        .map(c => c.trim());
      const [n, unit] = time.split(' ');
      return {
        equipment,
        product,
        tempC: Number(temp),
        timeS: unit === 'min' ? Number(n) * 60 : Number(n),
        pressure: pressure === '—' ? null : pressure,
      };
    });
}

describe('Tabela de sublimação', () => {
  it('igual ao tabela-sublimacao.md, linha a linha (40 linhas)', () => {
    const md = tableFromMarkdown();
    expect(md).toHaveLength(40);
    expect(SUBLIMATION_TABLE).toEqual(md);
  });
  it('linhas por equipamento: plana 22, 3D 10, canecas 6, canetas 1, pratos 1', () => {
    expect(rowsForEquipment('Prensa plana')).toHaveLength(22);
    expect(rowsForEquipment('Prensa 3D')).toHaveLength(10);
    expect(rowsForEquipment('Prensa de canecas e copos')).toHaveLength(6);
    expect(rowsForEquipment('Prensa de canetas')).toHaveLength(1);
    expect(rowsForEquipment('Prensa de pratos')).toHaveLength(1);
    expect(rowsForEquipment(null)).toEqual([]);
  });
  it('tempo como na tabela: "400 s", "25 s", "7 min", "9 min"', () => {
    expect(formatSublimationTime(400)).toBe('400 s');
    expect(formatSublimationTime(25)).toBe('25 s');
    expect(formatSublimationTime(420)).toBe('7 min');
    expect(formatSublimationTime(540)).toBe('9 min');
    expect(formatSublimationTime(180)).toBe('3 min');
  });
  it('busca sem acento, por produto ou equipamento', () => {
    expect(searchSublimationTable('ceramica').map(r => r.equipment)).toEqual(['Prensa plana', 'Prensa 3D']);
    expect(searchSublimationTable('caneca 3d')).toEqual([
      { equipment: 'Prensa 3D', product: 'Caneca de porcelana', tempC: 200, timeS: 540, pressure: null },
    ]);
    expect(searchSublimationTable('  ')).toHaveLength(40);
    expect(searchSublimationTable('xyz')).toEqual([]);
  });
});

describe('Máquinas padrão (todas em 220 V)', () => {
  const byLabel = (label: string) => DEFAULT_SUBLIMATION_MACHINES.find(m => m.label.startsWith(label))!;
  it('as 4 máquinas do arquivo, com as potências', () => {
    expect(DEFAULT_SUBLIMATION_MACHINES).toHaveLength(4);
    expect(DEFAULT_SUBLIMATION_MACHINES.every(m => m.voltage === 220)).toBe(true);
    expect(byLabel('Mini prensa').heads.map(h => h.powerW)).toEqual([250]);
    expect(byLabel('Prensa plana').heads.map(h => h.powerW)).toEqual([1800]);
    expect(byLabel('Prensa 4 em 1').heads.map(h => [h.name, h.powerW])).toEqual([
      ['Boné', 300],
      ['Logo 15 × 15 cm', 600],
      ['Caneta 10 × 15 cm', 200],
      ['Caneca 11 oz', 300],
    ]);
    expect(byLabel('Prensa de caneca Sun Special').heads.map(h => h.powerW)).toEqual([350]);
  });
  it('ligação com a tabela: logo da 4 em 1 = prensa plana; boné e mini prensa sem referência; Sun Special = canecas', () => {
    const quatro = byLabel('Prensa 4 em 1').heads;
    expect(quatro.find(h => h.id === 'logo')!.equipment).toBe('Prensa plana');
    expect(quatro.find(h => h.id === 'bone')!.equipment).toBeNull();
    expect(quatro.find(h => h.id === 'caneta')!.equipment).toBe('Prensa de canetas');
    expect(quatro.find(h => h.id === 'caneca')!.equipment).toBe('Prensa de canecas e copos');
    expect(byLabel('Mini prensa').heads[0].equipment).toBeNull();
    expect(byLabel('Prensa plana').heads[0].equipment).toBe('Prensa plana');
    expect(byLabel('Prensa de caneca Sun Special').heads[0].equipment).toBe('Prensa de canecas e copos');
  });
});
