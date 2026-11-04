import { Plus, Trash2 } from 'lucide-react';
import { Material, PrintFilament } from '../types';
import { formatCurrency } from '../lib/utils';
import { formatQuantity } from '../lib/quantity';
import { filamentColorAt, printFilamentTotals } from '../lib/printPricing';
import { QuantityInput } from './QuantityInput';

const FILAMENTS = [
  'PLA',
  'PLA+',
  'PETG',
  'ABS',
  'ASA',
  'TPU',
  'Nylon',
  'Resina Standard',
  'Resina ABS-Like',
  'Resina Flex',
  'Fibra de Carbono',
  'Wood Fill',
  'Personalizado',
];

const FIELD =
  'w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm';

/** Item 29 (4/11/2026): filamentos da peça, cada um com cor, R$/kg ou vínculo com o estoque, e gramas. */
export function PrintFilaments({
  lines,
  onChange,
  purgeG,
  onPurgeChange,
  materials,
}: {
  lines: PrintFilament[];
  onChange: (lines: PrintFilament[]) => void;
  purgeG: number;
  onPurgeChange: (grams: number) => void;
  materials: Material[];
}) {
  const multi = lines.length > 1;
  const totals = printFilamentTotals(lines, purgeG);
  const update = (index: number, patch: Partial<PrintFilament>) =>
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const linkMaterial = (index: number, id: string) => {
    const selected = materials.find(item => item.id === id);
    if (!selected) {
      update(index, { materialId: null });
      return;
    }
    update(index, {
      materialId: id,
      name: selected.name,
      ...(selected.unitCost > 0 && {
        costPerKg: selected.unit.toLowerCase() === 'kg' ? selected.unitCost : selected.unitCost * 1000,
      }),
    });
  };

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index));
    // Com uma cor só não há troca: o campo some, então a purga não pode continuar na conta.
    if (lines.length === 2) onPurgeChange(0);
  };

  const addLine = () =>
    onChange([
      ...lines,
      {
        name: 'PLA',
        color: filamentColorAt(lines.length),
        costPerKg: lines[lines.length - 1]?.costPerKg ?? 0,
        grams: 0,
        materialId: null,
      },
    ]);

  return (
    <div className="md:col-span-2 space-y-3">
      {lines.map((line, index) => {
        const label = multi ? `Filamento ${index + 1}` : 'Filamento';
        return (
          <div key={index} className={multi ? 'p-3 border border-neutral-200 rounded-xl space-y-3' : 'space-y-3'}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">{label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={`Cor do ${label}`}
                    value={line.color}
                    onChange={e => update(index, { color: e.target.value })}
                    className="w-11 h-11 shrink-0 p-1 bg-neutral-50 border border-neutral-200 rounded-xl cursor-pointer"
                  />
                  <select
                    aria-label={label}
                    value={line.name}
                    onChange={e => update(index, { name: e.target.value })}
                    className={`${FIELD} min-w-0`}
                  >
                    {(FILAMENTS.includes(line.name) ? FILAMENTS : [line.name, ...FILAMENTS]).map(f => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  {multi && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      aria-label={`Remover ${label}`}
                      className="shrink-0 p-2.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Material do estoque (opcional)</label>
                <select
                  aria-label={`Material do estoque do ${label}`}
                  value={line.materialId ?? ''}
                  onChange={e => linkMaterial(index, e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none text-sm"
                >
                  <option value="">Sem vínculo com estoque</option>
                  {materials.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} · saldo {formatQuantity(item.stockQuantity)} {item.unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Custo (R$/kg)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  aria-label={`Custo do ${label} (R$/kg)`}
                  value={line.costPerKg}
                  onChange={e => update(index, { costPerKg: Number(e.target.value) })}
                  className={FIELD}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Usado (g)</label>
                {/* Padrão brasileiro: "82,02" (vírgula), aceita vírgula ou ponto. */}
                <QuantityInput
                  compact
                  ariaLabel={`${label} usado (g)`}
                  value={line.grams}
                  onChange={v => update(index, { grams: v ?? 0 })}
                  className={FIELD}
                />
              </div>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addLine}
        className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-neutral-300 rounded-xl text-xs font-bold text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Adicionar filamento
      </button>
      <p className="text-[10px] text-neutral-400">Gramas do slicer (Cura, PrusaSlicer, etc.), por peça.</p>

      {multi && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-600">Desperdício da troca / purga (g)</label>
            <QuantityInput
              compact
              ariaLabel="Desperdício da troca / purga (g)"
              value={purgeG}
              onChange={v => onPurgeChange(v ?? 0)}
              className={FIELD}
            />
            <p className="text-[10px] text-neutral-400">
              Só o que não está nas gramas acima. Divide entre os filamentos pelas gramas de cada um.
            </p>
          </div>
          <p className="p-3 bg-neutral-50 rounded-xl text-xs font-bold text-neutral-700">
            Total: {formatQuantity(totals.usedG)} g · {formatCurrency(totals.costPerKg)}/kg em média
          </p>
        </div>
      )}
    </div>
  );
}
