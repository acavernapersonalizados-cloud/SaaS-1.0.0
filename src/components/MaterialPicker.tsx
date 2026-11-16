import { useState } from 'react';
import { Search } from 'lucide-react';
import { Material } from '../types';
import { formatQuantity } from '../lib/quantity';
import { CategoryFilterBar } from './CategoryPicker';

const stockText = (m: Material) => `saldo ${formatQuantity(m.stockQuantity)} ${m.unit}`;

/** Item 30: escolher material com busca, categoria e "só com saldo" (a lista simples ficava longa demais). */
export function MaterialPicker({
  materials,
  value,
  onChange,
  ariaLabel,
  emptyLabel,
  clearable = false,
}: {
  materials: Material[];
  value: string | null;
  onChange: (id: string | null) => void;
  ariaLabel: string;
  /** Texto do botão sem material escolhido. */
  emptyLabel: string;
  /** Mostra a opção de ficar sem material. */
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyInStock, setOnlyInStock] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const selected = materials.find(m => m.id === value);
  const term = search.trim().toLowerCase();
  const list = materials
    .filter(m => !term || (m.name || '').toLowerCase().includes(term))
    .filter(m => !onlyInStock || (Number(m.stockQuantity) || 0) > 0)
    .filter(m => categories.length === 0 || (m.categoryIds || []).some(id => categories.includes(id)));
  const choose = (id: string | null) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="space-y-2 min-w-0">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-sm text-left truncate"
      >
        {selected ? `${selected.name} · ${stockText(selected)}` : emptyLabel}
      </button>
      {open && (
        <div className="p-2 bg-white border border-neutral-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg">
            <Search className="text-neutral-400 w-4 h-4 shrink-0" />
            <input
              type="text"
              aria-label={`Buscar: ${ariaLabel}`}
              placeholder="Buscar material..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none flex-1 min-w-0 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-neutral-600">
            <input type="checkbox" checked={onlyInStock} onChange={e => setOnlyInStock(e.target.checked)} />
            Só o que tem saldo
          </label>
          <div className="min-w-0 overflow-x-auto">
            <CategoryFilterBar scope="material" selected={categories} onChange={setCategories} />
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-neutral-50">
            {clearable && (
              <button
                type="button"
                onClick={() => choose(null)}
                className="w-full text-left px-2 py-2 text-sm text-neutral-500 hover:bg-neutral-50"
              >
                {emptyLabel}
              </button>
            )}
            {list.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => choose(m.id)}
                className="w-full text-left px-2 py-2 hover:bg-neutral-50 flex items-center justify-between gap-2"
              >
                <span className="text-sm font-medium text-neutral-900 min-w-0 truncate">{m.name}</span>
                <span className="text-[11px] font-bold text-neutral-400 shrink-0">{stockText(m)}</span>
              </button>
            ))}
            {list.length === 0 && (
              <p className="px-2 py-3 text-xs text-neutral-400 text-center italic">Nenhum material encontrado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
