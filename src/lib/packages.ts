/**
 * packages.ts — material comprado em pacote com estoque por item (correção de 14/11/2026). Ex.: sulfite em pacote de 500
 * folhas: o custo já era por folha, mas o saldo ficava em pacotes, e a receita de 50 folhas não conseguia baixar.
 * Com `stockByItem`, saldo, mínimo e lotes são em itens; o pacote é só o jeito de comprar.
 */
import type { Material } from '../types';
import { formatQuantity } from './quantity';
import { packageSize } from './utils';

type PackageFields = Pick<Partial<Material>, 'isPackage' | 'unit' | 'packageQuantity' | 'stockByItem'>;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Pacote controlado por item (o modelo novo). */
export const stockByItem = (m: PackageFields) => packageSize(m) > 1 && !!m.stockByItem;

/** Pacote do jeito antigo: o saldo pode estar em pacotes. Precisa da conversão, feita pela pessoa. */
export const legacyPackageStock = (m: PackageFields) => packageSize(m) > 1 && !m.stockByItem;

/** 1.030 folhas em pacotes de 500 = 2 pacotes + 30 avulsas. */
export function packageBreakdown(quantity: number, size: number) {
  const total = Math.max(0, Number(quantity) || 0);
  const packs = size > 1 ? Math.floor(total / size + 1e-9) : 0;
  return { packs, loose: round6(total - packs * size) };
}

/** Saldo para a tela: "1.030 un (2 pct + 30)" no modelo por item; senão, como sempre. */
export function packageStockText(m: PackageFields & Pick<Partial<Material>, 'stockQuantity'>, quantity?: number) {
  const qty = Number(quantity ?? m.stockQuantity) || 0;
  const text = `${formatQuantity(qty)} ${m.unit ?? ''}`.trim();
  if (!stockByItem(m)) return text;
  const { packs, loose } = packageBreakdown(qty, packageSize(m));
  return `${text} (${packs} pct + ${formatQuantity(loose)})`;
}

/**
 * Conversão para o modelo por item. `alreadyItems`: a pessoa diz que o saldo já estava em itens, e nada é multiplicado.
 * Senão, saldo, mínimo e lotes (fator devolvido) vão × itens do pacote. Unidade "pct" vira "un".
 */
export function convertPackageStock(
  m: PackageFields & Pick<Partial<Material>, 'stockQuantity' | 'minStockQuantity'>,
  alreadyItems: boolean,
) {
  const factor = alreadyItems ? 1 : packageSize(m);
  return {
    factor,
    fields: {
      stockQuantity: round6((Number(m.stockQuantity) || 0) * factor),
      minStockQuantity: round6((Number(m.minStockQuantity) || 0) * factor),
      unit: m.unit === 'pct' || !m.unit ? 'un' : m.unit,
      stockByItem: true,
    },
  };
}
