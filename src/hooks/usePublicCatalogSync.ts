/**
 * usePublicCatalogSync — mantém a cópia pública do catálogo (catalogProducts, sem custos) igual aos produtos da
 * loja (Estacionamento item 4, 26/10/2026). Roda nas telas que já carregam os produtos (Produtos e Catálogo):
 * cria a cópia que falta, atualiza a que mudou e apaga a de produto oculto ou apagado. Só grava o que difere.
 */
import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Product } from '../types';
import { isAppOutdated } from '../lib/appUpdate';
import { publicCatalogChanges, type PublicProduct } from '../lib/catalogPublic';
import { catalogSyncFailureMessage } from '../lib/catalog';
import { useToast } from '../contexts/ToastContext';

export function usePublicCatalogSync(storeId: string | undefined, products: Product[], ready: boolean) {
  const { addToast } = useToast();
  const [stored, setStored] = useState<Map<string, Partial<PublicProduct>> | null>(null);

  useEffect(() => {
    setStored(null);
    if (!storeId) return;
    return onSnapshot(
      query(collection(db, 'catalogProducts'), where('storeId', '==', storeId)),
      snap => setStored(new Map(snap.docs.map(d => [d.id, d.data() as Partial<PublicProduct>]))),
      // Sem permissão ou sem conexão: não sincroniza (o catálogo continua com a última cópia).
      () => setStored(null),
    );
  }, [storeId]);

  useEffect(() => {
    if (!storeId || !ready || !stored) return;
    // Troca de loja: a lista ainda é da loja anterior; espera a da loja ativa.
    if (products.some(p => p.storeId !== storeId)) return;
    const timer = setTimeout(async () => {
      // Aba com versão antiga (já existe uma publicada): não grava nada até atualizar.
      if (isAppOutdated()) return;
      const { set, remove } = publicCatalogChanges(products, stored);
      if (set.length === 0 && remove.length === 0) return;
      const writes = [
        ...set.map(s => setDoc(doc(db, 'catalogProducts', s.id), s.data)),
        ...remove.map(id => deleteDoc(doc(db, 'catalogProducts', id))),
      ];
      // Falha nunca é silenciosa: um aviso por rodada, com a quantidade e o motivo.
      const failures = (await Promise.allSettled(writes)).flatMap(r => (r.status === 'rejected' ? [r.reason] : []));
      const warning = catalogSyncFailureMessage(failures);
      if (warning) addToast(warning, 'error');
    }, 1500);
    return () => clearTimeout(timer);
  }, [storeId, products, stored, ready]);
}
