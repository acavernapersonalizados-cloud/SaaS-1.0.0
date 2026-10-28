// Correção de 28/10/2026: só as páginas do catálogo público ficam sem manifesto e sem service worker.
import { describe, expect, it } from 'vitest';
import { catalogStoreIdOf, isPublicCatalogPage } from './publicCatalogRoute';

const at = (pathname: string, search = '') => ({ pathname, search });

describe('página do catálogo público', () => {
  it('reconhece /catalogo/<loja> e ?catalog=<loja>', () => {
    expect(catalogStoreIdOf(at('/catalogo/loja-teste'))).toBe('loja-teste');
    expect(catalogStoreIdOf(at('/', '?catalog=loja-teste'))).toBe('loja-teste');
    expect(isPublicCatalogPage(at('/catalogo/abc/'))).toBe(true);
  });
  it('o painel (e qualquer outra página) não é catálogo', () => {
    for (const p of ['/', '/produtos', '/catalogos', '/catalogo']) expect(isPublicCatalogPage(at(p))).toBe(false);
  });
});
