/**
 * OrganizeCategories — janela "Organizar categorias" (Estacionamento item 14, aprovado em 27/10/2026).
 * Mostra as grafias do antigo texto livre dos produtos (todos, inclusive os ocultos do catálogo), a categoria oficial
 * sugerida para cada grupo e quantos produtos mudam. Só grava quando a pessoa clica em "Confirmar e gravar".
 */
import React, { useMemo, useState } from 'react';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Category, Product } from '../types';
import { categoryKey, pendingCategoryGroups, planCategoryUnification } from '../lib/categoryAudit';
import { Loader2, Wand2, X } from 'lucide-react';

const NEW = '__nova__';

export function OrganizeCategories({
  storeId,
  products,
  officials,
  onClose,
  addToast,
}: {
  storeId: string;
  products: Product[];
  officials: Category[];
  onClose: () => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}) {
  // Só os grupos que ainda pedem atenção (os já organizados não aparecem).
  const groups = useMemo(() => pendingCategoryGroups(products, officials), [products, officials]);
  // Escolha de cada grupo: id da oficial, NEW (criar uma nova) ou '' (não mexer). Começa na sugestão.
  const [choice, setChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.map(g => [g.key, g.suggestedCategoryId ?? ''])),
  );
  const [newName, setNewName] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.map(g => [g.key, g.suggestedName])),
  );
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Categorias novas pedidas (uma por nome; nome igual a uma oficial usa a oficial).
  const wantedNew = useMemo(() => {
    const byName = new Map<string, string>();
    for (const g of groups) {
      if (choice[g.key] !== NEW) continue;
      const name = (newName[g.key] || '').trim();
      if (name && !officials.some(o => categoryKey(o.name) === categoryKey(name))) byName.set(categoryKey(name), name);
    }
    return [...byName.values()];
  }, [groups, choice, newName, officials]);

  /** Escolhas finais (grafia → id), com ids provisórios ("nova:...") ou reais para as categorias novas. */
  const resolveChoices = (newIds: Map<string, string>) => {
    const out: Record<string, string> = {};
    for (const g of groups) {
      const c = choice[g.key];
      if (!c) continue;
      if (c !== NEW) out[g.key] = c;
      else {
        const name = (newName[g.key] || '').trim();
        const official = officials.find(o => categoryKey(o.name) === categoryKey(name));
        const id = official?.id ?? newIds.get(categoryKey(name));
        if (name && id) out[g.key] = id;
      }
    }
    return out;
  };
  const previewIds = new Map(wantedNew.map(n => [categoryKey(n), `nova:${categoryKey(n)}`]));
  const previewOfficials = [
    ...officials,
    ...wantedNew.map(
      n => ({ id: `nova:${categoryKey(n)}`, name: n, storeId, scope: 'product', createdAt: '' }) as Category,
    ),
  ];
  const plan = planCategoryUnification(products, resolveChoices(previewIds), previewOfficials);

  const handleSave = async () => {
    if (saving || plan.length === 0) return;
    setSaving(true);
    try {
      // 1) Categorias novas primeiro, para os produtos apontarem para elas.
      const created: Category[] = [];
      const newIds = new Map<string, string>();
      for (const name of wantedNew) {
        const data = { storeId, name, scope: 'product' as const, createdAt: new Date().toISOString() };
        const ref = await addDoc(collection(db, 'categories'), data);
        created.push({ id: ref.id, ...data });
        newIds.set(categoryKey(name), ref.id);
      }
      // 2) Os produtos do plano (refeito com os ids reais).
      const finalPlan = planCategoryUnification(products, resolveChoices(newIds), [...officials, ...created]);
      const now = new Date().toISOString();
      const results = await Promise.allSettled(
        finalPlan.map(u =>
          updateDoc(doc(db, 'products', u.productId), {
            categoryIds: u.categoryIds,
            category: u.category,
            updatedAt: now,
          }),
        ),
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        addToast(
          `${finalPlan.length - failed} produto(s) organizados; ${failed} não gravaram. Abra de novo e confirme.`,
          'error',
        );
      } else {
        addToast(`${finalPlan.length} produto(s) organizados.`, 'success');
        onClose();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'products');
    }
    setSaving(false);
  };

  const productName = (id: string) => products.find(p => p.id === id)?.name || id;

  return (
    <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between px-8 pt-8 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
              <Wand2 className="w-5 h-5" /> Organizar categorias
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              Grafias do antigo campo de texto dos produtos (todos, inclusive os ocultos do catálogo). Escolha a
              categoria oficial de cada grupo. Nada é gravado até você clicar em "Confirmar e gravar".
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full" aria-label="Fechar">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <div className="overflow-y-auto px-8 divide-y divide-neutral-100">
          {groups.length === 0 && (
            <p className="py-10 text-center text-sm text-neutral-400 italic">Nenhum produto com categoria em texto.</p>
          )}
          {groups.map(g => (
            <div key={g.key} className="py-4 space-y-2">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5">
                    {g.spellings.map(s => (
                      <span key={s.text} className="px-2 py-0.5 rounded-lg bg-neutral-100 text-xs font-semibold">
                        "{s.text}" ×{s.count}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenKey(openKey === g.key ? null : g.key)}
                    className="text-xs text-neutral-500 underline mt-1"
                  >
                    {g.productIds.length} produto(s) — {openKey === g.key ? 'esconder' : 'ver quais'}
                  </button>
                </div>
                <select
                  aria-label={`Categoria para ${g.suggestedName}`}
                  value={choice[g.key] ?? ''}
                  onChange={e => setChoice(c => ({ ...c, [g.key]: e.target.value }))}
                  className="md:w-64 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm"
                >
                  <option value="">Não mexer</option>
                  {officials.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                  <option value={NEW}>+ Nova categoria…</option>
                </select>
              </div>
              {choice[g.key] === NEW && (
                <input
                  aria-label={`Nome da nova categoria para ${g.suggestedName}`}
                  value={newName[g.key] ?? ''}
                  onChange={e => setNewName(n => ({ ...n, [g.key]: e.target.value }))}
                  className="w-full md:w-64 md:ml-auto block px-3 py-2 bg-white border border-neutral-300 rounded-xl text-sm"
                  placeholder="Nome da categoria nova"
                />
              )}
              {openKey === g.key && (
                <ul className="text-xs text-neutral-600 list-disc pl-5">
                  {g.productIds.map(id => (
                    <li key={id}>{productName(id)}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between px-8 py-6 border-t border-neutral-100">
          <p role="status" className="text-sm font-semibold text-neutral-700">
            {plan.length} produto(s) vão mudar
            {wantedNew.length > 0 && ` · ${wantedNew.length} categoria(s) nova(s): ${wantedNew.join(', ')}`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-xl font-bold text-sm text-neutral-600 hover:bg-neutral-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || plan.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold text-sm disabled:opacity-40"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar e gravar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
