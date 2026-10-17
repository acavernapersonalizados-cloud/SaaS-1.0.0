import React, { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CategoryScope } from '../types';
import { useCategories } from '../hooks/useCategories';
import { useStore } from '../contexts/StoreContext';
import { Plus, Check, Tag, Loader2 } from 'lucide-react';

interface Props {
  scope: CategoryScope;
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}

/**
 * Seletor de múltiplas categorias com criação rápida.
 * Um item pode estar em mais de uma categoria.
 */
export function CategoryPicker({ scope, value, onChange, label = 'Categorias' }: Props) {
  const { activeStore } = useStore();
  const { categories } = useCategories(scope);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const selected = value || [];

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const create = async () => {
    const name = newName.trim();
    if (!name || !activeStore) return;
    const existing = categories.find(c => (c.name || '').toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!selected.includes(existing.id)) onChange([...selected, existing.id]);
      setNewName('');
      return;
    }
    setCreating(true);
    try {
      const ref = await addDoc(collection(db, 'categories'), {
        storeId: activeStore.id,
        name,
        scope,
        createdAt: new Date().toISOString(),
      });
      onChange([...selected, ref.id]);
      setNewName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'categories');
    }
    setCreating(false);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
        <Tag className="w-3 h-3" /> {label}
      </label>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => {
            const active = selected.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggle(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  active
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                {active && <Check className="w-3 h-3" />}
                {cat.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              create();
            }
          }}
          placeholder="Nova categoria..."
          className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-neutral-900"
        />
        <button
          type="button"
          onClick={create}
          disabled={creating || !newName.trim()}
          className="px-3 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 disabled:opacity-40 flex items-center gap-1"
        >
          {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Criar
        </button>
      </div>
      {categories.length === 0 && (
        <p className="text-[11px] text-neutral-400">
          Nenhuma categoria ainda. Digite um nome acima para criar a primeira.
        </p>
      )}
    </div>
  );
}

/** Chips somente-leitura para listas */
export function CategoryChips({ names }: { names: string[] }) {
  if (!names.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {names.map(n => (
        <span key={n} className="text-[10px] px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-full font-bold">
          {n}
        </span>
      ))}
    </div>
  );
}

/** Barra de filtro por categoria (múltipla) para listas */
export function CategoryFilterBar({
  scope,
  selected,
  onChange,
}: {
  scope: CategoryScope;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { categories } = useCategories(scope);
  if (categories.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => onChange([])}
        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
          selected.length === 0
            ? 'bg-neutral-900 text-white border-neutral-900'
            : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
        }`}
      >
        Todas
      </button>
      {categories.map(cat => {
        const active = selected.includes(cat.id);
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(active ? selected.filter(x => x !== cat.id) : [...selected, cat.id])}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
              active
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
