import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Category, CategoryScope } from '../types';
import { useStore } from '../contexts/StoreContext';

/**
 * Categorias da loja ativa, filtradas por escopo ('material' | 'product').
 * Sem orderBy na query (evita necessidade de índice composto); ordena no cliente.
 */
export function useCategories(scope: CategoryScope) {
  const { activeStore } = useStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeStore) {
      setCategories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, 'categories'), where('storeId', '==', activeStore.id), where('scope', '==', scope));
    const unsub = onSnapshot(
      q,
      snap => {
        const data = snap.docs
          .map(d => ({ id: d.id, ...d.data() }) as Category)
          .filter(c => c.storeId === activeStore.id)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setCategories(data);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [activeStore, scope]);

  return { categories, loading };
}

export function categoryNames(ids: string[] | undefined, categories: Category[]): string[] {
  if (!ids?.length) return [];
  return ids.map(id => categories.find(c => c.id === id)?.name).filter((n): n is string => !!n);
}
