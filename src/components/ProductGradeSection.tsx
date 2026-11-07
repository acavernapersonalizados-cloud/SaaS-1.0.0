import React, { useState } from 'react';
import { Material, Product, ProductGrade } from '../types';
import { cn } from '../lib/utils';
import {
  activePieces,
  gradeCostKey,
  gradeKey,
  parseGradeList,
  setGradePieceMaterial,
  splitGradeKey,
  toggleGradePiece,
} from '../lib/grade';
import { MaterialPicker } from './MaterialPicker';
import { ProductGradeTechniques } from './ProductGradeTechniques';

const FIELD =
  'w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900';

const EMPTY_GRADE: ProductGrade = { fabrics: [], sizes: [], colors: [], costs: {}, pieces: [] };

/** Estacionamento item 30, parte B1: tecido, tamanho e cor; custo por tecido e tamanho; peças que existem no estoque. */
export function ProductGradeSection({
  newProduct,
  setNewProduct,
  materials,
  inKit,
}: {
  newProduct: Partial<Product>;
  setNewProduct: React.Dispatch<React.SetStateAction<Partial<Product>>>;
  materials: Material[];
  /** O produto faz parte de um kit: o kit não sabe escolher a peça. */
  inKit: boolean;
}) {
  const grade = newProduct.grade ?? null;
  const [lists, setLists] = useState({
    fabrics: grade?.fabrics.join(', ') ?? '',
    sizes: grade?.sizes.join(', ') ?? '',
    colors: grade?.colors.join(', ') ?? '',
  });

  // Vem da calculadora ou é kit: não tem grade.
  if ((Number(newProduct.jobCostUnit) || 0) > 0 || newProduct.isKit) return null;
  // Variação e grade não andam juntas: avisa, em vez de sumir com a opção.
  if (newProduct.variation?.options?.length) {
    return (
      <p className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-600">
        Para usar a grade (tecido, tamanho, cor e técnica), remova as opções do bloco Variações acima. Os itens do estoque
        continuam lá, e você escolhe cada um na grade.
      </p>
    );
  }

  const update = (next: ProductGrade) => setNewProduct(p => ({ ...p, grade: next }));
  const updateList = (field: keyof typeof lists, text: string) => {
    setLists(l => ({ ...l, [field]: text }));
    if (grade) update({ ...grade, [field]: parseGradeList(text) });
  };
  const marked = new Set(grade ? activePieces(grade).map(piece => piece.key) : []);
  const stockOf = (key: string) =>
    materials.find(m => m.id === grade?.pieces.find(piece => piece.key === key)?.materialId);

  const markFabric = (fabric: string) => {
    if (!grade) return;
    const keys = grade.colors.flatMap(color => grade.sizes.map(size => gradeKey(fabric, size, color)));
    const turnOn = keys.some(key => !marked.has(key));
    update(keys.filter(key => marked.has(key) !== turnOn).reduce((next, key) => toggleGradePiece(next, key), grade));
  };

  return (
    <div className="space-y-3 pt-2 border-t border-neutral-100">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={!!grade}
          disabled={inKit}
          onChange={e => setNewProduct(p => ({ ...p, grade: e.target.checked ? EMPTY_GRADE : null }))}
          className="w-5 h-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
        />
        <span className="text-sm font-bold text-neutral-700">Este produto tem grade (tecido, tamanho e cor)?</span>
      </label>
      {inKit && (
        <p className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          Este produto faz parte de um kit, e o kit não escolhe a peça. Tire-o do kit para usar a grade.
        </p>
      )}

      {grade && (
        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-4">
          <p className="text-xs text-neutral-500">
            Separe por vírgula. Marque as peças e escolha, em "Peças no estoque", o item de cada uma. Peça sem item
            escolhido vira um item novo na Matéria-prima, com saldo zero.
          </p>
          {(
            [
              ['fabrics', 'Tecidos', 'Algodão, Poliéster, Dryfit'],
              ['sizes', 'Tamanhos', '12, P, M, G, GG, EXG'],
              ['colors', 'Cores', 'Preta, Azul, Rosa'],
            ] as const
          ).map(([field, label, placeholder]) => (
            <div key={field} className="space-y-1">
              <span className="text-xs font-bold text-neutral-600">{label}</span>
              <input
                type="text"
                aria-label={label}
                value={lists[field]}
                onChange={e => updateList(field, e.target.value)}
                className={FIELD}
                placeholder={`Ex: ${placeholder}`}
              />
            </div>
          ))}

          {grade.sizes.length > 0 &&
            grade.colors.length > 0 &&
            grade.fabrics.map(fabric => (
              <div key={fabric} className="p-3 bg-white rounded-xl border border-neutral-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-neutral-900">{fabric}</p>
                  <button
                    type="button"
                    onClick={() => markFabric(fabric)}
                    className="text-xs font-bold text-neutral-600 hover:text-neutral-900"
                  >
                    Marcar ou desmarcar todas
                  </button>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-neutral-600">Custo da peça lisa (R$)</span>
                  <div className="grid grid-cols-3 gap-2">
                    {grade.sizes.map(size => (
                      <label key={size} className="space-y-0.5 min-w-0">
                        <span className="block text-[11px] font-bold text-neutral-500 truncate">{size}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label={`Custo ${fabric} ${size}`}
                          value={grade.costs[gradeCostKey(fabric, size)] || ''}
                          onChange={e =>
                            update({
                              ...grade,
                              costs: { ...grade.costs, [gradeCostKey(fabric, size)]: Number(e.target.value) },
                            })
                          }
                          className={`${FIELD} min-w-0 px-2`}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-neutral-600">Peças que existem no estoque</span>
                  {grade.colors.map(color => (
                    <div key={color} className="space-y-1">
                      <p className="text-[11px] font-bold text-neutral-500">{color}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {grade.sizes.map(size => {
                          const key = gradeKey(fabric, size, color);
                          const on = marked.has(key);
                          const stock = stockOf(key);
                          return (
                            <button
                              key={size}
                              type="button"
                              aria-pressed={on}
                              aria-label={`${fabric} ${size} ${color}`}
                              title={on && stock ? `Saldo ${stock.stockQuantity} ${stock.unit}` : undefined}
                              onClick={() => update(toggleGradePiece(grade, key))}
                              className={cn(
                                'min-w-9 px-2 py-1.5 rounded-lg border text-xs font-bold transition-colors',
                                on
                                  ? 'bg-neutral-900 border-neutral-900 text-white'
                                  : 'bg-white border-neutral-200 text-neutral-500',
                              )}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

          <p className="text-xs font-bold text-neutral-700">{marked.size} peça(s) marcada(s)</p>

          {marked.size > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-neutral-900">Peças no estoque</p>
              {activePieces(grade).map(piece => {
                const { fabric, size, color } = splitGradeKey(piece.key);
                const label = `${fabric} ${size} ${color}`;
                return (
                  <div key={piece.key} className="space-y-1">
                    <span className="text-[11px] font-bold text-neutral-500">{label}</span>
                    <MaterialPicker
                      ariaLabel={`Item do estoque de ${label}`}
                      materials={materials}
                      value={piece.materialId}
                      onChange={id => update(setGradePieceMaterial(grade, piece.key, id))}
                      emptyLabel="Criar item novo no estoque"
                      clearable
                    />
                  </div>
                );
              })}
            </div>
          )}

          {grade.fabrics.length > 0 && <ProductGradeTechniques grade={grade} update={update} materials={materials} />}
        </div>
      )}
    </div>
  );
}
