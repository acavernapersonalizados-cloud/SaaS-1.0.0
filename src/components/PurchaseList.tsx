import React, { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot, addDoc, updateDoc,
  doc, deleteDoc, getDocs, orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Material, Supplier, PurchaseListItem } from '../types';
import { formatCurrency } from '../lib/utils';
import { useStore } from '../contexts/StoreContext';
import { useToast } from '../contexts/ToastContext';
import {
  ShoppingCart, AlertCircle, CheckCircle2, Trash2, Plus,
  RefreshCw, Package, Loader2, X, History
} from 'lucide-react';

export function PurchaseList() {
  const { activeStore } = useStore();
  const { addToast } = useToast();

  const [items, setItems] = useState<PurchaseListItem[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState<'pending' | 'purchased'>('pending');

  // Purchase modal state
  const [purchasingItem, setPurchasingItem] = useState<PurchaseListItem | null>(null);
  const [purchaseForm, setPurchaseForm] = useState({ qty: 0, price: 0, supplierId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeStore) { setLoading(false); return; }

    const unsubI = onSnapshot(
      query(collection(db, 'purchaseList'), where('storeId', '==', activeStore.id), orderBy('addedAt', 'desc')),
      snap => { setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseListItem))); setLoading(false); },
      err => { handleFirestoreError(err, OperationType.LIST, 'purchaseList'); setLoading(false); }
    );

    const unsubM = onSnapshot(
      query(collection(db, 'materials'), where('storeId', '==', activeStore.id)),
      snap => setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material))),
      () => {}
    );

    const unsubS = onSnapshot(
      query(collection(db, 'suppliers'), where('storeId', '==', activeStore.id)),
      snap => setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier))),
      () => {}
    );

    return () => { unsubI(); unsubM(); unsubS(); };
  }, [activeStore]);

  // Auto-sync: check which materials are below minimum and add to list
  const syncLowStock = async () => {
    if (!activeStore) return;
    setSyncing(true);
    try {
      const lowStock = materials.filter(m =>
        (m.stockQuantity || 0) <= (m.minStockQuantity || 0) &&
        (m.minStockQuantity || 0) > 0
      );

      const existingPending = items.filter(i => i.status === 'pending').map(i => i.materialId);

      let added = 0;
      for (const mat of lowStock) {
        if (existingPending.includes(mat.id)) continue; // already in list
        const supplier = mat.supplierId ? suppliers.find(s => s.id === mat.supplierId) : null;
        await addDoc(collection(db, 'purchaseList'), {
          storeId: activeStore.id,
          materialId: mat.id,
          materialName: mat.name,
          unit: mat.unit,
          currentStock: mat.stockQuantity || 0,
          minStock: mat.minStockQuantity || 0,
          suggestedQty: Math.max(mat.minStockQuantity * 2, 1) - (mat.stockQuantity || 0),
          supplierId: mat.supplierId || null,
          supplierName: supplier?.name || null,
          lastPricePaid: mat.unitCost || null,
          status: 'pending',
          addedAt: new Date().toISOString(),
        });
        added++;
      }

      addToast(added > 0 ? `${added} item(s) adicionados à lista.` : 'Lista já atualizada.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'purchaseList');
    }
    setSyncing(false);
  };

  const handleMarkPurchased = async () => {
    if (!purchasingItem || !activeStore) return;
    setSaving(true);
    try {
      const supplier = purchaseForm.supplierId
        ? suppliers.find(s => s.id === purchaseForm.supplierId)
        : null;

      // Update purchase list item
      await updateDoc(doc(db, 'purchaseList', purchasingItem.id), {
        status: 'purchased',
        purchasedAt: new Date().toISOString(),
        purchasedQty: purchaseForm.qty,
        purchasedPrice: purchaseForm.price,
        supplierId: purchaseForm.supplierId || purchasingItem.supplierId,
        supplierName: supplier?.name || purchasingItem.supplierName,
      });

      // Update material stock
      if (purchaseForm.qty > 0 && purchasingItem.materialId) {
        const mat = materials.find(m => m.id === purchasingItem.materialId);
        if (mat) {
          const newStock = (mat.stockQuantity || 0) + purchaseForm.qty;
          const updateData: Record<string, any> = {
            stockQuantity: newStock,
            updatedAt: new Date().toISOString(),
          };
          // Update unit cost if price was informed
          if (purchaseForm.price > 0 && purchaseForm.qty > 0) {
            updateData.unitCost = purchaseForm.price / purchaseForm.qty;
          }
          await updateDoc(doc(db, 'materials', purchasingItem.materialId), updateData);
        }
      }

      addToast('Compra registrada e estoque atualizado!', 'success');
      setPurchasingItem(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `purchaseList/${purchasingItem.id}`);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'purchaseList', id));
      addToast('Item removido.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `purchaseList/${id}`);
    }
  };

  const pending = items.filter(i => i.status === 'pending');
  const purchased = items.filter(i => i.status === 'purchased');
  const lowStockCount = materials.filter(m =>
    (m.stockQuantity || 0) <= (m.minStockQuantity || 0) && (m.minStockQuantity || 0) > 0
  ).length;

  if (!activeStore) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <ShoppingCart className="w-8 h-8 text-neutral-300" />
      <p className="text-neutral-500">Selecione uma loja</p>
    </div>
  );

  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Lista de Compras</h1>
          <p className="text-neutral-500 mt-1">Materiais que precisam ser repostos.</p>
        </div>
        <button onClick={syncLowStock} disabled={syncing}
          className="flex items-center gap-2 px-5 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all disabled:opacity-50">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sincronizar Estoque Baixo
        </button>
      </header>

      {/* Alert */}
      {lowStockCount > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-800">{lowStockCount} material(is) com estoque abaixo do mínimo</p>
            <p className="text-xs text-amber-600 mt-0.5">Clique em "Sincronizar" para adicioná-los à lista automaticamente.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
          <p className="text-xs font-bold text-neutral-400 uppercase">Pendentes</p>
          <p className="text-3xl font-black text-amber-600 mt-1">{pending.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
          <p className="text-xs font-bold text-neutral-400 uppercase">Comprados</p>
          <p className="text-3xl font-black text-emerald-600 mt-1">{purchased.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-neutral-100 p-1 rounded-2xl w-fit">
        {[
          { id: 'pending', label: `Pendentes (${pending.length})` },
          { id: 'purchased', label: `Comprados (${purchased.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${tab === t.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        {(tab === 'pending' ? pending : purchased).length === 0 ? (
          <div className="py-16 text-center text-neutral-400 italic">
            {tab === 'pending' ? 'Nenhum item pendente. Estoque OK! 🎉' : 'Nenhuma compra registrada ainda.'}
          </div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {(tab === 'pending' ? pending : purchased).map(item => (
              <div key={item.id} className="p-5 hover:bg-neutral-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-neutral-900">{item.materialName}</p>
                      {item.supplierName && (
                        <span className="text-[10px] px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-full font-bold">{item.supplierName}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                      <div>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase">Estoque atual</p>
                        <p className="text-sm font-bold text-red-600">{item.currentStock} {item.unit}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase">Mínimo</p>
                        <p className="text-sm font-bold text-neutral-700">{item.minStock} {item.unit}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase">Sugestão</p>
                        <p className="text-sm font-bold text-neutral-900">{item.suggestedQty} {item.unit}</p>
                      </div>
                      {item.lastPricePaid && (
                        <div>
                          <p className="text-[10px] text-neutral-400 font-bold uppercase">Último preço</p>
                          <p className="text-sm font-bold text-neutral-700">{formatCurrency(item.lastPricePaid)}</p>
                        </div>
                      )}
                    </div>
                    {item.status === 'purchased' && item.purchasedAt && (
                      <p className="text-xs text-emerald-600 font-medium mt-2">
                        ✓ Comprado em {new Date(item.purchasedAt).toLocaleDateString('pt-BR')}
                        {item.purchasedQty ? ` · ${item.purchasedQty} ${item.unit}` : ''}
                        {item.purchasedPrice ? ` · ${formatCurrency(item.purchasedPrice)}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.status === 'pending' && (
                      <button
                        onClick={() => { setPurchasingItem(item); setPurchaseForm({ qty: item.suggestedQty, price: (item.lastPricePaid || 0) * item.suggestedQty, supplierId: item.supplierId || '' }); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors">
                        <CheckCircle2 className="w-4 h-4" /> Comprado
                      </button>
                    )}
                    <button onClick={() => handleDelete(item.id)}
                      className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Purchase modal */}
      {purchasingItem && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-neutral-900">Registrar Compra</h3>
              <button onClick={() => setPurchasingItem(null)} className="p-2 hover:bg-neutral-100 rounded-full">
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>
            <p className="text-neutral-600 font-medium">{purchasingItem.materialName}</p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700">Quantidade comprada ({purchasingItem.unit})</label>
                <input type="number" min="0" step="0.01"
                  value={purchaseForm.qty}
                  onChange={e => setPurchaseForm(f => ({ ...f, qty: Number(e.target.value) }))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none font-bold" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700">Valor total pago (R$)</label>
                <input type="number" min="0" step="0.01"
                  value={purchaseForm.price}
                  onChange={e => setPurchaseForm(f => ({ ...f, price: Number(e.target.value) }))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none font-bold" />
                {purchaseForm.qty > 0 && purchaseForm.price > 0 && (
                  <p className="text-xs text-neutral-400">Custo unitário: {formatCurrency(purchaseForm.price / purchaseForm.qty)}/{purchasingItem.unit}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700">Fornecedor</label>
                <select value={purchaseForm.supplierId}
                  onChange={e => setPurchaseForm(f => ({ ...f, supplierId: e.target.value }))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm">
                  <option value="">Selecione...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setPurchasingItem(null)} disabled={saving}
                className="flex-1 py-3 bg-neutral-100 text-neutral-900 rounded-xl font-bold hover:bg-neutral-200 transition-all disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleMarkPurchased} disabled={saving}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
