import { X } from 'lucide-react';
import { Material, ProductMaterial } from '../types';
import { formatCurrency } from '../lib/utils';
import { extraSuppliesCost } from '../lib/supplies';
import { MaterialPicker } from './MaterialPicker';
import { QuantityInput } from './QuantityInput';

/** 19/11/2026: outros insumos por peça nas calculadoras (ex.: argola e tag NFC no chaveiro). */
export function ExtraSupplies({
  lines,
  onChange,
  materials,
}: {
  lines: ProductMaterial[];
  onChange: (lines: ProductMaterial[]) => void;
  materials: Material[];
}) {
  const total = extraSuppliesCost(lines, materials);
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-bold text-neutral-600">Outros insumos por peça (opcional)</p>
        <p className="text-[11px] text-neutral-400">
          Ex.: argola e tag NFC no chaveiro. Entram no custo e, no produto, na baixa do estoque.
        </p>
      </div>
      {lines.map(line => {
        const mat = materials.find(m => m.id === line.materialId);
        return (
          <div key={line.materialId} className="flex items-center gap-2">
            <span className="flex-1 min-w-0 text-sm font-bold text-neutral-800 truncate">
              {mat?.name ?? 'Material apagado'}
            </span>
            <QuantityInput
              compact
              ariaLabel={`Quantidade de ${mat?.name ?? 'insumo'} por peça`}
              unit={mat?.unit}
              value={line.quantity || null}
              onChange={v =>
                onChange(lines.map(l => (l.materialId === line.materialId ? { ...l, quantity: v ?? 0 } : l)))
              }
              className="w-20 px-2 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-center"
              placeholder="Qtd"
            />
            <span className="text-xs font-bold text-emerald-700 w-16 text-right shrink-0">
              {formatCurrency((Number(mat?.unitCost) || 0) * (Number(line.quantity) || 0))}
            </span>
            <button
              type="button"
              aria-label={`Tirar ${mat?.name ?? 'insumo'}`}
              onClick={() => onChange(lines.filter(l => l.materialId !== line.materialId))}
              className="p-1 shrink-0 text-neutral-400 hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
      <MaterialPicker
        ariaLabel="Adicionar outro insumo"
        materials={materials.filter(m => !lines.some(l => l.materialId === m.id))}
        value={null}
        onChange={id => id && onChange([...lines, { materialId: id, quantity: 1 }])}
        emptyLabel="Adicionar insumo…"
      />
      {lines.length > 0 && (
        <p className="text-xs font-bold text-neutral-700">Insumos por peça: {formatCurrency(total)}</p>
      )}
    </div>
  );
}
