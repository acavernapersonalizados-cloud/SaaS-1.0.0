/**
 * publicCatalogRoute.ts — reconhece a página do catálogo público (/catalogo/<loja> ou ?catalog=<loja>).
 * Usado pelo App (mostra o catálogo sem login) e pelo main.tsx (correção de 28/10/2026): no catálogo o app não
 * carrega o manifesto nem registra o service worker, para o cliente não receber a oferta de instalar o sistema.
 */
export function catalogStoreIdOf(loc: Pick<Location, 'pathname' | 'search'>): string | null {
  const match = loc.pathname.match(/^\/catalogo\/([^/?]+)/);
  if (match) return match[1];
  return new URLSearchParams(loc.search).get('catalog');
}

export const isPublicCatalogPage = (loc: Pick<Location, 'pathname' | 'search'>) => catalogStoreIdOf(loc) !== null;
