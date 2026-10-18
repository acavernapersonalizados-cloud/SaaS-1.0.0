import React from 'react';
import { Search } from 'lucide-react';
import { Material } from '../types';
import { formatCurrency } from '../lib/utils';

interface StockMaterialPickerProps {
  /** Toda a matéria-prima da loja (para a mensagem de lista vazia). */
  materials: Material[];
  /** Matéria-prima depois da busca. */
  filtered: Material[];
  selected: Material | null;
  search: string;
  onSearch: (value: string) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  quantity: number;
  onQuantity: (value: number) => void;
  onAdd: () => void;
  /** "material" (Papelaria) ou "item" (Cestas). */
  noun: string;
  /** "materiais" ou "itens". */
  nounPlural: string;
}

/** Escolha de um material da matéria-prima/estoque: busca, seleção, quantidade e saldo disponível. */
export function StockMaterialPicker({
  materials,
  filtered,
  selected,
  search,
  onSearch,
  selectedId,
  onSelect,
  quantity,
  onQuantity,
  onAdd,
  noun,
  nounPlural,
}: StockMaterialPickerProps) {
  if (materials.length === 0) {
    return (
      <p className="text-xs text-neutral-400 italic py-2">
        {`Nenhuma matéria-prima cadastrada nesta loja. Cadastre em "Matéria-prima" para puxar os ${nounPlural} aqui.`}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
        <input
          type="text"
          placeholder="Buscar no estoque..."
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-neutral-900"
        />
      </div>
      <div className="grid grid-cols-5 gap-2">
        <select
          value={selectedId}
          onChange={e => onSelect(e.target.value)}
          className="col-span-3 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none"
        >
          <option value="">{`Selecione o ${noun} do estoque...`}</option>
          {filtered.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} — {formatCurrency(Number(m.unitCost) || 0)}/{m.unit} (estoque: {m.stockQuantity ?? 0})
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Qtd"
          value={quantity || ''}
          onChange={e => onQuantity(Number(e.target.value))}
          className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!selectedId}
          className="px-2 py-2 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 text-xs font-bold disabled:opacity-40"
        >
          Adicionar
        </button>
      </div>
      {selected && (
        <p
          className={`text-[11px] font-bold ${(selected.stockQuantity || 0) < quantity ? 'text-amber-600' : 'text-neutral-500'}`}
        >
          {selected.name}: {formatCurrency(Number(selected.unitCost) || 0)}/{selected.unit} · estoque disponível{' '}
          {selected.stockQuantity ?? 0} {selected.unit}
          {(selected.stockQuantity || 0) < quantity ? ' — quantidade acima do estoque atual' : ''}
        </p>
      )}
    </div>
  );
}
