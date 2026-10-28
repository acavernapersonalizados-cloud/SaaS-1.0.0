/**
 * ProductKitSection — "Este produto é um Kit" no cadastro de Produtos (Estacionamento item 19, aprovado em 28/10/2026).
 * Monta o kit com produtos já cadastrados (com quantidade) e desconto opcional (sem custos extras nem montagem).
 * Mexer no kit aqui grava a soma na hora; se um produto do kit mudar depois, o kit só muda com
 * "Atualizar pela soma atual".
 */
import React, { useState } from 'react';
import { CostBase, Material, Product } from '../types';
import { formatCurrency, formatPercent } from '../lib/utils';
import { kitSnapshot, kitSnapshotDiffers, kitTotals } from '../lib/kit';
import { Gift, Plus, RefreshCw, Trash2 } from 'lucide-react';

type SetProduct = React.Dispatch<React.SetStateAction<Partial<Product>>>;

const inputClass =
  'w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm';

export function ProductKitSection({
  newProduct,
  setNewProduct,
  editingId,
  products,
  materials,
  costs,
}: {
  newProduct: Partial<Product>;
  setNewProduct: SetProduct;
  editingId: string | null;
  products: Product[];
  materials: Material[];
  costs: CostBase | null;
}) {
  const [pickId, setPickId] = useState('');
  const [pickQty, setPickQty] = useState(1);
  const live = kitTotals(newProduct, products, materials, costs);
  const changedOutside =
    !!newProduct.isKit && (newProduct.kitItems || []).length > 0 && kitSnapshotDiffers(newProduct, live);

  // Mexer no kit aqui é mudar o próprio kit: a soma é gravada junto.
  const update = (patch: Partial<Product>) =>
    setNewProduct(p => {
      const next = { ...p, ...patch };
      return { ...next, ...kitSnapshot(kitTotals(next, products, materials, costs)) };
    });
  const items = newProduct.kitItems || [];
  // Só produtos comuns da loja: o próprio produto e outros kits não entram.
  const choices = products.filter(p => p.id !== editingId && !p.isKit);

  return (
    <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={!!newProduct.isKit}
          onChange={e =>
            e.target.checked
              ? update({ isKit: true, isPackage: false, kitItems: newProduct.kitItems || [] })
              : setNewProduct(p => ({ ...p, isKit: false }))
          }
          className="w-5 h-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
        />
        <span className="text-sm font-bold text-neutral-700 flex items-center gap-1.5">
          <Gift className="w-4 h-4" /> Este produto é um Kit (montado com produtos já cadastrados)?
        </span>
      </label>

      {newProduct.isKit && (
        <div className="space-y-4 border-t border-neutral-200 pt-3">
          <p className="text-xs text-neutral-500">Custo e preço do kit = soma dos produtos escolhidos.</p>

          {changedOutside && (
            <div
              role="alert"
              className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2"
            >
              <p>
                Algum produto do kit mudou depois que o kit foi gravado. Gravado: custo{' '}
                {formatCurrency(Number(newProduct.kitCostUnit) || 0)} · soma dos preços{' '}
                {formatCurrency(Number(newProduct.kitPriceUnit) || 0)}. Soma atual: custo{' '}
                {formatCurrency(live.totalCost)} · soma dos preços {formatCurrency(live.grossPrice)}.
              </p>
              <button
                type="button"
                onClick={() => update({})}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg font-bold"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Atualizar pela soma atual
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              aria-label="Produto do kit"
              value={pickId}
              onChange={e => setPickId(e.target.value)}
              className={inputClass}
            >
              <option value="">Escolha um produto…</option>
              {choices.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Quantidade no kit"
              type="number"
              min="1"
              value={pickQty}
              onChange={e => setPickQty(Math.max(1, Number(e.target.value) || 1))}
              className={`${inputClass} sm:w-24`}
            />
            <button
              type="button"
              disabled={!pickId}
              onClick={() => {
                const exists = items.some(i => i.productId === pickId);
                update({
                  kitItems: exists
                    ? items.map(i => (i.productId === pickId ? { ...i, quantity: i.quantity + pickQty } : i))
                    : [...items, { productId: pickId, quantity: pickQty }],
                });
                setPickId('');
                setPickQty(1);
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-neutral-900 text-white rounded-xl font-bold text-sm disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </div>

          {live.lines.length > 0 && (
            <ul className="divide-y divide-neutral-200 bg-white rounded-xl border border-neutral-200">
              {live.lines.map(l => (
                <li key={l.productId} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-semibold" title={l.name}>
                      {l.name}
                    </span>
                    {l.missing && (
                      <span className="block text-xs text-red-600">Produto apagado: fica fora da soma.</span>
                    )}
                    {l.nestedKit && <span className="block text-xs text-red-600">Kit não entra em outro kit.</span>}
                    {!l.missing && !l.nestedKit && (
                      <span className="block text-xs text-neutral-500">
                        custo {formatCurrency(l.unitCost)} · preço {formatCurrency(l.unitPrice)} por unidade
                      </span>
                    )}
                  </span>
                  <input
                    aria-label={`Quantidade de ${l.name}`}
                    type="number"
                    min="1"
                    value={l.quantity}
                    onChange={e =>
                      update({
                        kitItems: items.map(i =>
                          i.productId === l.productId
                            ? { ...i, quantity: Math.max(1, Number(e.target.value) || 1) }
                            : i,
                        ),
                      })
                    }
                    className="w-[70px] shrink-0 px-2 py-2 bg-white border border-neutral-200 rounded-xl text-sm text-center focus:ring-2 focus:ring-neutral-900 outline-none"
                  />
                  <button
                    type="button"
                    aria-label={`Tirar ${l.name} do kit`}
                    onClick={() => update({ kitItems: items.filter(i => i.productId !== l.productId) })}
                    className="shrink-0 p-1.5 text-neutral-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-600">Desconto do kit (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={newProduct.kitDiscountPct ?? ''}
                onChange={e => update({ kitDiscountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                placeholder="Opcional"
                className={inputClass}
              />
            </div>
          </div>

          <div role="status" className="p-3 bg-white rounded-xl border border-neutral-200 text-xs space-y-1">
            <p className="flex justify-between font-bold">
              <span>Custo do kit</span>
              <span>{formatCurrency(live.totalCost)}</span>
            </p>
            <p className="flex justify-between">
              <span>Soma dos preços{live.discountPct > 0 ? ` (−${formatPercent(live.discountPct)})` : ''}</span>
              <span>{formatCurrency(live.grossPrice)}</span>
            </p>
            <p className="flex justify-between font-bold">
              <span>Preço do kit</span>
              <span>{formatCurrency(live.price)}</span>
            </p>
            <p className={`flex justify-between font-bold ${live.belowCost ? 'text-red-700' : 'text-emerald-700'}`}>
              <span>{live.belowCost ? 'Abaixo do custo: prejuízo' : 'Lucro'}</span>
              <span>
                {formatCurrency(live.profit)} · margem {formatPercent(live.margin)}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
