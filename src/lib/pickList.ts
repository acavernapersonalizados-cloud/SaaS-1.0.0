/**
 * pickList.ts — lista de separação (Estacionamento item 22, 2/11/2026): insumos de todos os itens do pedido somados ×
 * quantidade, kits abertos nos seus produtos, agrupados por insumo, com o lote a pegar (item 21). Produto sem
 * matéria-prima cadastrada entra como o próprio produto a separar.
 */
import type { Material, Product, StockReservation } from '../types';
import { materialLots, takeFromLots, todayISO } from './stockLots';

type ReservationLine = StockReservation['reservations'][number];

export interface PickLot {
  expiresAt: string | null;
  quantity: number;
}

export interface PickLine {
  /** Chave da caixa marcada (gravada no orçamento): "m:<insumo>" ou "p:<produto>". */
  key: string;
  kind: 'material' | 'product';
  name: string;
  unit: string;
  quantity: number;
  /** De quais produtos vem ("Caneca × 2", "Kit Café → Caneca × 1"). */
  from: string[];
  /** Lotes a pegar (só insumo). */
  lots: PickLot[];
  /** Quanto falta no estoque utilizável (lote vencido não conta). */
  short: number;
}

export interface PickList {
  lines: PickLine[];
  warnings: string[];
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const num = (v: unknown) => Number(v) || 0;

/**
 * Lista do pedido. `items` = itens do orçamento (ou um produto × 1 no cadastro). Com a reserva ativa, usa os lotes
 * dela quando a quantidade bate com a receita de agora; senão sugere pela ordem do dia e avisa a diferença.
 */
export function buildPickList(
  items: Array<{ productId?: string | null; productName?: string; quantity?: number; product?: Partial<Product> }>,
  products: Product[],
  materials: Material[],
  { reservation, today = todayISO() }: { reservation?: ReservationLine[]; today?: string } = {},
): PickList {
  const byId = new Map(products.map(p => [p.id, p]));
  const matById = new Map(materials.map(m => [m.id, m]));
  const lines = new Map<string, PickLine>();
  const warnings: string[] = [];

  const line = (key: string, kind: PickLine['kind'], name: string, unit: string) => {
    let l = lines.get(key);
    if (!l) {
      l = { key, kind, name, unit, quantity: 0, from: [], lots: [], short: 0 };
      lines.set(key, l);
    }
    return l;
  };
  const addProduct = (p: Partial<Product>, count: number, label: string) => {
    const mats = p.materials || [];
    if (mats.length === 0) {
      const l = line(`p:${p.id || p.name}`, 'product', p.name || 'Produto', 'un');
      l.quantity = round6(l.quantity + count);
      l.from.push(`${label} × ${round6(count)}`);
      return;
    }
    for (const pm of mats) {
      const qty = num(pm.quantity) * count;
      if (qty <= 0) continue;
      const m = matById.get(pm.materialId);
      if (!m) {
        warnings.push(`${p.name}: um insumo da receita não existe mais na Matéria-prima.`);
        continue;
      }
      const l = line(`m:${m.id}`, 'material', m.name, m.unit);
      l.quantity = round6(l.quantity + qty);
      l.from.push(`${label} × ${round6(count)}`);
    }
  };

  for (const item of items) {
    const count = num(item.quantity) || 1;
    const p = item.product ?? (item.productId ? byId.get(item.productId) : undefined);
    if (!p) {
      warnings.push(`Produto não encontrado: ${item.productName || 'sem nome'} (apagado?). Separe pelo nome.`);
      const l = line(`p:${item.productId || item.productName}`, 'product', item.productName || 'Produto', 'un');
      l.quantity = round6(l.quantity + count);
      l.from.push(`${item.productName || 'Produto'} × ${count}`);
      continue;
    }
    if (p.kitItems?.length) {
      for (const ki of p.kitItems) {
        const sub = byId.get(ki.productId);
        if (!sub) {
          warnings.push(`${p.name}: um produto do kit não existe mais.`);
          continue;
        }
        if (sub.kitItems?.length) {
          warnings.push(`${p.name}: "${sub.name}" é outro kit e fica de fora (kit não entra em kit).`);
          continue;
        }
        addProduct(sub, num(ki.quantity) * count, `${p.name} → ${sub.name}`);
      }
      continue;
    }
    addProduct(p, count, p.name || 'Produto');
  }

  const reserved = new Map((reservation || []).map(r => [r.materialId, r]));
  for (const l of lines.values()) {
    if (l.kind !== 'material') continue;
    const id = l.key.slice(2);
    const r = reserved.get(id);
    if (r && Math.abs(num(r.quantity) - l.quantity) < 1e-6 && r.lots?.length) {
      l.lots = r.lots.map(x => ({ expiresAt: x.expiresAt, quantity: x.quantity }));
    } else {
      if (r)
        warnings.push(
          `${l.name}: a reserva tem ${round6(num(r.quantity))} ${l.unit} e a receita de hoje pede ${l.quantity} ${l.unit}.`,
        );
      const taken = takeFromLots(materialLots(matById.get(id)!, today), l.quantity, today);
      l.lots = taken.taken.map(t => ({ expiresAt: t.expiresAt, quantity: t.quantity }));
      l.short = taken.missing;
    }
  }

  const sorted = [...lines.values()].sort(
    (a, b) => (a.kind === b.kind ? 0 : a.kind === 'material' ? -1 : 1) || a.name.localeCompare(b.name),
  );
  return { lines: sorted, warnings };
}

/** Lista da cesta (Calculadora de Cestas): itens ligados à matéria-prima têm lote; os digitados, só o nome. */
export function buildCestaPickList(
  items: Array<{ id: string; name: string; quantity: number; materialId?: string | null; unit?: string | null }>,
  materials: Material[],
  today = todayISO(),
): PickList {
  const linked = items.filter(i => i.materialId);
  const list = buildPickList(
    linked.length
      ? [
          {
            product: {
              id: '__cesta',
              name: 'Cesta',
              materials: linked.map(i => ({ materialId: i.materialId!, quantity: num(i.quantity) })),
            },
            quantity: 1,
          },
        ]
      : [],
    [],
    materials,
    { today },
  );
  for (const i of items.filter(x => !x.materialId))
    list.lines.push({
      key: `p:${i.id}`,
      kind: 'product',
      name: i.name,
      unit: i.unit || 'un',
      quantity: num(i.quantity),
      from: ['Cesta'],
      lots: [],
      short: 0,
    });
  return list;
}
