import { useEffect, useState } from 'react';
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
