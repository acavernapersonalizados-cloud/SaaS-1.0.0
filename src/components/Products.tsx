import React, { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, Material, ProductMaterial, CostBase, FinishingOption, Accessory } from '../types';
import { formatCurrency, formatPercent, roundCents } from '../lib/utils';
import { calcProductPricing, calcReversePrice, getProfitStatus, calcCatalogKPIs, markupOf } from '../lib/pricingEngine';
import { catalogSyncFailureMessage, nextCatalogPrice } from '../lib/catalog';
import { isAppOutdated } from '../lib/appUpdate';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { analyzeManualPrice } from '../services/gemini';
import { uploadProductImage, uploadGalleryImage, deleteImageByUrl } from '../services/imageUpload';
import { ProductCards, ProductChannelTable, ProductTable, SortField } from './ProductList';
import { channelsOf } from '../lib/channels';
import { ProductFormModal } from './ProductFormModal';
import { ProductCatalogSection, ProductPricingSection } from './ProductFormSections';
import { CategoryFilterBar } from './CategoryPicker';
import { useCategories, categoryNames } from '../hooks/useCategories';
import {
  Plus,
  Trash2,
  Box,
  Search,
  PlusCircle,
  X,
  Clock,
  Package,
  Edit2,
  Loader2,
  Sparkles,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  LayoutGrid,
  Table2,
  Columns3,
  ArrowUpDown,
  Filter,
  ArrowRight,
  BarChart3,
  Layers,
  Image,
} from 'lucide-react';

type ViewMode = 'cards' | 'table' | 'channels';
type FilterMode = 'all' | 'no_price' | 'loss' | 'risky' | 'low' | 'good' | 'excellent';

