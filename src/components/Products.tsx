import React, { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy, where, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, Material, ProductMaterial, CostBase, FinishingOption, Accessory } from '../types';
import { formatCurrency } from '../lib/utils';
import { calcProductPricing, calcReversePrice, getProfitStatus, calcCatalogKPIs } from '../lib/pricingEngine';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { analyzeManualPrice } from '../services/gemini';
import { uploadProductImage, uploadGalleryImage, deleteImageByUrl } from '../services/imageUpload';
import { ProductImageUpload } from './ProductImageUpload';
import {
  Plus, Trash2, Box, Search, PlusCircle, X, Clock, Package, Edit2,
  Loader2, Sparkles, DollarSign, TrendingUp, AlertCircle, CheckCircle2,
  LayoutGrid, Table2, ArrowUpDown, Filter, ArrowRight, BarChart3, Layers, Image
} from 'lucide-react';

type ViewMode = 'cards' | 'table';
type SortField = 'name' | 'cost' | 'price' | 'margin' | 'profit';
type FilterMode = 'all' | 'no_price' | 'loss' | 'risky' | 'low' | 'good' | 'excellent';

export function Products() {
  const { activeStore } = useStore();
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [costs, setCosts] = useState<CostBase | null>(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const emptyProduct: Partial<Product> = {
    name: '', category: '', materials: [], productionTime: 0,
    packagingCost: 0, isPackage: false, packageQuantity: 1,
    finishingOptions: [], accessories: [], manualPrice: null,
  };
  const [newProduct, setNewProduct] = useState<Partial<Product>>(emptyProduct);
  const [materialSearchTerm, setMaterialSearchTerm] = useState('');
  const [newFinishing, setNewFinishing] = useState({ name: '', description: '', additionalValue: 0 });
  const [newAccessory, setNewAccessory] = useState({ name: '', additionalValue: 0 });

  // AI & reverse pricing state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [reversePriceInput, setReversePriceInput] = useState<string>('');

  // Image upload state
  const [imageUploading, setImageUploading] = useState(false);
  // ─── Firestore ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeStore) { setLoading(false); return; }

    const qP = query(collection(db, 'products'), where('storeId', '==', activeStore.id), orderBy('name', 'asc'));
    const unsubP = onSnapshot(qP, snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    }, err => { handleFirestoreError(err, OperationType.LIST, 'products'); setLoading(false); });

    const qM = query(collection(db, 'materials'), where('storeId', '==', activeStore.id), orderBy('name', 'asc'));
    const unsubM = onSnapshot(qM, snap => {
      setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'materials'));

    // CostBase uses storeId as document ID
    const unsubCosts = onSnapshot(doc(db, 'costBases', activeStore.id), snap => {
      if (snap.exists()) setCosts(snap.data() as CostBase);
      else setCosts(null);
    }, err => console.warn('costBases:', err));

    return () => { unsubP(); unsubM(); unsubCosts(); };
  }, [activeStore]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const resetForm = () => {
    setNewProduct(emptyProduct);
    setAiAnalysis('');
    setReversePriceInput('');
    setMaterialSearchTerm('');
    setEditingProduct(null);
    setIsModalOpen(false);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !newProduct.name || !newProduct.category) return;
    try {
      const productData = { ...newProduct, storeId: activeStore.id, updatedAt: new Date().toISOString() };
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        addToast('Produto atualizado com sucesso!', 'success');
      } else {
        await addDoc(collection(db, 'products'), { ...productData, createdAt: new Date().toISOString() });
        addToast('Produto cadastrado com sucesso!', 'success');
      }
      resetForm();
    } catch (err) {
      handleFirestoreError(err, editingProduct ? OperationType.UPDATE : OperationType.CREATE,
        editingProduct ? `products/${editingProduct.id}` : 'products');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({ ...product, finishingOptions: product.finishingOptions || [], accessories: product.accessories || [], manualPrice: product.manualPrice ?? null });
    setAiAnalysis(product.aiPriceAnalysis || '');
    setReversePriceInput(product.manualPrice ? String(product.manualPrice) : '');
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'products', productToDelete));
      addToast('Produto excluído.', 'success');
      setProductToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${productToDelete}`);
    } finally { setIsDeleting(false); }
  };

  const handleAnalyzePrice = async () => {
    if (!newProduct.manualPrice || !newProduct.name || !newProduct.category) return;
    const pricing = calcProductPricing(newProduct, materials, costs);
    setAiLoading(true);
    try {
      const analysis = await analyzeManualPrice(newProduct.name, pricing.totalCost, newProduct.manualPrice, newProduct.category);
      setAiAnalysis(analysis || '');
      setNewProduct(p => ({ ...p, aiPriceAnalysis: analysis || '' }));
    } catch { setAiAnalysis('Erro ao analisar. Verifique sua conexão.'); }
    setAiLoading(false);
  };

  const handleMainImageUpload = async (file: File) => {
    if (!activeStore || !editingProduct) {
      addToast('Salve o produto primeiro para adicionar imagens.', 'error');
      return;
    }
    setImageUploading(true);
    try {
      const { imageUrl, thumbnailUrl } = await uploadProductImage(activeStore.id, editingProduct.id, file);
      await updateDoc(doc(db, 'products', editingProduct.id), { imageUrl, thumbnailUrl, updatedAt: new Date().toISOString() });
      setNewProduct(p => ({ ...p, imageUrl, thumbnailUrl }));
      addToast('Imagem atualizada!', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao enviar imagem.', 'error');
    }
    setImageUploading(false);
  };

  const handleMainImageRemove = async () => {
    if (!editingProduct) return;
    try {
      if (newProduct.imageUrl) await deleteImageByUrl(newProduct.imageUrl).catch(() => {});
      if (newProduct.thumbnailUrl) await deleteImageByUrl(newProduct.thumbnailUrl).catch(() => {});
      await updateDoc(doc(db, 'products', editingProduct.id), { imageUrl: null, thumbnailUrl: null, updatedAt: new Date().toISOString() });
      setNewProduct(p => ({ ...p, imageUrl: null, thumbnailUrl: null }));
      addToast('Imagem removida.', 'success');
    } catch { addToast('Erro ao remover imagem.', 'error'); }
  };

  const handleGalleryImageAdd = async (file: File) => {
    if (!activeStore || !editingProduct) {
      addToast('Salve o produto primeiro para adicionar imagens.', 'error');
      return;
    }
    const currentGallery = newProduct.galleryImages || [];
    if (currentGallery.length >= 6) { addToast('Máximo de 6 imagens na galeria.', 'error'); return; }
    setImageUploading(true);
    try {
      const url = await uploadGalleryImage(activeStore.id, editingProduct.id, file, currentGallery.length);
      const galleryImages = [...currentGallery, url];
      await updateDoc(doc(db, 'products', editingProduct.id), { galleryImages, updatedAt: new Date().toISOString() });
      setNewProduct(p => ({ ...p, galleryImages }));
      addToast('Imagem adicionada à galeria!', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Erro ao enviar imagem.', 'error');
    }
    setImageUploading(false);
  };

  const handleGalleryImageRemove = async (index: number) => {
    if (!editingProduct) return;
    const currentGallery = newProduct.galleryImages || [];
    const url = currentGallery[index];
    try {
      if (url) await deleteImageByUrl(url).catch(() => {});
      const galleryImages = currentGallery.filter((_, i) => i !== index);
      await updateDoc(doc(db, 'products', editingProduct.id), { galleryImages, updatedAt: new Date().toISOString() });
      setNewProduct(p => ({ ...p, galleryImages }));
      addToast('Imagem removida da galeria.', 'success');
    } catch { addToast('Erro ao remover imagem.', 'error'); }
  };

  const addMaterialToProduct = (materialId: string) => {
    if (!newProduct.materials?.some(m => m.materialId === materialId)) {
      setNewProduct(p => ({ ...p, materials: [...(p.materials || []), { materialId, quantity: 0 }] }));
    }
  };
  const updateMaterialQuantity = (materialId: string, quantity: number) => {
    setNewProduct(p => ({ ...p, materials: (p.materials || []).map(m => m.materialId === materialId ? { ...m, quantity } : m) }));
  };
  const removeMaterialFromProduct = (materialId: string) => {
    setNewProduct(p => ({ ...p, materials: (p.materials || []).filter(m => m.materialId !== materialId) }));
  };
  const addFinishingOption = () => {
    if (!newFinishing.name.trim()) return;
    const option: FinishingOption = { id: Date.now().toString(), ...newFinishing };
    setNewProduct(p => ({ ...p, finishingOptions: [...(p.finishingOptions || []), option] }));
    setNewFinishing({ name: '', description: '', additionalValue: 0 });
  };
  const removeFinishingOption = (id: string) => {
    setNewProduct(p => ({ ...p, finishingOptions: (p.finishingOptions || []).filter(o => o.id !== id) }));
  };
  const addAccessory = () => {
    if (!newAccessory.name.trim()) return;
    const acc: Accessory = { id: Date.now().toString(), ...newAccessory };
    setNewProduct(p => ({ ...p, accessories: [...(p.accessories || []), acc] }));
    setNewAccessory({ name: '', additionalValue: 0 });
  };
  const removeAccessory = (id: string) => {
    setNewProduct(p => ({ ...p, accessories: (p.accessories || []).filter(a => a.id !== id) }));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(a => !a);
    else { setSortField(field); setSortAsc(true); }
  };

  // ─── Derived data ────────────────────────────────────────────────────────────
  const filteredMaterialsSearch = materials.filter(m =>
    !newProduct.materials?.some(pm => pm.materialId === m.id) &&
    (m.name || '').toLowerCase().includes(materialSearchTerm.toLowerCase())
  );

  const productsWithPricing = products.map(p => ({
    product: p,
    pricing: calcProductPricing(p, materials, costs),
  }));

  const kpis = calcCatalogKPIs(products, materials, costs);

  const filteredAndSorted = productsWithPricing
    .filter(({ product: p, pricing }) => {
      const matchSearch =
        (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;
      if (filterMode === 'all') return true;
      if (filterMode === 'no_price') return !pricing.hasCosts || pricing.effectivePrice === 0;
      return pricing.profitStatus.status === filterMode;
    })
    .sort((a, b) => {
      let diff = 0;
      if (sortField === 'name') diff = (a.product.name || '').localeCompare(b.product.name || '');
      else if (sortField === 'cost') diff = a.pricing.totalCost - b.pricing.totalCost;
      else if (sortField === 'price') diff = a.pricing.effectivePrice - b.pricing.effectivePrice;
      else if (sortField === 'margin') diff = a.pricing.margin - b.pricing.margin;
      else if (sortField === 'profit') diff = a.pricing.profitPerUnit - b.pricing.profitPerUnit;
      return sortAsc ? diff : -diff;
    });

  // Reverse pricing calc
  const reverseNum = parseFloat(reversePriceInput);
  const modalPricing = calcProductPricing(newProduct, materials, costs);
  const reverseResult = !isNaN(reverseNum) && reverseNum > 0 && modalPricing.totalCost > 0
    ? calcReversePrice(reverseNum, modalPricing.totalCost)
    : null;

  if (!activeStore) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center"><Package className="w-8 h-8 text-neutral-400" /></div>
      <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
      <p className="text-neutral-500">Você precisa selecionar uma loja para gerenciar os produtos.</p>
    </div>
  );
  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Produtos</h1>
          <p className="text-neutral-500 mt-1">Cadastre produtos e visualize sua rentabilidade.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all font-bold shadow-sm">
          <PlusCircle className="w-5 h-5" /> Novo Produto
        </button>
      </header>

      {/* KPI Cards */}
      {costs && products.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Margem Média</p>
            <p className="text-2xl font-black text-neutral-900 mt-1">{kpis.avgMargin.toFixed(1)}%</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Lucro Médio/Und</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{formatCurrency(kpis.avgProfit)}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Sem Preço</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{kpis.productsWithoutPrice}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Com Prejuízo</p>
            <p className="text-2xl font-black text-red-600 mt-1">{kpis.productsWithLoss}</p>
          </div>
        </div>
      )}

      {/* Filters + Search + View toggle */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <input type="text" placeholder="Buscar produto ou categoria..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setViewMode('cards')}
              className={`p-2.5 rounded-xl border transition-all ${viewMode === 'cards' ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('table')}
              className={`p-2.5 rounded-xl border transition-all ${viewMode === 'table' ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}>
              <Table2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter chips */}
        {costs && (
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'Todos', count: products.length },
              { id: 'no_price', label: 'Sem Preço', count: kpis.productsWithoutPrice },
              { id: 'loss', label: '⛔ Prejuízo', count: kpis.productsWithLoss },
              { id: 'risky', label: '🔴 Arriscado', count: kpis.productsRisky },
              { id: 'low', label: '🟠 Margem Baixa', count: kpis.productsLowMargin },
              { id: 'good', label: '🟡 Bom', count: kpis.productsGood },
              { id: 'excellent', label: '🟢 Excelente', count: kpis.productsExcellent },
            ].map(f => (
              <button key={f.id} onClick={() => setFilterMode(f.id as FilterMode)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${filterMode === f.id ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-600 hover:border-neutral-400 bg-white'}`}>
                {f.label} {f.count > 0 && <span className="ml-1 opacity-60">({f.count})</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  {[
                    { label: 'Produto', field: 'name' },
                    { label: 'Categoria', field: null },
                    { label: 'Custo', field: 'cost' },
                    { label: 'Preço', field: 'price' },
                    { label: 'Lucro/und', field: 'profit' },
                    { label: 'Margem', field: 'margin' },
                    { label: 'Status', field: null },
                    { label: '', field: null },
                  ].map(col => (
                    <th key={col.label} className="text-left px-4 py-3 text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                      {col.field ? (
                        <button onClick={() => handleSort(col.field as SortField)}
                          className="flex items-center gap-1 hover:text-neutral-900 transition-colors">
                          {col.label}
                          <ArrowUpDown className={`w-3 h-3 ${sortField === col.field ? 'text-neutral-900' : 'text-neutral-300'}`} />
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filteredAndSorted.map(({ product: p, pricing }) => (
                  <tr key={p.id} className="hover:bg-neutral-50 transition-colors group">
                    <td className="px-4 py-3 font-bold text-neutral-900">{p.name}</td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">{p.category}</td>
                    <td className="px-4 py-3 font-mono text-neutral-600 text-xs">
                      {pricing.hasCosts ? formatCurrency(pricing.totalCost) : '—'}
                    </td>
                    <td className="px-4 py-3 font-bold text-neutral-900">
                      {pricing.effectivePrice > 0 ? formatCurrency(pricing.effectivePrice) : <span className="text-amber-500 text-xs">Sem preço</span>}
                    </td>
                    <td className={`px-4 py-3 font-bold text-xs ${pricing.profitPerUnit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {pricing.effectivePrice > 0 ? formatCurrency(pricing.profitPerUnit) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {pricing.effectivePrice > 0 ? (
                        <span className={`text-xs font-bold ${pricing.profitPerUnit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {pricing.margin.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {pricing.effectivePrice > 0 && (
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${pricing.profitStatus.badge}`}>
                          {pricing.profitStatus.emoji} {pricing.profitStatus.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(p)} className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {(isAdmin || user?.role === 'GERENTE') && (
                          <button onClick={() => setProductToDelete(p.id)} className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAndSorted.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-neutral-400 italic">Nenhum produto encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CARDS VIEW */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAndSorted.map(({ product: p, pricing }) => (
            <div key={p.id} className="bg-white p-6 rounded-2xl border border-neutral-200 hover:border-neutral-400 transition-all group relative flex flex-col">
              {/* Delete btn */}
              {(isAdmin || user?.role === 'GERENTE') && (
                <button onClick={() => setProductToDelete(p.id)}
                  className="absolute top-4 right-4 p-1.5 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${pricing.effectivePrice > 0 ? pricing.profitStatus.bg : 'bg-neutral-100'}`}>
                  <Box className={`w-5 h-5 ${pricing.effectivePrice > 0 ? pricing.profitStatus.color : 'text-neutral-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-neutral-900 truncate">{p.name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-neutral-400 uppercase tracking-wider font-bold">{p.category}</span>
                    {p.isPackage && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Pacote {p.packageQuantity}</span>}
                    {pricing.effectivePrice > 0 && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${pricing.profitStatus.badge}`}>
                        {pricing.profitStatus.emoji} {pricing.profitStatus.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="flex items-center gap-1.5 text-neutral-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{p.productionTime} min</span>
                </div>
                <div className="flex items-center gap-1.5 text-neutral-500">
                  <Layers className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{p.materials?.length || 0} materiais</span>
                </div>
              </div>

              {/* Financial data */}
              <div className="mt-auto pt-4 border-t border-neutral-100 space-y-2">
                {pricing.hasCosts ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-400 font-bold uppercase">Custo</span>
                      <span className="text-xs font-bold text-neutral-500">{formatCurrency(pricing.totalCost)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-400 font-bold uppercase">Sugerido ({costs?.profitGoal ?? '?'}%)</span>
                      <span className="text-xs font-bold text-emerald-600">{formatCurrency(pricing.suggestedPrice)}</span>
                    </div>
                    {pricing.manualPrice != null && pricing.manualPrice > 0 && (
                      <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${pricing.profitStatus.bg} ${pricing.profitStatus.border}`}>
                        <span className={`text-[10px] font-bold uppercase ${pricing.profitStatus.color}`}>Preço Manual</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-black ${pricing.profitStatus.color}`}>{formatCurrency(pricing.manualPrice)}</span>
                          {pricing.profitPerUnit >= 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <button onClick={() => handleEdit(p)} className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {pricing.effectivePrice > 0 && (
                        <div className="flex items-center gap-3 text-xs">
                          <div className="text-right">
                            <span className="text-neutral-400">Lucro </span>
                            <span className={`font-black ${pricing.profitPerUnit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(pricing.profitPerUnit)}</span>
                          </div>
                          <div className={`font-black text-sm ${pricing.profitPerUnit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {pricing.margin.toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <button onClick={() => handleEdit(p)} className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-amber-500 font-bold">Configure Base de Custos</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filteredAndSorted.length === 0 && (
            <div className="col-span-full py-20 text-center text-neutral-400 italic">Nenhum produto encontrado.</div>
          )}
        </div>
      )}

      {/* ─── MODAL ─────────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[92vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-8 pt-8 pb-0">
              <h2 className="text-2xl font-bold text-neutral-900">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={resetForm} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            <div className="overflow-y-auto px-8 py-6">
              <form onSubmit={handleAddProduct} className="space-y-8" id="product-form">

                {/* Name + Category */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Nome do Produto</label>
                    <input type="text" required value={newProduct.name || ''} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none" placeholder="Ex: Caneca Personalizada" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Categoria</label>
                    <input type="text" required value={newProduct.category || ''} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none" placeholder="Ex: Presentes" />
                  </div>
                </div>

                {/* Production time + Packaging */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Tempo de Produção (min)</label>
                    <input type="number" required value={newProduct.productionTime || ''} onChange={e => setNewProduct(p => ({ ...p, productionTime: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none" placeholder="Ex: 30" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Custo de Embalagem (R$)</label>
                    <input type="number" step="0.01" required value={newProduct.packagingCost || ''} onChange={e => setNewProduct(p => ({ ...p, packagingCost: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none" placeholder="0,00" />
                  </div>
                </div>

                {/* Package */}
                <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={newProduct.isPackage || false} onChange={e => setNewProduct(p => ({ ...p, isPackage: e.target.checked }))}
                      className="w-5 h-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900" />
                    <span className="text-sm font-bold text-neutral-700">Este produto é um pacote/kit?</span>
                  </label>
                  {newProduct.isPackage && (
                    <div className="space-y-1.5 border-t border-neutral-200 pt-3">
                      <label className="text-xs font-bold text-neutral-600">Quantidade de itens no pacote</label>
                      <input type="number" min="2" value={newProduct.packageQuantity || ''} onChange={e => setNewProduct(p => ({ ...p, packageQuantity: Number(e.target.value) }))}
                        className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none" />
                    </div>
                  )}
                </div>

                {/* Materials */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Materiais</label>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus-within:ring-2 focus-within:ring-neutral-900">
                    <Search className="text-neutral-400 w-4 h-4" />
                    <input type="text" placeholder="Pesquisar material..." value={materialSearchTerm} onChange={e => setMaterialSearchTerm(e.target.value)}
                      className="bg-transparent border-none outline-none flex-1 text-sm" />
                  </div>
                  <div className="bg-white border border-neutral-200 rounded-xl max-h-40 overflow-y-auto">
                    {filteredMaterialsSearch.length > 0 ? filteredMaterialsSearch.map(m => (
                      <button key={m.id} type="button" onClick={() => { addMaterialToProduct(m.id); setMaterialSearchTerm(''); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 transition-colors border-b border-neutral-50 last:border-0 flex items-center justify-between">
                        <span className="font-medium text-sm text-neutral-900">{m.name}</span>
                        <span className="text-xs text-neutral-400 font-bold">{m.unit} · {formatCurrency(m.unitCost)}</span>
                      </button>
                    )) : (
                      <div className="px-4 py-3 text-sm text-neutral-400 text-center italic">Nenhum material encontrado.</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {newProduct.materials?.map(pm => {
                      const mat = materials.find(m => m.id === pm.materialId);
                      const lineCost = (mat?.unitCost || 0) * (pm.quantity || 0);
                      return (
                        <div key={pm.materialId} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-neutral-900 truncate">{mat?.name}</p>
                            <p className="text-xs text-neutral-400">{mat?.unit} · {formatCurrency(mat?.unitCost || 0)}/un</p>
                          </div>
                          <input type="number" step="0.01" value={pm.quantity || ''} onChange={e => updateMaterialQuantity(pm.materialId, Number(e.target.value))}
                            className="w-24 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm text-center font-bold outline-none focus:ring-2 focus:ring-neutral-900" placeholder="Qtd" />
                          <span className="text-xs font-bold text-emerald-700 w-16 text-right">{formatCurrency(lineCost)}</span>
                          <button type="button" onClick={() => removeMaterialFromProduct(pm.materialId)} className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                    {!newProduct.materials?.length && (
                      <div className="text-center py-5 border-2 border-dashed border-neutral-100 rounded-xl text-neutral-400 text-xs italic">Nenhum material adicionado.</div>
                    )}
                  </div>
                </div>

                {/* Finishing */}
                <div className="space-y-3 pt-2 border-t border-neutral-100">
                  <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Acabamentos (opcional)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" placeholder="Nome" value={newFinishing.name} onChange={e => setNewFinishing(f => ({ ...f, name: e.target.value }))}
                      className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900" />
                    <input type="number" placeholder="Valor" value={newFinishing.additionalValue || ''} onChange={e => setNewFinishing(f => ({ ...f, additionalValue: Number(e.target.value) }))}
                      className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900" />
                    <button type="button" onClick={addFinishingOption} className="px-3 py-2 bg-neutral-100 text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-200 flex items-center justify-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {newProduct.finishingOptions?.map(o => (
                      <div key={o.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                        <div><p className="text-sm font-bold text-neutral-900">{o.name}</p><p className="text-xs text-neutral-500">{formatCurrency(o.additionalValue)}</p></div>
                        <button type="button" onClick={() => removeFinishingOption(o.id)} className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Accessories */}
                <div className="space-y-3 pt-2 border-t border-neutral-100">
                  <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Acessórios (opcional)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" placeholder="Nome" value={newAccessory.name} onChange={e => setNewAccessory(a => ({ ...a, name: e.target.value }))}
                      className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900" />
                    <input type="number" placeholder="Valor" value={newAccessory.additionalValue || ''} onChange={e => setNewAccessory(a => ({ ...a, additionalValue: Number(e.target.value) }))}
                      className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900" />
                    <button type="button" onClick={addAccessory} className="px-3 py-2 bg-neutral-100 text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-200 flex items-center justify-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {newProduct.accessories?.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                        <div><p className="text-sm font-bold text-neutral-900">{a.name}</p><p className="text-xs text-neutral-500">{formatCurrency(a.additionalValue)}</p></div>
                        <button type="button" onClick={() => removeAccessory(a.id)} className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── PRECIFICAÇÃO ───────────────────────────────────── */}
                <div className="space-y-4 pt-4 border-t-2 border-neutral-200">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-neutral-700" />
                    <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wider">Precificação</h3>
                  </div>

                  {/* Cost breakdown live */}
                  {costs && (newProduct.materials?.length || 0) > 0 && (
                    <div className="grid grid-cols-3 gap-2 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                      <div className="text-center">
                        <p className="text-[10px] text-neutral-400 font-bold uppercase">Material</p>
                        <p className="text-sm font-black text-neutral-800">{formatCurrency(modalPricing.materialCost)}</p>
                      </div>
                      <div className="text-center border-x border-neutral-200">
                        <p className="text-[10px] text-neutral-400 font-bold uppercase">Mão de Obra</p>
                        <p className="text-sm font-black text-neutral-800">{formatCurrency(modalPricing.laborCost)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-neutral-400 font-bold uppercase">Embalagem</p>
                        <p className="text-sm font-black text-neutral-800">{formatCurrency(modalPricing.packagingCost)}</p>
                      </div>
                      <div className="col-span-3 pt-2 border-t border-neutral-200 flex items-center justify-between">
                        <span className="text-xs text-neutral-500 font-bold">Custo Total</span>
                        <span className="text-base font-black text-neutral-900">{formatCurrency(modalPricing.totalCost)}</span>
                      </div>
                      <div className="col-span-3 flex items-center justify-between">
                        <span className="text-xs text-emerald-600 font-bold">Sugerido ({costs.profitGoal}% margem)</span>
                        <span className="text-base font-black text-emerald-700">{formatCurrency(modalPricing.suggestedPrice)}</span>
                      </div>
                    </div>
                  )}

                  {/* Manual price input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Preço de Venda Manual (opcional)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">R$</span>
                      <input type="number" step="0.01" min="0"
                        value={newProduct.manualPrice || ''}
                        onChange={e => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          setNewProduct(p => ({ ...p, manualPrice: val }));
                          setReversePriceInput(e.target.value);
                        }}
                        className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none font-bold text-lg" placeholder="0,00" />
                    </div>
                  </div>

                  {/* ── PRECIFICAÇÃO REVERSA ── */}
                  {reverseResult && (
                    <div className={`p-4 rounded-2xl border space-y-3 ${reverseResult.profitStatus.bg} ${reverseResult.profitStatus.border}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black uppercase tracking-wider ${reverseResult.profitStatus.color}`}>
                          {reverseResult.profitStatus.emoji} {reverseResult.profitStatus.label}
                        </span>
                        <span className={`text-xs font-bold ${reverseResult.profitStatus.color}`}>{reverseResult.margin.toFixed(1)}% margem</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[10px] text-neutral-500 font-bold uppercase">Custo</p>
                          <p className="text-sm font-black text-neutral-800">{formatCurrency(reverseResult.totalCost)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-500 font-bold uppercase">Lucro</p>
                          <p className={`text-sm font-black ${reverseResult.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(reverseResult.profit)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-500 font-bold uppercase">Markup</p>
                          <p className="text-sm font-black text-neutral-800">{reverseResult.markup.toFixed(2)}x</p>
                        </div>
                      </div>
                      {reverseResult.isBelowCost && (
                        <div className="flex items-start gap-2 p-2.5 bg-red-100 rounded-xl">
                          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-700 font-medium">Preço abaixo do custo! Prejuízo de {formatCurrency(Math.abs(reverseResult.profit))} por unidade. Mínimo: {formatCurrency(reverseResult.breakEvenPrice)}.</p>
                        </div>
                      )}
                      <p className={`text-xs ${reverseResult.profitStatus.color} font-medium`}>{reverseResult.profitStatus.description}</p>
                    </div>
                  )}

                  {/* AI button */}
                  {newProduct.manualPrice && newProduct.manualPrice > 0 && newProduct.name && (
                    <button type="button" onClick={handleAnalyzePrice} disabled={aiLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl font-bold hover:from-violet-700 hover:to-purple-800 transition-all disabled:opacity-50 shadow-lg shadow-purple-100">
                      {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analisando...</> : <><Sparkles className="w-4 h-4" /> Analisar Lucro com IA</>}
                    </button>
                  )}
                  {aiAnalysis && (
                    <div className="p-4 bg-violet-50 rounded-2xl border border-violet-100 space-y-2">
                      <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-600" /><span className="text-xs font-bold text-violet-700 uppercase tracking-wider">Análise IA</span></div>
                      <p className="text-sm text-violet-900 leading-relaxed whitespace-pre-line">{aiAnalysis}</p>
                    </div>
                  )}
                </div>

                {/* ── IMAGENS & CATÁLOGO ── */}
                <div className="space-y-4 pt-4 border-t-2 border-neutral-200">
                  <div className="flex items-center gap-2">
                    <Image className="w-4 h-4 text-neutral-700" />
                    <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wider">Imagens & Catálogo</h3>
                  </div>

                  {!editingProduct && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700 font-medium">
                      💡 Salve o produto primeiro para adicionar imagens.
                    </div>
                  )}

                  {editingProduct && (
                    <ProductImageUpload
                      imageUrl={newProduct.imageUrl}
                      thumbnailUrl={newProduct.thumbnailUrl}
                      galleryImages={newProduct.galleryImages || []}
                      onMainImageChange={handleMainImageUpload}
                      onGalleryImageAdd={handleGalleryImageAdd}
                      onMainImageRemove={handleMainImageRemove}
                      onGalleryImageRemove={handleGalleryImageRemove}
                      uploading={imageUploading}
                    />
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Descrição para o Catálogo (opcional)</label>
                    <textarea
                      rows={3}
                      value={newProduct.description || ''}
                      onChange={e => setNewProduct(p => ({ ...p, description: e.target.value || null }))}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm resize-none"
                      placeholder="Descreva o produto para os clientes..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Prazo de Produção (dias)</label>
                      <input
                        type="number" min="0"
                        value={newProduct.leadTimeDays ?? ''}
                        onChange={e => setNewProduct(p => ({ ...p, leadTimeDays: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                        placeholder="Ex: 7"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer mt-5">
                        <input type="checkbox"
                          checked={newProduct.showInCatalog !== false}
                          onChange={e => setNewProduct(p => ({ ...p, showInCatalog: e.target.checked }))}
                          className="w-4 h-4 rounded" />
                        <span className="text-xs font-bold text-neutral-600">Exibir no catálogo</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox"
                          checked={newProduct.showPrice !== false}
                          onChange={e => setNewProduct(p => ({ ...p, showPrice: e.target.checked }))}
                          className="w-4 h-4 rounded" />
                        <span className="text-xs font-bold text-neutral-600">Exibir preço</span>
                      </label>
                    </div>
                  </div>
                </div>

                <button type="submit"
                  className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg">
                  {editingProduct ? 'Atualizar Produto' : 'Cadastrar Produto'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {productToDelete && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 text-red-600">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center"><Trash2 className="w-6 h-6" /></div>
              <h3 className="text-xl font-bold">Excluir Produto?</h3>
            </div>
            <p className="text-neutral-600">Esta ação não pode ser desfeita. Produtos em orçamentos existentes não serão afetados (snapshots preservados).</p>
            <div className="flex gap-3">
              <button onClick={() => setProductToDelete(null)} disabled={isDeleting}
                className="flex-1 px-6 py-3 bg-neutral-100 text-neutral-900 rounded-xl font-bold hover:bg-neutral-200 transition-all disabled:opacity-50">Cancelar</button>
              <button onClick={handleDelete} disabled={isDeleting}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
                {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" />Excluindo...</> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
