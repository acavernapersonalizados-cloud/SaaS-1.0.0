import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc, runTransaction } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Material, Supplier, PurchaseListItem } from '../types';
import { formatCurrency, isLowStock, packageSize } from '../lib/utils';
import { PriceInputMode, purchaseFromInput } from '../lib/materials';
import { useStore } from '../contexts/StoreContext';
import { useToast } from '../contexts/ToastContext';
import {
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Plus,
  RefreshCw,
  Loader2,
  X,
  Search,
  Copy,
  MessageCircle,
  Truck,
  Package,
} from 'lucide-react';

type Tab = 'pending' | 'purchased';

export function PurchaseList() {
  const { activeStore } = useStore();
  const { addToast } = useToast();

  const [items, setItems] = useState<PurchaseListItem[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  // Inclusão manual
  const [manualOpen, setManualOpen] = useState(false);
  const [manualMaterialId, setManualMaterialId] = useState('');
  const [manualQty, setManualQty] = useState(1);
  const [addingManual, setAddingManual] = useState(false);

  // Registro de compra
  const [purchasingItem, setPurchasingItem] = useState<PurchaseListItem | null>(null);
  // mode começa sem escolha; estUnit = último preço pago por item (sugestão); touched = preço já digitado.
  const [purchaseForm, setPurchaseForm] = useState<{
    qty: number;
    price: number;
    supplierId: string;
    mode: PriceInputMode | null;
    estUnit: number;
    touched: boolean;
  }>({ qty: 0, price: 0, supplierId: '', mode: null, estUnit: 0, touched: false });
  const [saving, setSaving] = useState(false);

  // ── Dados da loja ativa ───────────────────────────────────────────────────
  // Sem orderBy nas queries: evita índice composto e falha silenciosa da lista.
  // O filtro por loja é reforçado no cliente para ignorar registros antigos
  // salvos sem storeId (causa de itens de outras lojas aparecendo na lista).
  useEffect(() => {
    if (!activeStore) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const storeId = activeStore.id;

    const unsubI = onSnapshot(
      query(collection(db, 'purchaseList'), where('storeId', '==', storeId)),
      snap => {
        setItems(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() }) as PurchaseListItem)
            .filter(i => i.storeId === storeId)
            .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')),
        );
        setLoading(false);
      },
      err => {
        handleFirestoreError(err, OperationType.LIST, 'purchaseList');
        setLoading(false);
      },
    );

    const unsubM = onSnapshot(
      query(collection(db, 'materials'), where('storeId', '==', storeId)),
      snap =>
        setMaterials(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() }) as Material)
            .filter(m => m.storeId === storeId)
            .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        ),
      () => {},
    );

    const unsubS = onSnapshot(
      query(collection(db, 'suppliers'), where('storeId', '==', storeId)),
      snap =>
        setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Supplier).filter(s => s.storeId === storeId)),
      () => {},
    );

    return () => {
      unsubI();
      unsubM();
      unsubS();
    };
  }, [activeStore]);

  // Ao trocar de loja, limpa filtros para não esconder itens sem motivo
  useEffect(() => {
    setSearch('');
    setSupplierFilter('');
    setTab('pending');
  }, [activeStore?.id]);

  // ── Regra do que precisa ser comprado ─────────────────────────────────────
  // Só entra na lista quem tem estoque mínimo definido (> 0) E estoque atual
  // igual ou abaixo desse mínimo. Itens incluídos manualmente sempre ficam.
  const needsPurchase = (m: Material) => isLowStock(m);

  const lowStockMaterials = useMemo(() => materials.filter(needsPurchase), [materials]);

  const suggestedFor = (m: Material) => {
    const min = Number(m.minStockQuantity) || 0;
    const cur = Number(m.stockQuantity) || 0;
    return Math.max(Math.max(min * 2, 1) - cur, 1);
  };

  /** Item enriquecido com o estado atual do estoque */
  const enriched = useMemo(
    () =>
      items.map(item => {
        const mat = materials.find(m => m.id === item.materialId) || null;
        const currentStock = mat ? Number(mat.stockQuantity) || 0 : item.currentStock;
        const minStock = mat ? Number(mat.minStockQuantity) || 0 : item.minStock;
        const stillNeeded = item.manual ? true : mat ? needsPurchase(mat) : true;
        const suggestedQty = mat && !item.manual ? suggestedFor(mat) : item.suggestedQty;
        const unitPrice = Number(item.lastPricePaid) || (mat ? Number(mat.unitCost) || 0 : 0);
        return {
          item,
          mat,
          currentStock,
          minStock,
          stillNeeded,
          suggestedQty,
          unit: mat?.unit || item.unit,
          estimated: unitPrice * (Number(suggestedQty) || 0),
          supplierName:
            item.supplierName || (mat?.supplierId ? suppliers.find(s => s.id === mat.supplierId)?.name : '') || '',
        };
      }),
    [items, materials, suppliers],
  );

  const matchesFilters = (row: (typeof enriched)[number]) => {
    const term = search.trim().toLowerCase();
    const matchSearch =
      !term ||
      (row.item.materialName || '').toLowerCase().includes(term) ||
      (row.supplierName || '').toLowerCase().includes(term);
    const matchSupplier = !supplierFilter || row.supplierName === supplierFilter;
    return matchSearch && matchSupplier;
  };

  const pendingAll = enriched.filter(r => r.item.status === 'pending' && matchesFilters(r));
  const pendingToBuy = pendingAll.filter(r => r.stillNeeded);
  const pendingResolved = pendingAll.filter(r => !r.stillNeeded);
  const purchased = enriched.filter(r => r.item.status === 'purchased' && matchesFilters(r));

  const visiblePending = showResolved ? [...pendingToBuy, ...pendingResolved] : pendingToBuy;
  const rows = tab === 'pending' ? visiblePending : purchased;

  /** Agrupamento por fornecedor (facilita fazer o pedido) */
  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>();
    rows.forEach(r => {
      const key = r.supplierName || 'Sem fornecedor';
      map.set(key, [...(map.get(key) || []), r]);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const estimatedTotal = pendingToBuy.reduce((acc, r) => acc + r.estimated, 0);
  const supplierOptions = Array.from(new Set(enriched.map(r => r.supplierName).filter(Boolean))).sort();

  // ── Ações ─────────────────────────────────────────────────────────────────
  const syncLowStock = async () => {
    if (!activeStore) return;
    setSyncing(true);
    try {
      const existingPending = items.filter(i => i.status === 'pending').map(i => i.materialId);
      let added = 0;
      for (const mat of lowStockMaterials) {
        if (existingPending.includes(mat.id)) continue;
        const supplier = mat.supplierId ? suppliers.find(s => s.id === mat.supplierId) : null;
        await addDoc(collection(db, 'purchaseList'), {
          storeId: activeStore.id,
          materialId: mat.id,
          materialName: mat.name,
          unit: mat.unit,
          currentStock: Number(mat.stockQuantity) || 0,
          minStock: Number(mat.minStockQuantity) || 0,
          suggestedQty: suggestedFor(mat),
          supplierId: mat.supplierId || null,
          supplierName: supplier?.name || null,
          lastPricePaid: Number(mat.unitCost) || null,
          status: 'pending',
          manual: false,
          addedAt: new Date().toISOString(),
        });
        added++;
      }
      addToast(added > 0 ? `${added} item(ns) adicionados à lista.` : 'Lista já está atualizada.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'purchaseList');
    }
    setSyncing(false);
  };

  const addManual = async () => {
    if (!activeStore || !manualMaterialId) return;
    const mat = materials.find(m => m.id === manualMaterialId);
    if (!mat) return;
    if (items.some(i => i.status === 'pending' && i.materialId === mat.id)) {
      addToast('Esse item já está na lista de pendentes.', 'error');
      return;
    }
    setAddingManual(true);
    try {
      const supplier = mat.supplierId ? suppliers.find(s => s.id === mat.supplierId) : null;
      await addDoc(collection(db, 'purchaseList'), {
        storeId: activeStore.id,
        materialId: mat.id,
        materialName: mat.name,
        unit: mat.unit,
        currentStock: Number(mat.stockQuantity) || 0,
        minStock: Number(mat.minStockQuantity) || 0,
        suggestedQty: Math.max(Number(manualQty) || 1, 0.01),
        supplierId: mat.supplierId || null,
        supplierName: supplier?.name || null,
        lastPricePaid: Number(mat.unitCost) || null,
        status: 'pending',
        manual: true,
        addedAt: new Date().toISOString(),
      });
      addToast('Item adicionado à lista.', 'success');
      setManualMaterialId('');
      setManualQty(1);
      setManualOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'purchaseList');
    }
    setAddingManual(false);
  };

  const handleMarkPurchased = async () => {
    if (!purchasingItem || !activeStore) return;
    if (purchaseForm.price > 0 && !purchaseForm.mode) {
      addToast('Escolha se o valor informado é o preço por unidade ou o valor total pago.', 'error');
      return;
    }
    setSaving(true);
    try {
      const supplier = purchaseForm.supplierId ? suppliers.find(s => s.id === purchaseForm.supplierId) : null;
      const mat = materials.find(m => m.id === purchasingItem.materialId);
      // Material em pacote: o formulário pede pacotes, mas estoque e custo são por item.
      const purchasedUnits = purchaseForm.qty * packageSize(mat);
      // Grava o mesmo de sempre: valor total pago e custo por item.
      const { totalPrice, unitCost } = purchaseFromInput(
        purchaseForm.mode ?? 'total',
        purchaseForm.price,
        purchasedUnits,
      );

      // Estacionamento item 7: compra e estoque numa transação só. Lê o estoque do banco (não o da tela), e um item
      // já registrado (clique duplo ou outra pessoa ao mesmo tempo) não soma de novo.
      const itemRef = doc(db, 'purchaseList', purchasingItem.id);
      const matRef =
        purchasedUnits > 0 && purchasingItem.materialId && mat ? doc(db, 'materials', purchasingItem.materialId) : null;
      const registered = await runTransaction(db, async tx => {
        const itemSnap = await tx.get(itemRef);
        if (itemSnap.exists() && itemSnap.data().status === 'purchased') return false;
        const matSnap = matRef ? await tx.get(matRef) : null;

        tx.update(itemRef, {
          storeId: activeStore.id,
          status: 'purchased',
          purchasedAt: new Date().toISOString(),
          purchasedQty: purchasedUnits,
          purchasedPrice: totalPrice,
          supplierId: purchaseForm.supplierId || purchasingItem.supplierId || null,
          supplierName: supplier?.name || purchasingItem.supplierName || null,
        });

        if (matRef && matSnap?.exists()) {
          const updateData: Record<string, any> = {
            stockQuantity: (Number(matSnap.data().stockQuantity) || 0) + purchasedUnits,
            updatedAt: new Date().toISOString(),
          };
          if (purchaseForm.price > 0) {
            updateData.unitCost = unitCost;
          }
          tx.update(matRef, updateData);
        }
        return true;
      });

      if (!registered) {
        addToast('Esta compra já tinha sido registrada; o estoque não foi somado de novo.', 'info');
        setPurchasingItem(null);
        setSaving(false);
        return;
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

  const removeResolved = async () => {
    try {
      for (const r of pendingResolved) {
        await deleteDoc(doc(db, 'purchaseList', r.item.id));
      }
      addToast('Itens já repostos foram removidos da lista.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'purchaseList');
    }
  };

  const buildShoppingText = () => {
    const lines = [`Lista de compras — ${activeStore?.fantasyName || activeStore?.name || ''}`, ''];
    grouped.forEach(([supplierName, groupRows]) => {
      const toBuy = groupRows.filter(r => r.stillNeeded || tab === 'purchased');
      if (toBuy.length === 0) return;
      lines.push(`*${supplierName}*`);
      toBuy.forEach(r => {
        lines.push(`• ${r.item.materialName} — ${r.suggestedQty} ${r.unit || ''}`.trim());
      });
      lines.push('');
    });
    if (tab === 'pending' && estimatedTotal > 0) {
      lines.push(`Estimativa total: ${formatCurrency(estimatedTotal)}`);
    }
    return lines.join('\n');
  };

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(buildShoppingText());
      addToast('Lista copiada!', 'success');
    } catch {
      addToast('Não foi possível copiar a lista.', 'error');
    }
  };

  const sendWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildShoppingText())}`, '_blank');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!activeStore)
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <ShoppingCart className="w-8 h-8 text-neutral-300" />
        <p className="text-neutral-500">Selecione uma loja</p>
      </div>
    );

  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  const purchasePack = packageSize(materials.find(m => m.id === purchasingItem?.materialId));
  const purchaseUnits = purchaseForm.qty * purchasePack;
  const purchasePreview =
    purchaseForm.mode && purchaseForm.price > 0 && purchaseUnits > 0
      ? purchaseFromInput(purchaseForm.mode, purchaseForm.price, purchaseUnits)
      : null;
  const choosePurchaseMode = (mode: PriceInputMode) =>
    setPurchaseForm(f => ({
      ...f,
      mode,
      // Sem nada digitado ainda: preenche com a sugestão (último preço pago) no modo escolhido.
      price: f.touched ? f.price : mode === 'unit' ? f.estUnit : f.estUnit * f.qty * purchasePack,
    }));
  const notInList = materials.filter(m => !items.some(i => i.status === 'pending' && i.materialId === m.id));

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-neutral-400 mb-1">
            <ShoppingCart className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">
              {activeStore.fantasyName || activeStore.name}
            </span>
          </div>
          <h1 className="text-3xl font-black text-neutral-900">Lista de Compras</h1>
          <p className="text-neutral-500 mt-1">Só o que está abaixo do estoque mínimo desta loja.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setManualOpen(true)}
            className="flex items-center gap-2 px-4 py-3 border border-neutral-200 text-neutral-700 rounded-xl font-bold text-sm hover:bg-neutral-50 transition-all"
          >
            <Plus className="w-4 h-4" /> Incluir item
          </button>
          <button
            onClick={copyList}
            className="flex items-center gap-2 px-4 py-3 border border-neutral-200 text-neutral-700 rounded-xl font-bold text-sm hover:bg-neutral-50 transition-all"
          >
            <Copy className="w-4 h-4" /> Copiar
          </button>
          <button
            onClick={sendWhatsApp}
            className="flex items-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-400 transition-all"
          >
            <MessageCircle className="w-4 h-4" /> Enviar
          </button>
          <button
            onClick={syncLowStock}
            disabled={syncing}
            className="flex items-center gap-2 px-5 py-3 bg-neutral-900 text-white rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sincronizar
          </button>
        </div>
      </header>

      {lowStockMaterials.length > 0 && pendingToBuy.length < lowStockMaterials.length && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-800">{lowStockMaterials.length} item(ns) abaixo do mínimo nesta loja</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Clique em "Sincronizar" para trazer os que ainda não estão na lista.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">A comprar</p>
          <p className="text-3xl font-black text-amber-600 mt-1">{pendingToBuy.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Estimativa</p>
          <p className="text-3xl font-black text-neutral-900 mt-1">{formatCurrency(estimatedTotal)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Comprados</p>
          <p className="text-3xl font-black text-emerald-600 mt-1">{purchased.length}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar item ou fornecedor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <select
            value={supplierFilter}
            onChange={e => setSupplierFilter(e.target.value)}
            className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none"
          >
            <option value="">Todos os fornecedores</option>
            {supplierOptions.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex gap-2 bg-neutral-100 p-1 rounded-2xl w-fit">
            {[
              { id: 'pending' as Tab, label: `A comprar (${pendingToBuy.length})` },
              { id: 'purchased' as Tab, label: `Comprados (${purchased.length})` },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${tab === t.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'pending' && pendingResolved.length > 0 && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showResolved}
                  onChange={e => setShowResolved(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-xs font-bold text-neutral-600">
                  Mostrar {pendingResolved.length} já reposto(s)
                </span>
              </label>
              <button onClick={removeResolved} className="text-xs font-bold text-red-500 hover:text-red-600">
                Limpar repostos
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lista agrupada por fornecedor */}
      <div className="space-y-4">
        {rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm py-16 text-center text-neutral-400 italic">
            {tab === 'pending' ? 'Nada a comprar agora. Estoque em ordem! 🎉' : 'Nenhuma compra registrada ainda.'}
          </div>
        ) : (
          grouped.map(([supplierName, groupRows]) => (
            <div
              key={supplierName}
              className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden"
            >
              <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="text-xs font-black text-neutral-600 uppercase tracking-wider">{supplierName}</span>
                </div>
                {tab === 'pending' && (
                  <span className="text-xs font-bold text-neutral-500">
                    {formatCurrency(groupRows.reduce((acc, r) => acc + (r.stillNeeded ? r.estimated : 0), 0))}
                  </span>
                )}
              </div>
              <div className="divide-y divide-neutral-50">
                {groupRows.map(r => (
                  <div
                    key={r.item.id}
                    className={`p-5 transition-colors ${r.stillNeeded ? 'hover:bg-neutral-50' : 'bg-emerald-50/40'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-neutral-900">{r.item.materialName}</p>
                          {r.item.manual && (
                            <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold uppercase">
                              manual
                            </span>
                          )}
                          {!r.stillNeeded && r.item.status === 'pending' && (
                            <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold uppercase">
                              já reposto
                            </span>
                          )}
                          {!r.mat && (
                            <span className="text-[10px] px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-full font-bold uppercase">
                              item removido do estoque
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                          <div>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase">Estoque atual</p>
                            <p className={`text-sm font-bold ${r.stillNeeded ? 'text-red-600' : 'text-emerald-600'}`}>
                              {r.currentStock} {r.unit}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase">Mínimo</p>
                            <p className="text-sm font-bold text-neutral-700">
                              {r.minStock} {r.unit}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase">Comprar</p>
                            <p className="text-sm font-bold text-neutral-900">
                              {r.suggestedQty} {r.unit}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase">Estimativa</p>
                            <p className="text-sm font-bold text-neutral-700">{formatCurrency(r.estimated)}</p>
                          </div>
                        </div>

                        {r.item.status === 'purchased' && r.item.purchasedAt && (
                          <p className="text-xs text-emerald-600 font-medium mt-2">
                            ✓ Comprado em {new Date(r.item.purchasedAt).toLocaleDateString('pt-BR')}
                            {r.item.purchasedQty
                              ? ` · ${r.item.purchasedQty} ${packageSize(materials.find(m => m.id === r.item.materialId)) > 1 ? 'itens' : r.unit}`
                              : ''}
                            {r.item.purchasedPrice ? ` · ${formatCurrency(r.item.purchasedPrice)}` : ''}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {r.item.status === 'pending' && (
                          <button
                            onClick={() => {
                              setPurchasingItem(r.item);
                              const pack = packageSize(materials.find(m => m.id === r.item.materialId));
                              const qty = pack > 1 ? Math.ceil(r.suggestedQty / pack) : r.suggestedQty;
                              // Preço vazio até escolher como informar; ao escolher, entra a sugestão nesse modo.
                              setPurchaseForm({
                                qty,
                                price: 0,
                                supplierId: r.item.supplierId || '',
                                mode: null,
                                estUnit: Number(r.item.lastPricePaid) || 0,
                                touched: false,
                              });
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Comprado
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(r.item.id)}
                          className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal incluir item */}
      {manualOpen && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-neutral-900">Incluir na lista</h3>
              <button onClick={() => setManualOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full">
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            {notInList.length === 0 ? (
              <p className="text-sm text-neutral-500 italic">Todos os itens do estoque desta loja já estão na lista.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Item do estoque</label>
                  <select
                    value={manualMaterialId}
                    onChange={e => setManualMaterialId(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                  >
                    <option value="">Selecione...</option>
                    {notInList.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} (estoque: {m.stockQuantity ?? 0} {m.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Quantidade a comprar</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={manualQty || ''}
                    onChange={e => setManualQty(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
                <button
                  onClick={addManual}
                  disabled={addingManual || !manualMaterialId}
                  className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {addingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                  Adicionar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal registrar compra */}
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
                <label className="text-xs font-bold text-neutral-700">
                  {purchasePack > 1
                    ? `Pacotes comprados (1 pacote = ${purchasePack} itens)`
                    : `Quantidade comprada (${purchasingItem.unit})`}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchaseForm.qty}
                  onChange={e => setPurchaseForm(f => ({ ...f, qty: Number(e.target.value) }))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <fieldset className="space-y-2">
                  <legend className="text-xs font-bold text-neutral-700">Informar:</legend>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['unit', purchasePack > 1 ? 'preço por unidade (item)' : 'preço por unidade'],
                        ['total', 'valor total pago'],
                      ] as const
                    ).map(([mode, label]) => (
                      <label
                        key={mode}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${purchaseForm.mode === mode ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}
                      >
                        <input
                          type="radio"
                          name="purchasePriceMode"
                          value={mode}
                          checked={purchaseForm.mode === mode}
                          onChange={() => choosePurchaseMode(mode)}
                          className="w-4 h-4"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {!purchaseForm.mode && (
                    <p className="text-xs font-bold text-amber-700">
                      Escolha se o valor é o de uma unidade ou o total pago (obrigatório para registrar com preço).
                    </p>
                  )}
                </fieldset>
                <label className="text-xs font-bold text-neutral-700">
                  {purchaseForm.mode === 'unit'
                    ? 'Preço por unidade (R$)'
                    : purchaseForm.mode === 'total'
                      ? 'Valor total pago (R$)'
                      : 'Preço (escolha acima)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  aria-label="Preço da compra"
                  value={purchaseForm.price || ''}
                  onChange={e => setPurchaseForm(f => ({ ...f, price: Number(e.target.value), touched: true }))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none font-bold"
                />
                {purchaseForm.estUnit > 0 && (
                  <p className="text-[10px] text-neutral-400 font-bold">
                    Último preço pago: {formatCurrency(purchaseForm.estUnit)} por unidade
                  </p>
                )}
                {purchasePreview && (
                  <p
                    role="status"
                    className="px-3 py-2 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs font-bold"
                  >
                    = {formatCurrency(purchasePreview.unitCost)} por unidade · total{' '}
                    {formatCurrency(purchasePreview.totalPrice)}
                    {purchasePack > 1 ? ` · entram ${purchaseUnits} itens no estoque` : ''}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700">Fornecedor</label>
                <select
                  value={purchaseForm.supplierId}
                  onChange={e => setPurchaseForm(f => ({ ...f, supplierId: e.target.value }))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                >
                  <option value="">Selecione...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPurchasingItem(null)}
                disabled={saving}
                className="flex-1 py-3 bg-neutral-100 text-neutral-900 rounded-xl font-bold hover:bg-neutral-200 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleMarkPurchased}
                disabled={saving}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
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
