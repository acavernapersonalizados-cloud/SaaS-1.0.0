import React, { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Category, CategoryScope, Material, Product } from '../types';
import { useStore } from '../contexts/StoreContext';
import { useToast } from '../contexts/ToastContext';
import { Tag, Plus, Trash2, Edit2, Check, X, Loader2, Package, Box, Wand2 } from 'lucide-react';
import { OrganizeCategories } from './OrganizeCategories';
import { pendingCategoryGroups } from '../lib/categoryAudit';

const SCOPES: Array<{ id: CategoryScope; label: string; hint: string }> = [
  { id: 'material', label: 'Matéria-prima / Estoque', hint: 'Ex: Tecidos, Papéis, Ferragens, Tintas' },
  { id: 'product', label: 'Produtos', hint: 'Ex: Presentes, Datas comemorativas, Corporativo' },
];

export function Categories() {
  const { activeStore } = useStore();
  const { addToast } = useToast();

  const [scope, setScope] = useState<CategoryScope>('material');
  const [categories, setCategories] = useState<Category[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Estacionamento item 14: janela "Organizar categorias" (grafias do antigo texto livre dos produtos).
  const [organizing, setOrganizing] = useState(false);

  useEffect(() => {
    if (!activeStore) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const unsubC = onSnapshot(
      query(collection(db, 'categories'), where('storeId', '==', activeStore.id)),
      snap => {
        setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Category));
        setLoading(false);
      },
      err => {
        handleFirestoreError(err, OperationType.LIST, 'categories');
        setLoading(false);
      },
    );

    const unsubM = onSnapshot(
      query(collection(db, 'materials'), where('storeId', '==', activeStore.id)),
      snap => setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Material)),
      () => {},
    );

    const unsubP = onSnapshot(
      query(collection(db, 'products'), where('storeId', '==', activeStore.id)),
      snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Product)),
      () => {},
    );

    return () => {
      unsubC();
      unsubM();
      unsubP();
    };
  }, [activeStore]);

  const visible = categories.filter(c => c.scope === scope).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const usageCount = (categoryId: string) =>
    scope === 'material'
      ? materials.filter(m => (m.categoryIds || []).includes(categoryId)).length
      : products.filter(p => (p.categoryIds || []).includes(categoryId)).length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !activeStore) return;
    if (visible.some(c => (c.name || '').toLowerCase() === name.toLowerCase())) {
      addToast('Já existe uma categoria com esse nome.', 'error');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'categories'), {
        storeId: activeStore.id,
        name,
        scope,
        createdAt: new Date().toISOString(),
      });
      setNewName('');
      addToast('Categoria criada!', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'categories');
    }
    setSaving(false);
  };

  const handleRename = async (cat: Category) => {
    const name = editingName.trim();
    if (!name) return;
    try {
      await updateDoc(doc(db, 'categories', cat.id), { name });
      addToast('Categoria renomeada!', 'success');
      setEditingId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `categories/${cat.id}`);
    }
  };

  const handleDelete = async () => {
    if (!toDelete || !activeStore) return;
    setDeleting(true);
    try {
      // Remove a referência dos itens antes de excluir (evita categorias órfãs)
      const col = toDelete.scope === 'material' ? 'materials' : 'products';
      const snap = await getDocs(query(collection(db, col), where('storeId', '==', activeStore.id)));
      for (const d of snap.docs) {
        const ids: string[] = d.data().categoryIds || [];
        if (ids.includes(toDelete.id)) {
          await updateDoc(doc(db, col, d.id), { categoryIds: ids.filter(i => i !== toDelete.id) });
        }
      }
      await deleteDoc(doc(db, 'categories', toDelete.id));
      addToast('Categoria excluída.', 'success');
      setToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `categories/${toDelete.id}`);
    }
    setDeleting(false);
  };

  if (!activeStore)
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
          <Tag className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
      </div>
    );

  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2 text-neutral-400 mb-1">
          <Tag className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Organização</span>
        </div>
        <h1 className="text-3xl font-black text-neutral-900">Categorias</h1>
        <p className="text-neutral-500 mt-1">
          Crie quantas categorias quiser. Cada material ou produto pode estar em várias delas.
        </p>
      </header>

      <div className="flex gap-2 bg-neutral-100 p-1 rounded-2xl w-fit">
        {SCOPES.map(s => (
          <button
            key={s.id}
            onClick={() => {
              setScope(s.id);
              setEditingId(null);
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              scope === s.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {s.id === 'material' ? <Package className="w-4 h-4" /> : <Box className="w-4 h-4" />}
            {s.label}
          </button>
        ))}
      </div>

      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-6">
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={`Nova categoria — ${SCOPES.find(s => s.id === scope)?.hint}`}
            className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
          />
          <button
            type="submit"
            disabled={saving || !newName.trim()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar
          </button>
        </form>

        {scope === 'product' && pendingCategoryGroups(products, visible).length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <p className="flex-1 text-sm text-amber-900">
              Há produtos com categoria digitada à mão ({pendingCategoryGroups(products, visible).length} grafia(s)
              diferentes). Organize para usarem só as categorias desta lista.
            </p>
            <button
              type="button"
              onClick={() => setOrganizing(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-xl font-bold text-sm"
            >
              <Wand2 className="w-4 h-4" /> Organizar categorias
            </button>
          </div>
        )}

        {visible.length === 0 ? (
          <p className="py-14 text-center text-neutral-400 italic text-sm">Nenhuma categoria criada ainda.</p>
        ) : (
          <div className="divide-y divide-neutral-50">
            {visible.map(cat => (
              <div key={cat.id} className="py-3 flex items-center gap-3">
                {editingId === cat.id ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      autoFocus
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(cat);
                      }}
                      className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                    <button
                      onClick={() => handleRename(cat)}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-lg transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-bold text-neutral-900 text-sm">{cat.name}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-full font-bold uppercase">
                      {usageCount(cat.id)} {scope === 'material' ? 'itens' : 'produtos'}
                    </span>
                    <button
                      onClick={() => {
                        setEditingId(cat.id);
                        setEditingName(cat.name);
                      }}
                      className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setToDelete(cat)}
                      className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {toDelete && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6">
            <div className="flex items-center gap-4 text-red-600">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Excluir categoria?</h3>
            </div>
            <p className="text-neutral-600 leading-relaxed">
              "{toDelete.name}" será removida de {usageCount(toDelete.id)}{' '}
              {toDelete.scope === 'material' ? 'item(ns) do estoque' : 'produto(s)'}. Os itens em si não serão
              excluídos.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setToDelete(null)}
                disabled={deleting}
                className="flex-1 py-3 bg-neutral-100 text-neutral-900 rounded-xl font-bold hover:bg-neutral-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {organizing && activeStore && (
        <OrganizeCategories
          storeId={activeStore.id}
          products={products}
          officials={categories.filter(c => c.scope === 'product')}
          onClose={() => setOrganizing(false)}
          addToast={addToast}
        />
      )}
    </div>
  );
}
