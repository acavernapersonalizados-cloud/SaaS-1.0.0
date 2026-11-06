import { Plus, Trash2, X } from 'lucide-react';
import { Material, ProductGrade, ProductGradeTechnique } from '../types';
import { cn } from '../lib/utils';
import { QuantityInput } from './QuantityInput';

const BOX =
  'px-3 py-2 bg-white border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900';

/** Estacionamento item 30, parte B2: técnicas da grade, com insumos, tempo, valor a mais e os tecidos que aceitam. */
export function ProductGradeTechniques({
  grade,
  update,
  materials,
}: {
  grade: ProductGrade;
  update: (next: ProductGrade) => void;
  materials: Material[];
}) {
  const techniques = grade.techniques ?? [];
  const stock = materials.filter(m => !m.gradeProductId);
  const change = (id: string, patch: Partial<ProductGradeTechnique>) =>
    update({ ...grade, techniques: techniques.map(t => (t.id === id ? { ...t, ...patch } : t)) });
  const add = () =>
    update({
      ...grade,
      techniques: [
        ...techniques,
        {
          id: Math.random().toString(36).substr(2, 9),
          name: '',
          materials: [],
          minutes: 0,
          additionalValue: 0,
          fabrics: [...grade.fabrics],
        },
      ],
    });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-bold text-neutral-900">Técnicas</p>
        <p className="text-xs text-neutral-500">
          Com técnica cadastrada, o orçamento exige escolher uma. Os insumos daqui somam à receita do produto: tire dela
          o que estiver aqui, para não cobrar e baixar duas vezes.
        </p>
      </div>

      {techniques.map((technique, index) => {
        const label = `técnica ${index + 1}`;
        return (
          <div key={technique.id} className="p-3 bg-white rounded-xl border border-neutral-200 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                aria-label={`Nome da ${label}`}
                value={technique.name}
                onChange={e => change(technique.id, { name: e.target.value })}
                className={`${BOX} flex-1 min-w-0`}
                placeholder="Ex: Sublimação"
              />
              <button
                type="button"
                aria-label={`Remover ${label}`}
                onClick={() => update({ ...grade, techniques: techniques.filter(t => t.id !== technique.id) })}
                className="p-1.5 shrink-0 text-neutral-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 min-w-0">
                <span className="block text-xs font-bold text-neutral-600">Tempo por peça (min)</span>
                <input
                  type="number"
                  min="0"
                  aria-label={`Tempo da ${label} (min)`}
                  value={technique.minutes || ''}
                  onChange={e => change(technique.id, { minutes: Number(e.target.value) })}
                  className={`${BOX} w-full min-w-0`}
                />
              </label>
              <label className="space-y-1 min-w-0">
                <span className="block text-xs font-bold text-neutral-600">Valor a mais (R$)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  aria-label={`Valor a mais da ${label} (R$)`}
                  value={technique.additionalValue || ''}
                  onChange={e => change(technique.id, { additionalValue: Number(e.target.value) })}
                  className={`${BOX} w-full min-w-0`}
                />
              </label>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-neutral-600">Tecidos que aceitam</span>
              <div className="flex flex-wrap gap-1.5">
                {grade.fabrics.map(fabric => {
                  const on = technique.fabrics.includes(fabric);
                  return (
                    <button
                      key={fabric}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${fabric} aceita a ${label}`}
                      onClick={() =>
                        change(technique.id, {
                          fabrics: on ? technique.fabrics.filter(f => f !== fabric) : [...technique.fabrics, fabric],
                        })
                      }
                      className={cn(
                        'px-2 py-1.5 rounded-lg border text-xs font-bold transition-colors',
                        on
                          ? 'bg-neutral-900 border-neutral-900 text-white'
                          : 'bg-white border-neutral-200 text-neutral-500',
                      )}
                    >
                      {fabric}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-neutral-600">Insumos por peça</span>
              {technique.materials.map(pm => {
                const mat = materials.find(m => m.id === pm.materialId);
                return (
                  <div key={pm.materialId} className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-xs font-bold text-neutral-700 truncate">
                      {mat?.name ?? 'Material apagado'}
                    </span>
                    <QuantityInput
                      compact
                      ariaLabel={`Quantidade de ${mat?.name ?? 'material'} na ${label}`}
                      value={pm.quantity || null}
                      onChange={v =>
                        change(technique.id, {
                          materials: technique.materials.map(m =>
                            m.materialId === pm.materialId ? { ...m, quantity: v ?? 0 } : m,
                          ),
                        })
                      }
                      className={`${BOX} w-20 text-center`}
                      placeholder="Qtd"
                    />
                    <span className="text-[11px] text-neutral-400 w-6 shrink-0">{mat?.unit}</span>
                    <button
                      type="button"
                      aria-label={`Tirar ${mat?.name ?? 'material'} da ${label}`}
                      onClick={() =>
                        change(technique.id, {
                          materials: technique.materials.filter(m => m.materialId !== pm.materialId),
                        })
                      }
                      className="p-1 shrink-0 text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              <select
                aria-label={`Adicionar insumo na ${label}`}
                value=""
                onChange={e =>
                  e.target.value &&
                  change(technique.id, {
                    materials: [...technique.materials, { materialId: e.target.value, quantity: 1 }],
                  })
                }
                className={`${BOX} w-full`}
              >
                <option value="">Adicionar insumo…</option>
                {stock
                  .filter(m => !technique.materials.some(pm => pm.materialId === m.id))
                  .map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={add}
        className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-neutral-300 rounded-xl text-xs font-bold text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Adicionar técnica
      </button>
    </div>
  );
}
