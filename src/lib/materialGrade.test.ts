// Matéria-prima com grade (16/11/2026).
import { describe, expect, it } from 'vitest';
import type { Material, MaterialGrade } from '../types';
import {
  gradeKeysOf,
  gradeReferenceCost,
  gradeStockTotal,
  hasMaterialGrade,
  materialGradeChanges,
  materialGradeMissingCosts,
  variantDocId,
  variantLabel,
  variantsOf,
} from './materialGrade';

const grade: MaterialGrade = {
  fabrics: ['Algodão', 'Dryfit'],
  sizes: ['M', 'GG'],
  colors: ['Azul', 'Preta'],
  costs: { 'Algodão|M': 20, 'Algodão|GG': 25, 'Dryfit|M': 18, 'Dryfit|GG': 30 },
};
const parent = { id: 'cam', name: ' Camiseta ', storeId: 's', categoryIds: ['c1'] };
const now = '2026-11-16T10:00:00.000Z';

describe('Matéria-prima com grade', () => {
  it('grade só vale com tecido, tamanho e cor', () => {
    expect(hasMaterialGrade({ grade })).toBe(true);
    expect(hasMaterialGrade({ grade: { ...grade, colors: [] } })).toBe(false);
    expect(hasMaterialGrade({})).toBe(false);
  });
  it('todas as combinações, na ordem tecido, tamanho, cor', () => {
    expect(gradeKeysOf(grade)).toEqual([
      'Algodão|M|Azul',
      'Algodão|M|Preta',
      'Algodão|GG|Azul',
      'Algodão|GG|Preta',
      'Dryfit|M|Azul',
      'Dryfit|M|Preta',
      'Dryfit|GG|Azul',
      'Dryfit|GG|Preta',
    ]);
  });
  it('id fixo por combinação, sem acento nem barra', () => {
    expect(variantDocId('cam', 'Algodão|M|Azul')).toBe('cam__algodao-m-azul');
    expect(variantDocId('cam', 'Baby look algodão|G/G|Azul')).toBe('cam__baby-look-algodao-g-g-azul');
  });
  it('primeira gravação cria um item por combinação, com saldo zero e o custo do tecido e tamanho', () => {
    const r = materialGradeChanges(parent, grade, [], now);
    expect(r.create).toHaveLength(8);
    expect(r.update).toEqual([]);
    expect(r.create[2]).toMatchObject({
      id: 'cam__algodao-gg-azul',
      data: {
        name: 'Camiseta Algodão GG Azul',
        unit: 'un',
        unitCost: 25,
        stockQuantity: 0,
        variantOf: 'cam',
        variantKey: 'Algodão|GG|Azul',
        categoryIds: ['c1'],
        supplierId: null,
        storeId: 's',
      },
    });
  });
  it('salvar de novo não duplica; muda só custo e nome, nunca o saldo', () => {
    const first = materialGradeChanges(parent, grade, [], now).create.map(
      c => ({ id: c.id, ...c.data, stockQuantity: 7 }) as unknown as Material,
    );
    expect(materialGradeChanges(parent, grade, first, now)).toEqual({ create: [], update: [] });
    const raised = { ...grade, costs: { ...grade.costs, 'Algodão|M': 22 } };
    const r = materialGradeChanges(parent, raised, first, now);
    expect(r.update.map(u => u.id)).toEqual(['cam__algodao-m-azul', 'cam__algodao-m-preta']);
    expect(r.update[0]?.data).not.toHaveProperty('stockQuantity');
  });
  it('cor nova cria só as combinações dela', () => {
    const first = materialGradeChanges(parent, grade, [], now).create.map(
      c => ({ id: c.id, ...c.data }) as unknown as Material,
    );
    const r = materialGradeChanges(parent, { ...grade, colors: [...grade.colors, 'Rosa'] }, first, now);
    expect(r.create.map(c => c.id)).toEqual([
      'cam__algodao-m-rosa',
      'cam__algodao-gg-rosa',
      'cam__dryfit-m-rosa',
      'cam__dryfit-gg-rosa',
    ]);
  });
  it('custo faltando trava; referência é o maior custo', () => {
    expect(materialGradeMissingCosts({ ...grade, costs: { 'Algodão|M': 20 } })).toEqual([
      'Algodão GG',
      'Dryfit M',
      'Dryfit GG',
    ]);
    expect(materialGradeMissingCosts(grade)).toEqual([]);
    expect(gradeReferenceCost(grade)).toBe(30);
  });
  it('saldo total, ordem da grade e rótulo da combinação', () => {
    const items = [
      { id: 'b', name: 'x', variantOf: 'cam', variantKey: 'Dryfit|M|Azul', stockQuantity: 2 },
      { id: 'a', name: 'y', variantOf: 'cam', variantKey: 'Algodão|M|Azul', stockQuantity: 5 },
      { id: 'z', name: 'outro', stockQuantity: 100 },
    ] as unknown as Material[];
    expect(gradeStockTotal(items, 'cam')).toBe(7);
    expect(variantsOf(items, { id: 'cam', grade }).map(m => m.id)).toEqual(['a', 'b']);
    expect(variantLabel(items[1]!)).toBe('Algodão · M · Azul');
    expect(variantLabel(items[2]!)).toBe('outro');
  });
});
