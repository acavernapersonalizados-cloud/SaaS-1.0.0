// Etapa 7, item 1 — proteção do preço do catálogo (catalogPrice) gravado pela tela Produtos.
import { describe, expect, it } from 'vitest';
import { catalogPriceDisplayOf, catalogPriceLines, nextCatalogPrice } from './catalog';

describe('nextCatalogPrice', () => {
  it('preço novo válido e diferente do gravado: grava o novo', () => {
    expect(nextCatalogPrice(28.86, 30)).toBe(30);
  });
  it('mesmo preço (diferença até 1 centavo): não grava nada', () => {
    expect(nextCatalogPrice(28.86, 28.865)).toBeNull();
  });
  it('preço calculado R$ 0 (meta inválida) com preço gravado: NÃO apaga o gravado', () => {
    expect(nextCatalogPrice(28.86, 0)).toBeNull();
  });
  it('preço calculado inválido (NaN, negativo, infinito): não grava', () => {
    expect(nextCatalogPrice(28.86, Number.NaN)).toBeNull();
    expect(nextCatalogPrice(28.86, -5)).toBeNull();
    expect(nextCatalogPrice(28.86, Number.POSITIVE_INFINITY)).toBeNull();
  });
  it('produto sem preço gravado e sem preço calculado: não grava', () => {
    expect(nextCatalogPrice(0, 0)).toBeNull();
    expect(nextCatalogPrice(undefined, 0)).toBeNull();
  });
  it('produto sem preço gravado que passa a ter preço: grava', () => {
    expect(nextCatalogPrice(undefined, 72.43)).toBe(72.43);
    expect(nextCatalogPrice(0, 72.43)).toBe(72.43);
  });
});

// Etapa 8C, item 3c — o catálogo mostra o preço no Pix, no crédito (Pix ÷ 0,95) ou os dois.
describe('Preço no catálogo: Pix, crédito ou os dois', () => {
  it('sem opção gravada (ou com valor estranho): Pix', () => {
    expect(catalogPriceDisplayOf(null)).toBe('pix');
    expect(catalogPriceDisplayOf({})).toBe('pix');
    expect(catalogPriceDisplayOf({ catalogPriceDisplay: 'boleto' as never })).toBe('pix');
    expect(catalogPriceDisplayOf({ catalogPriceDisplay: 'ambos' })).toBe('ambos');
  });
  it('linhas de cada opção (ADESIVO FOTOGRAFICO: R$ 9,50 no Pix = R$ 10,00 no crédito)', () => {
    expect(catalogPriceLines(9.5, 'pix')).toEqual([{ label: 'no Pix', value: 9.5 }]);
    const [credit] = catalogPriceLines(9.5, 'credito');
    expect(credit.label).toBe('no crédito');
    expect(credit.value).toBeCloseTo(10, 10);
    expect(catalogPriceLines(9.5, 'ambos').map(l => l.label)).toEqual(['no Pix', 'no crédito']);
  });
});
