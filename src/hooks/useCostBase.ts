import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { CostBase } from '../types';
import { useStore } from '../contexts/StoreContext';

/**
 * Base de Custos da loja ativa (documento costBases/{loja}), acompanhada em tempo real.
 * Usada pelas calculadoras para a tabela de canais e para o valor da hora e o markup.
 */
export function useCostBase() {
  const { activeStore } = useStore();
  const [costs, setCosts] = useState<CostBase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeStore) {
      setCosts(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'costBases', activeStore.id),
      snap => {
        setCosts(snap.exists() ? (snap.data() as CostBase) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [activeStore]);

  return { costs, loading };
}

/**
 * T2 (Etapa 7): aplica os valores da Base de Custos da loja uma vez, ao abrir a calculadora ou
 * trocar de loja. Depois disso os campos são livres para editar.
 */
export function useCostBaseDefaults(costs: CostBase | null, apply: (costs: CostBase) => void) {
  const { activeStore } = useStore();
  const appliedFor = useRef<string | null>(null);
  useEffect(() => {
    const storeId = activeStore?.id;
    // Só a Base de Custos da loja ativa (evita aplicar a da loja anterior durante a troca).
    if (!costs || !storeId || costs.storeId !== storeId || appliedFor.current === storeId) return;
    appliedFor.current = storeId;
    apply(costs);
  }, [costs, activeStore, apply]);
}