export function Products({
  openProductId,
  onProductOpened,
}: {
  /** Produto a abrir assim que a lista carregar (Etapa 8C, item 4: "Abrir produto" nas calculadoras). */
  openProductId?: string | null;
  onProductOpened?: () => void;
} = {}) {
  const { activeStore } = useStore();
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [costs, setCosts] = useState<CostBase | null>(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const { categories } = useCategories('product');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
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
    name: '',
    category: '',
    categoryIds: [],
    materials: [],
    productionTime: 0,
    packagingCost: 0,
    isPackage: false,
    packageQuantity: 1,
    finishingOptions: [],
    accessories: [],
    manualPrice: null,
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
    if (!activeStore) {
      setLoading(false);
      return;
    }

    const qP = query(collection(db, 'products'), where('storeId', '==', activeStore.id), orderBy('name', 'asc'));
    const unsubP = onSnapshot(
      qP,
      snap => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Product));
        setLoading(false);
      },
      err => {
        handleFirestoreError(err, OperationType.LIST, 'products');
        setLoading(false);
      },
    );

    const qM = query(collection(db, 'materials'), where('storeId', '==', activeStore.id), orderBy('name', 'asc'));
    const unsubM = onSnapshot(
      qM,
      snap => {
        setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Material));
      },
      err => handleFirestoreError(err, OperationType.LIST, 'materials'),
    );

    // CostBase uses storeId as document ID
    const unsubCosts = onSnapshot(
      doc(db, 'costBases', activeStore.id),
      snap => {
        if (snap.exists()) setCosts(snap.data() as CostBase);
        else setCosts(null);
      },
      err => console.warn('costBases:', err),
    );

    return () => {
      unsubP();
      unsubM();
      unsubCosts();
    };
  }, [activeStore]);

  // Mantém o preço público (catalogPrice) sincronizado com os custos atuais.
  // Necessário porque o catálogo público não lê mais custos nem materiais.
  useEffect(() => {
    if (!activeStore || !costs || products.length === 0) return;
    const timer = setTimeout(async () => {
      // Aba com versão antiga (já existe uma publicada): não grava nada até atualizar.
      if (isAppOutdated()) return;
      const writes = products.flatMap(p => {
        // Nunca troca um preço gravado por R$ 0 (ex.: meta de lucro inválida).
        const price = nextCatalogPrice(p.catalogPrice, Number(calcProductPricing(p, materials, costs).effectivePrice));
        return price !== null ? [updateDoc(doc(db, 'products', p.id), { catalogPrice: price })] : [];
      });
      // Falha nunca é silenciosa: um aviso por rodada, com a quantidade e o motivo.
      const failures = (await Promise.allSettled(writes)).flatMap(r => (r.status === 'rejected' ? [r.reason] : []));
      const warning = catalogSyncFailureMessage(failures);
      if (warning) addToast(warning, 'error');
    }, 1500);
    return () => clearTimeout(timer);
  }, [activeStore, products, materials, costs]);

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
    if (!activeStore || !newProduct.name) return;
    try {
      const pricing = calcProductPricing(newProduct as Product, materials, costs);
      const productData = {
        ...newProduct,
        categoryIds: newProduct.categoryIds || [],
        // Mantém o campo antigo preenchido para telas/dados legados
        category: newProduct.category || categoryNames(newProduct.categoryIds, categories).join(', ') || '',
        storeId: activeStore.id,
        // Preço público pré-calculado: o catálogo não precisa mais ler custos.
        // Preço inválido (R$ 0) não apaga o preço que já estava gravado.
        catalogPrice:
          nextCatalogPrice(editingProduct?.catalogPrice, Number(pricing.effectivePrice)) ??
          (Number(editingProduct?.catalogPrice) || 0),
        updatedAt: new Date().toISOString(),
      };
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        addToast('Produto atualizado com sucesso!', 'success');
      } else {
        await addDoc(collection(db, 'products'), { ...productData, createdAt: new Date().toISOString() });
        addToast('Produto cadastrado com sucesso!', 'success');
      }
      resetForm();
    } catch (err) {
      handleFirestoreError(
        err,
        editingProduct ? OperationType.UPDATE : OperationType.CREATE,
        editingProduct ? `products/${editingProduct.id}` : 'products',
      );
    }
  };

  // "Abrir produto" vindo de uma calculadora: abre a janela do produto uma vez, quando ele aparece na lista.
  useEffect(() => {
    if (!openProductId) return;
    const product = products.find(p => p.id === openProductId);
    if (!product) return;
    handleEdit(product);
    onProductOpened?.();
  }, [openProductId, products]);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      ...product,
      categoryIds: product.categoryIds || [],
      finishingOptions: product.finishingOptions || [],
      accessories: product.accessories || [],
      // Em centavos: o campo (step 0,01) recusaria preços gravados com mais casas (ex.: 38,535607…).
      manualPrice: product.manualPrice != null ? roundCents(product.manualPrice) : null,
    });
    setAiAnalysis(product.aiPriceAnalysis || '');
    setReversePriceInput(product.manualPrice ? String(roundCents(product.manualPrice)) : '');
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
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAnalyzePrice = async () => {
    if (!newProduct.manualPrice || !newProduct.name) return;
    const pricing = calcProductPricing(newProduct, materials, costs);
    setAiLoading(true);
    try {
      const analysis = await analyzeManualPrice(
        newProduct.name,
        pricing.totalCost,
        newProduct.manualPrice,
        newProduct.category || categoryNames(newProduct.categoryIds, categories).join(', '),
      );
      setAiAnalysis(analysis || '');
      setNewProduct(p => ({ ...p, aiPriceAnalysis: analysis || '' }));
    } catch {
      setAiAnalysis('Erro ao analisar. Verifique sua conexão.');
    }
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
      await updateDoc(doc(db, 'products', editingProduct.id), {
        imageUrl,
        thumbnailUrl,
        updatedAt: new Date().toISOString(),
      });
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
      await updateDoc(doc(db, 'products', editingProduct.id), {
        imageUrl: null,
        thumbnailUrl: null,
        updatedAt: new Date().toISOString(),
      });
      setNewProduct(p => ({ ...p, imageUrl: null, thumbnailUrl: null }));
      addToast('Imagem removida.', 'success');
    } catch {
      addToast('Erro ao remover imagem.', 'error');
    }
  };

  const handleGalleryImageAdd = async (file: File) => {
    if (!activeStore || !editingProduct) {
      addToast('Salve o produto primeiro para adicionar imagens.', 'error');
      return;
    }
    const currentGallery = newProduct.galleryImages || [];
    if (currentGallery.length >= 6) {
      addToast('Máximo de 6 imagens na galeria.', 'error');
      return;
    }
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
    } catch {
      addToast('Erro ao remover imagem.', 'error');
    }
  };

  const addMaterialToProduct = (materialId: string) => {
    if (!newProduct.materials?.some(m => m.materialId === materialId)) {
      setNewProduct(p => ({ ...p, materials: [...(p.materials || []), { materialId, quantity: 0 }] }));
    }
  };
  const updateMaterialQuantity = (materialId: string, quantity: number) => {
    setNewProduct(p => ({
      ...p,
      materials: (p.materials || []).map(m => (m.materialId === materialId ? { ...m, quantity } : m)),
    }));
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
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // ─── Derived data ────────────────────────────────────────────────────────────
  const filteredMaterialsSearch = materials.filter(
    m =>
      !newProduct.materials?.some(pm => pm.materialId === m.id) &&
      (m.name || '').toLowerCase().includes(materialSearchTerm.toLowerCase()),
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
        (p.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        categoryNames(p.categoryIds, categories).some(n => n.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchSearch) return false;
      // Categoria: mostra o produto se ele estiver em QUALQUER categoria marcada
      if (categoryFilter.length > 0 && !(p.categoryIds || []).some(id => categoryFilter.includes(id))) return false;
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

  const canDelete = isAdmin || user?.role === 'GERENTE';

  // Reverse pricing calc
  const reverseNum = parseFloat(reversePriceInput);
  const modalPricing = calcProductPricing(newProduct, materials, costs);
  const reverseResult =
    !isNaN(reverseNum) && reverseNum > 0 && modalPricing.totalCost > 0
      ? calcReversePrice(reverseNum, modalPricing.totalCost)
      : null;

  if (!activeStore)
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
          <Package className="w-8 h-8 text-neutral-400" />
        </div>
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
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all font-bold shadow-sm"
        >
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
            <input
              type="text"
              placeholder="Buscar produto ou categoria..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
            />
          </div>
          <div className="w-full md:w-auto">
            <CategoryFilterBar scope="product" selected={categoryFilter} onChange={setCategoryFilter} />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2.5 rounded-xl border transition-all ${viewMode === 'cards' ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2.5 rounded-xl border transition-all ${viewMode === 'table' ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}
            >
              <Table2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('channels')}
              title="Preço sugerido por canal"
              className={`p-2.5 rounded-xl border transition-all ${viewMode === 'channels' ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}
            >
              <Columns3 className="w-4 h-4" />
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
              <button
                key={f.id}
                onClick={() => setFilterMode(f.id as FilterMode)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${filterMode === f.id ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-600 hover:border-neutral-400 bg-white'}`}
              >
                {f.label} {f.count > 0 && <span className="ml-1 opacity-60">({f.count})</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <ProductTable
          filteredAndSorted={filteredAndSorted}
          categories={categories}
          canDelete={canDelete}
          handleEdit={handleEdit}
          setProductToDelete={setProductToDelete}
          sortField={sortField}
          handleSort={handleSort}
        />
      )}

      {/* PREÇO POR CANAL (Etapa 8B, item 6) */}
      {viewMode === 'channels' && (
        <ProductChannelTable
          filteredAndSorted={filteredAndSorted}
          channels={channelsOf(costs)}
          markupPct={markupOf(costs)}
          hasCosts={!!costs}
          handleEdit={handleEdit}
        />
      )}

      {/* CARDS VIEW */}
      {viewMode === 'cards' && (
        <ProductCards
          filteredAndSorted={filteredAndSorted}
          categories={categories}
          canDelete={canDelete}
          handleEdit={handleEdit}
          setProductToDelete={setProductToDelete}
          costs={costs}
        />
      )}

      {/* ─── MODAL ─────────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <ProductFormModal
          editingProduct={editingProduct}
          resetForm={resetForm}
          handleAddProduct={handleAddProduct}
          newProduct={newProduct}
          setNewProduct={setNewProduct}
          materials={materials}
          materialSearchTerm={materialSearchTerm}
          setMaterialSearchTerm={setMaterialSearchTerm}
          filteredMaterialsSearch={filteredMaterialsSearch}
          addMaterialToProduct={addMaterialToProduct}
          updateMaterialQuantity={updateMaterialQuantity}
          removeMaterialFromProduct={removeMaterialFromProduct}
          newFinishing={newFinishing}
          setNewFinishing={setNewFinishing}
          addFinishingOption={addFinishingOption}
          removeFinishingOption={removeFinishingOption}
          newAccessory={newAccessory}
          setNewAccessory={setNewAccessory}
          addAccessory={addAccessory}
          removeAccessory={removeAccessory}
          pricingSection={
            <ProductPricingSection
              costs={costs}
              newProduct={newProduct}
              setNewProduct={setNewProduct}
              modalPricing={modalPricing}
              reverseResult={reverseResult}
              setReversePriceInput={setReversePriceInput}
              handleAnalyzePrice={handleAnalyzePrice}
              aiLoading={aiLoading}
              aiAnalysis={aiAnalysis}
            />
          }
          catalogSection={
            <ProductCatalogSection
              editingProduct={editingProduct}
              newProduct={newProduct}
              setNewProduct={setNewProduct}
              handleMainImageUpload={handleMainImageUpload}
              handleGalleryImageAdd={handleGalleryImageAdd}
              handleMainImageRemove={handleMainImageRemove}
              handleGalleryImageRemove={handleGalleryImageRemove}
              imageUploading={imageUploading}
            />
          }
        />
      )}

      {/* Delete modal */}
      {productToDelete && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 text-red-600">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Excluir Produto?</h3>
            </div>
            <p className="text-neutral-600">
              Esta ação não pode ser desfeita. Produtos em orçamentos existentes não serão afetados (snapshots
              preservados).
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setProductToDelete(null)}
                disabled={isDeleting}
                className="flex-1 px-6 py-3 bg-neutral-100 text-neutral-900 rounded-xl font-bold hover:bg-neutral-200 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Confirmar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
