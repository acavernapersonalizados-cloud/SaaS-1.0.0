import { useState } from 'react';
import { MaterialGrade } from '../types';
import { gradeCostKey, parseGradeList } from '../lib/grade';
import { gradeKeysOf } from '../lib/materialGrade';

const FIELD =
  'w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900';

const EMPTY: MaterialGrade = { fabrics: [], sizes: [], colors: [], costs: {} };

/** 16/11/2026: matéria-prima com grade (ex.: uma "Camiseta"); o saldo fica em cada combinação, no Estoque. */
export function MaterialGradeSection({
  grade,
  onChange,
  canEnable,
  locked,
}: {
  grade: MaterialGrade | null | undefined;
  onChange: (grade: MaterialGrade | null) => void;
  /** Material com saldo não vira grade (o saldo ficaria sem dono). */
  canEnable: boolean;
  /** Já salvo com grade: não dá para desligar (os itens das combinações têm saldo). */
  locked: boolean;
}) {
  const [lists, setLists] = useState({
    fabrics: grade?.fabrics.join(', ') ?? '',
    sizes: grade?.sizes.join(', ') ?? '',
    colors: grade?.colors.join(', ') ?? '',
  });
  const updateList = (field: keyof typeof lists, text: string) => {
    setLists(l => ({ ...l, [field]: text }));
    if (grade) onChange({ ...grade, [field]: parseGradeList(text) });
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!grade}
          disabled={locked || (!grade && !canEnable)}
          onChange={e => onChange(e.target.checked ? EMPTY : null)}
          className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
        />
        <span className="text-sm font-bold text-neutral-700">Tem grade (tecido, tamanho e cor)?</span>
      </label>
      {!grade && !canEnable && (
        <p className="text-xs text-neutral-500">Só um material sem saldo pode virar grade. Zere o saldo no Estoque.</p>
      )}

      {grade && (
        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-4">
          <p className="text-xs text-neutral-500">
            Ex.: uma "Camiseta" só. Separe por vírgula. O saldo de cada combinação entra pelo Estoque, em "Ver grade".
          </p>
          {(
            [
              ['fabrics', 'Tecidos', 'Algodão, Poliéster, Dryfit'],
              ['sizes', 'Tamanhos', '12, P, M, G, GG, EXG'],
              ['colors', 'Cores', 'Branca, Azul, Preta'],
            ] as const
          ).map(([field, label, placeholder]) => (
            <label key={field} className="block space-y-1">
              <span className="text-xs font-bold text-neutral-600">{label}</span>
              <input
                type="text"
                aria-label={label}
                value={lists[field]}
                onChange={e => updateList(field, e.target.value)}
                className={FIELD}
                placeholder={`Ex: ${placeholder}`}
              />
            </label>
          ))}

          {grade.sizes.length > 0 &&
            grade.fabrics.map(fabric => (
              <div key={fabric} className="p-3 bg-white rounded-xl border border-neutral-200 space-y-2">
                <p className="text-sm font-bold text-neutral-900">{fabric}: custo da peça lisa (R$)</p>
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
                          onChange({
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
            ))}

          <p className="text-xs font-bold text-neutral-700">{gradeKeysOf(grade).length} combinação(ões)</p>
        </div>
      )}
    </div>
  );
}
