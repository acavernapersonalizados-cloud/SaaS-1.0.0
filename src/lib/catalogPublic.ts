/**
 * catalogPublic.ts — cópia pública dos produtos do catálogo, SEM custos (Estacionamento item 4, 26/10/2026).
 * O catálogo público lia a coleção `products` inteira: quem lesse o banco direto via custo do trabalho, materiais,
 * tempo, preço manual e a análise da IA. Agora ele lê `catalogProducts/{id do produto}`, que só tem o que o cliente
 * pode ver, e que só existe para produto marcado "mostrar no catálogo".
 */
import type { Product } from '../types';

/** Os únicos campos que vão para o catálogo público (os mesmos que a tela do catálogo usa). */
export interface PublicProduct {
  storeId: string;
  name: string;
  description: string | null;
  category: string;
  categoryIds: string[];
  imageUrl: string | null;
  thumbnailUrl: string | null;
  galleryImages: string[];
  catalogPrice: number;
  showPrice: boolean;
  leadTimeDays: number | null;
  isPackage: boolean;
  packageQuantity: number | null;
  showInCatalog: true;
}

/** Cópia pública do produto, ou null quando ele não deve aparecer no catálogo. */
export function toPublicProduct(p: Partial<Product>): PublicProduct | null {
  if (!p.storeId || p.showInCatalog === false) return null;
  return {
    storeId: p.storeId,
    name: p.name || '',
    description: p.description ?? null,
    category: p.category || '',
    categoryIds: p.categoryIds || [],
    imageUrl: p.imageUrl ?? null,
    thumbnailUrl: p.thumbnailUrl ?? null,
    galleryImages: p.galleryImages || [],
    catalogPrice: Number(p.catalogPrice) || 0,
    showPrice: p.showPrice !== false,
    leadTimeDays: p.leadTimeDays ?? null,
    isPackage: !!p.isPackage,
    packageQuantity: p.packageQuantity ?? null,
    showInCatalog: true,
  };
}

/** A cópia gravada já é igual à que deveria estar (evita gravar à toa). */
export function samePublicProduct(stored: Partial<PublicProduct> | undefined, wanted: PublicProduct): boolean {
  if (!stored) return false;
  return (Object.keys(wanted) as Array<keyof PublicProduct>).every(
    k => JSON.stringify(stored[k] ?? null) === JSON.stringify(wanted[k] ?? null),
  );
}

/**
 * O que gravar para a cópia pública da loja ficar igual aos produtos: `set` (criar/atualizar) e `remove` (produto
 * oculto, apagado ou de outra loja). `stored` são as cópias que já existem, por id.
 */
export function publicCatalogChanges(
  products: Array<Partial<Product> & { id: string }>,
  stored: Map<string, Partial<PublicProduct>>,
): { set: Array<{ id: string; data: PublicProduct }>; remove: string[] } {
  const set: Array<{ id: string; data: PublicProduct }> = [];
  const keep = new Set<string>();
  for (const p of products) {
    const data = toPublicProduct(p);
    if (!data) continue;
    keep.add(p.id);
    if (!samePublicProduct(stored.get(p.id), data)) set.push({ id: p.id, data });
  }
  const remove = [...stored.keys()].filter(id => !keep.has(id));
  return { set, remove };
}
