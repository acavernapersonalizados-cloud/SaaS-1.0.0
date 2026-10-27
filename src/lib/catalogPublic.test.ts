// Estacionamento item 4 — cópia pública do catálogo, sem custos.
import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { publicCatalogChanges, toPublicProduct } from './catalogPublic';

const produto = {
  id: 'p1',
  storeId: 'loja',
  name: 'TESTE Caneca',
  description: 'Caneca personalizada',
  category: 'Presentes',
  categoryIds: ['cat-1'],
  imageUrl: 'https://img/1.webp',
  thumbnailUrl: 'https://img/1-thumb.webp',
  galleryImages: ['https://img/2.webp'],
  catalogPrice: 58.93,
  showPrice: true,
  showInCatalog: true,
  leadTimeDays: 5,
  isPackage: false,
  // Tudo isto é custo ou dado interno: NÃO pode ir para o catálogo público.
  materials: [{ materialId: 'caneca', quantity: 1 }],
  productionTime: 30,
  packagingCost: 2.5,
  jobCostUnit: 29.47,
  jobSuggestedUnit: 58.93,
  manualPrice: 58.93,
  suggestedPrice: 58.93,
  aiPriceAnalysis: 'margem boa',
  sourceJob: { kind: 'sublimacao', id: 'job-1' },
  finishingOptions: [{ id: 'f', name: 'Verniz', additionalValue: 2 }],
  accessories: [],
} as unknown as Product;

const CUSTOS = [
  'materials',
  'productionTime',
  'packagingCost',
  'jobCostUnit',
  'jobSuggestedUnit',
  'manualPrice',
  'suggestedPrice',
  'aiPriceAnalysis',
  'sourceJob',
  'finishingOptions',
  'accessories',
];

describe('Cópia pública do produto', () => {
  it('leva só o que o cliente vê e nenhum custo', () => {
    const pub = toPublicProduct(produto)!;
    expect(Object.keys(pub).sort()).toEqual(
      [
        'catalogPrice',
        'category',
        'categoryIds',
        'description',
        'galleryImages',
        'imageUrl',
        'isPackage',
        'leadTimeDays',
        'name',
        'packageQuantity',
        'showInCatalog',
        'showPrice',
        'storeId',
        'thumbnailUrl',
      ].sort(),
    );
    for (const campo of CUSTOS) expect(pub).not.toHaveProperty(campo);
    expect(pub).toMatchObject({ name: 'TESTE Caneca', catalogPrice: 58.93, showPrice: true, showInCatalog: true });
  });
  it('produto oculto (ou sem loja) não tem cópia pública', () => {
    expect(toPublicProduct({ ...produto, showInCatalog: false })).toBeNull();
    expect(toPublicProduct({ ...produto, storeId: '' })).toBeNull();
  });
  it('produto sem o campo "mostrar no catálogo" continua aparecendo, como antes', () => {
    const semCampo = { ...produto } as Partial<Product>;
    delete semCampo.showInCatalog;
    expect(toPublicProduct(semCampo)).not.toBeNull();
  });
});

describe('Mudanças para a cópia pública ficar igual aos produtos', () => {
  it('cria as que faltam, atualiza as diferentes, apaga as ocultas e as de produto apagado', () => {
    const igual = toPublicProduct({ ...produto, id: 'igual' })!;
    const stored = new Map<string, object>([
      ['igual', igual],
      ['velho', { ...toPublicProduct(produto)!, catalogPrice: 50 }],
      ['oculto', toPublicProduct(produto)!],
      ['apagado', toPublicProduct(produto)!],
    ]);
    const { set, remove } = publicCatalogChanges(
      [
        { ...produto, id: 'igual' },
        { ...produto, id: 'velho' },
        { ...produto, id: 'novo' },
        { ...produto, id: 'oculto', showInCatalog: false },
      ],
      stored,
    );
    expect(set.map(s => s.id).sort()).toEqual(['novo', 'velho']);
    expect(set.find(s => s.id === 'velho')!.data.catalogPrice).toBe(58.93);
    expect(remove.sort()).toEqual(['apagado', 'oculto']);
  });
  it('tudo igual: não grava nada', () => {
    const stored = new Map([['p1', toPublicProduct(produto)!]]);
    expect(publicCatalogChanges([produto], stored)).toEqual({ set: [], remove: [] });
  });
});
