/**
 * JobProduct.tsx — botões e janela de confirmação para um trabalho salvo virar Produto (Etapa 8C, item 4).
 * Usado pelas 5 calculadoras. Nada é gravado sem a confirmação na janela.
 */
import React, { useState } from 'react';
import { addDoc, collection, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Loader2, PackagePlus } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { JobKind } from '../types';
import { formatCurrency } from '../lib/utils';
import {
  ConvertibleJob,
  JOB_COLLECTIONS,
  jobProductBlock,
  jobUnitCost,
  jobUnitPrice,
  productFromJob,
  productPriceUpdate,
} from '../lib/jobProduct';
import { useStore } from '../contexts/StoreContext';
import { useToast } from '../contexts/ToastContext';
import { useCategories } from '../hooks/useCategories';

type Target = { job: ConvertibleJob; mode: 'create' | 'update'; currentPrice?: number | null };

/** Botão "Salvar e criar produto" das calculadoras (na hora): salva o trabalho e abre a janela de confirmação. */
export function SaveAndCreateProductButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-neutral-900 text-neutral-900 rounded-xl font-bold hover:bg-neutral-50 transition-all disabled:opacity-40"
    >
      <PackagePlus className="w-4 h-4" /> Salvar e criar produto
    </button>
  );
}

/**
 * Janela e botões "Virar produto" / "Abrir produto" / "Atualizar preço" de uma calculadora.
 * onOpenProduct leva à tela Produtos com o produto aberto (sem ele, o botão não aparece).
 */
export function useJobProduct(kind: JobKind, onOpenProduct?: (productId: string) => void) {
  const { activeStore } = useStore();
  const { addToast } = useToast();
  const { categories } = useCategories('product');
  const [target, setTarget] = useState<Target | null>(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [saving, setSaving] = useState(false);

  const openCreate = (job: ConvertibleJob) => {
    setName(job.name);
    setCategoryId('');
    setTarget({ job, mode: 'create' });
  };

  /** "Salvar e criar produto": depois de salvar, abre a janela, ou avisa o motivo de não poder (trava 5). */
  const createAfterSave = (job: ConvertibleJob, hasMachine = true) => {
    const block = jobProductBlock(kind, job, hasMachine);
    if (block) addToast(`Trabalho salvo, mas não virou produto: ${block}`, 'error');
    else openCreate(job);
  };

  const openUpdate = async (job: ConvertibleJob) => {
    if (!job.productId) return;
    let currentPrice: number | null = null;
    try {
      const snap = await getDoc(doc(db, 'products', job.productId));
      currentPrice = snap.exists() ? Number(snap.data().manualPrice ?? snap.data().catalogPrice) || null : null;
    } catch {
      currentPrice = null;
    }
    setTarget({ job, mode: 'update', currentPrice });
  };

  const confirm = async () => {
    if (!target || !activeStore) return;
    const { job, mode } = target;
    const now = new Date().toISOString();
    setSaving(true);
    try {
      if (mode === 'create') {
        const category = categories.find(c => c.id === categoryId);
        const ref = await addDoc(
          collection(db, 'products'),
          productFromJob(kind, job, {
            storeId: activeStore.id,
            name,
            categoryId: category?.id,
            categoryName: category?.name,
            now,
          }),
        );
        // Trava 2: o trabalho guarda o id do produto (sem duplicados).
        await updateDoc(doc(db, JOB_COLLECTIONS[kind], job.id), { productId: ref.id });
        addToast('Produto criado, oculto no catálogo. Marque "mostrar no catálogo" quando quiser.', 'success');
      } else if (job.productId) {
        await updateDoc(doc(db, 'products', job.productId), productPriceUpdate(job, now));
        addToast('Preço do produto atualizado.', 'success');
      }
      setTarget(null);
    } catch (err) {
      handleFirestoreError(err, mode === 'create' ? OperationType.CREATE : OperationType.UPDATE, 'products');
    } finally {
      setSaving(false);
    }
  };

  /** Botões da linha do trabalho salvo. hasMachine: a máquina do trabalho ainda está cadastrada. */
  const actions = (job: ConvertibleJob, hasMachine = true) => {
    if (job.productId) {
      return (
        <div className="flex flex-wrap justify-end gap-1">
          {onOpenProduct && (
            <button
              type="button"
              onClick={() => onOpenProduct(job.productId!)}
              className="px-2 py-1 text-[11px] font-bold text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200"
            >
              Abrir produto
            </button>
          )}
          <button
            type="button"
            onClick={() => openUpdate(job)}
            className="px-2 py-1 text-[11px] font-bold text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200"
          >
            Atualizar preço do produto
          </button>
        </div>
      );
    }
    const block = jobProductBlock(kind, job, hasMachine);
    return (
      <div className="flex flex-col items-end gap-0.5">
        <button
          type="button"
          disabled={!!block}
          title={block ?? undefined}
          onClick={() => openCreate(job)}
          className="px-2 py-1 text-[11px] font-bold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 disabled:opacity-40"
        >
          Virar produto
        </button>
        {block && <span className="text-[10px] text-neutral-400 max-w-[12rem] text-right">{block}</span>}
      </div>
    );
  };

  const modal = target && (
    <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div
        role="dialog"
        aria-label={target.mode === 'create' ? 'Criar produto' : 'Atualizar preço do produto'}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-neutral-100 rounded-2xl flex items-center justify-center">
            <PackagePlus className="w-5 h-5 text-neutral-700" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900">
            {target.mode === 'create' ? 'Criar produto' : 'Atualizar preço do produto'}
          </h3>
        </div>

        {target.mode === 'create' ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-600">Nome do produto</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-600">Categoria</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
              >
                <option value="">Sem categoria</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-neutral-500">Custo por unidade</dt>
              <dd className="text-right font-bold text-neutral-900">{formatCurrency(jobUnitCost(target.job))}</dd>
              <dt className="text-neutral-500">Preço por unidade</dt>
              <dd className="text-right font-bold text-neutral-900">{formatCurrency(jobUnitPrice(target.job))}</dd>
            </dl>
            <p className="text-xs text-neutral-500">
              O produto nasce oculto no catálogo. Foto, descrição e "mostrar no catálogo" ficam na tela Produtos.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-neutral-500">Preço atual do produto</dt>
              <dd className="text-right font-bold text-neutral-900">
                {target.currentPrice ? formatCurrency(target.currentPrice) : '—'}
              </dd>
              <dt className="text-neutral-500">Novo preço (do trabalho)</dt>
              <dd className="text-right font-bold text-neutral-900">{formatCurrency(jobUnitPrice(target.job))}</dd>
              <dt className="text-neutral-500">Novo custo por unidade</dt>
              <dd className="text-right font-bold text-neutral-900">{formatCurrency(jobUnitCost(target.job))}</dd>
            </dl>
            <p className="text-xs text-neutral-500">
              Usa o custo e o preço gravados neste trabalho; nada é recalculado.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => setTarget(null)}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-neutral-100 text-neutral-900 rounded-xl font-bold hover:bg-neutral-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={saving || (target.mode === 'create' && !name.trim())}
            className="flex-1 px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {target.mode === 'create' ? 'Confirmar e criar' : 'Confirmar atualização'}
          </button>
        </div>
      </div>
    </div>
  );

  return { openCreate, createAfterSave, actions, modal };
}
