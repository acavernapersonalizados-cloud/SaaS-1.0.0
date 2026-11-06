import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Material, Product, ProductVariation, ProductVariationOption } from '../types';
import { formatQuantity } from '../lib/quantity';
import { QuantityInput } from './QuantityInput';

const BOX =
  'px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900';
const FIELD = `w-full ${BOX}`;

/** Estacionamento item 30, parte A: opções do produto, cada uma com o material do estoque e um valor a mais. */
export function ProductVariationSection({
  newProduct,
  setNewProduct,
  materials,
  inKit,
}: {
  newProduct: Partial<Product>;
  setNewProduct: React.Dispatch<React.SetStateAction<Partial<Product>>>;
  materials: Material[];
  /** O produto faz parte de um kit: o kit não sabe escolher a variação. */
  inKit: boolean;
}) {
  // Vem da calculadora ou é kit: o custo é gravado e os materiais estão travados.
  if ((Number(newProduct.jobCostUnit) || 0) > 0 || newProduct.isKit) return null;

  const variation = newProduct.variation ?? null;
  const update = (patch: Partial<ProductVariation>) =>
    setNewProduct(p => ({ ...p, variation: { name: 'Cor', quantity: 1, options: [], ...p.variation, ...patch } }));
  const updateOption = (id: string, patch: Partial<ProductVariationOption>) =>
    update({ options: (variation?.options ?? []).map(o => (o.id === id ? { ...o, ...patch } : o)) });
  const addOption = () =>
    update({
      options: [
        ...(variation?.options ?? []),
        { id: Math.random().toString(36).substr(2, 9), name: '', materialId: null, additionalValue: 0 },
      ],
    });
  const removeOption = (id: string) => {
    const options = (variation?.options ?? []).filter(o => o.id !== id);
    if (options.length === 0) setNewProduct(p => ({ ...p, variation: null }));
    else update({ options });
  };

  return (
    <div className="space-y-3 pt-2 border-t border-neutral-100">
      <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Variações (opcional)</label>
      {inKit ? (
        <p className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          Este produto faz parte de um kit, e o kit não escolhe variação. Tire-o do kit para usar variações.
        </p>
      ) : (
        <>
          <p className="text-xs text-neutral-500">
            Ex.: Cor com Preta, Azul e Rosa. O material da opção soma à receita acima, então tire dela o que varia. No
            orçamento vale a opção escolhida; a lista de produtos mostra o preço pela opção mais cara.
          </p>
          {variation && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-xs font-bold text-neutral-600">Nome da variação</span>
                <input
                  type="text"
                  aria-label="Nome da variação"
                  value={variation.name}
                  onChange={e => update({ name: e.target.value })}
                  className={FIELD}
                  placeholder="Ex: Cor"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-neutral-600">Quantidade por unidade</span>
                <QuantityInput
                  compact
                  ariaLabel="Quantidade do material por unidade"
                  value={variation.quantity}
                  onChange={v => update({ quantity: v ?? 0 })}
                  className={FIELD}
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            {variation?.options.map((option, index) => (
              <div key={option.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    aria-label={`Nome da opção ${index + 1}`}
                    value={option.name}
                    onChange={e => updateOption(option.id, { name: e.target.value })}
                    className={`${BOX} bg-white flex-1 min-w-0`}
                    placeholder="Ex: Azul"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    aria-label={`Valor a mais da opção ${index + 1} (R$)`}
                    value={option.additionalValue || ''}
                    onChange={e => updateOption(option.id, { additionalValue: Number(e.target.value) })}
                    className={`${BOX} bg-white w-20 shrink-0`}
                    placeholder="+ R$"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(option.id)}
                    aria-label={`Remover opção ${index + 1}`}
                    className="p-1.5 shrink-0 text-neutral-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <select
                  aria-label={`Material da opção ${index + 1}`}
                  value={option.materialId ?? ''}
                  onChange={e => updateOption(option.id, { materialId: e.target.value || null })}
                  className={`${FIELD} bg-white`}
                >
                  <option value="">Sem material do estoque</option>
                  {materials.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} · saldo {formatQuantity(item.stockQuantity)} {item.unit}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addOption}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-neutral-300 rounded-xl text-xs font-bold text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar opção
          </button>
        </>
      )}
    </div>
  );
}
