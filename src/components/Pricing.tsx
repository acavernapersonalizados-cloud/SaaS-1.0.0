import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, getDoc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, Material, CostBase, Channel, CHANNELS, Quote, Client, QuoteItem } from '../types';
import { formatCurrency, formatPercent, cn } from '../lib/utils';
import { calcQuoteItem } from '../lib/pricingEngine';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { analyzePriceHealth, suggestIdealMargin, rewriteDescription } from '../services/gemini';
import { useToast } from '../contexts/ToastContext';
import { 
  Calculator, 
  User, 
  Building2, 
  ShoppingCart, 
  Sparkles, 
  FileText, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  X,
  Search,
  Download,
  Receipt,
  Users,
  ChevronRight,
  Package,
  Plus,
  Trash2
} from 'lucide-react';
import { generateClientPDF, generateInternalPDF, generateInvoicePDF } from '../lib/pdf';

export function Pricing() {
  const { activeStore } = useStore();
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [costs, setCosts] = useState<CostBase | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientType, setClientType] = useState<'PF' | 'PJ'>('PF');
  const [cnpj, setCnpj] = useState('');
  const [channel, setChannel] = useState<Channel>('Venda Direta');
  const [customMargin, setCustomMargin] = useState<number | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientList, setShowClientList] = useState(false);

  // Multiple items state
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  
  // Modal Item State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedFinishes, setSelectedFinishes] = useState<string[]>([]);
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  
  const currentItem = {
    productId: selectedProductId,
    quantity,
    selectedFinishingIds: selectedFinishes,
    selectedAccessoryIds: selectedAccessories,
    customMargin: customMargin !== null ? customMargin : undefined
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Totals calculation
  const totals = quoteItems.reduce((acc, item) => ({
    amount: acc.amount + item.totalPrice,
    profit: acc.profit + (item.totalPrice * (1 - (CHANNELS[channel] || 0) / 100) - item.basePrice),
    count: acc.count + 1
  }), { amount: 0, profit: 0, count: 0 });

  // AI state
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDescription, setAiDescription] = useState('');

  // Quote state
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [generatedQuote, setGeneratedQuote] = useState<Quote | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteSuccess, setQuoteSuccess] = useState('');

  useEffect(() => {
    if (!activeStore) {
      setLoading(false);
      return;
    }

    const qP = query(
      collection(db, 'products'), 
      where('storeId', '==', activeStore.id),
      orderBy('name', 'asc')
    );
    const unsubscribeP = onSnapshot(qP, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setLoading(false);
    });

    const qM = query(
      collection(db, 'materials'), 
      where('storeId', '==', activeStore.id),
      orderBy('name', 'asc')
    );
    const unsubscribeM = onSnapshot(qM, (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'materials');
    });

    const qC = query(
      collection(db, 'clients'), 
      where('storeId', '==', activeStore.id),
      orderBy('name', 'asc')
    );
    const unsubscribeC = onSnapshot(qC, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clients');
    });

    const fetchCosts = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'costBases', activeStore.id));
        if (docSnap.exists()) {
          setCosts(docSnap.data() as CostBase);
        } else {
          setCosts({ fixedCosts: 0, productiveHours: 0, profitGoal: 0, hourlyRate: 0, storeId: activeStore.id });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `costBases/${activeStore.id}`);
      }
    };
    fetchCosts();

    return () => {
      unsubscribeP();
      unsubscribeM();
      unsubscribeC();
    };
  }, [activeStore]);

  // ── Fonte única de verdade: delega ao pricingEngine ──────────────────────
  const calculateItemCosts = (item: Partial<QuoteItem & { selectedFinishingIds: string[]; selectedAccessoryIds: string[] }>) => {
    const product = products.find(p => p.id === item.productId);
    if (!product || !costs) return null;
    const channelFee = Number(CHANNELS[channel]) || 0;
    return calcQuoteItem(item, product, materials, costs, channelFee);
  };

  const currentItemResults = calculateItemCosts(currentItem);

  const allItemsResults = quoteItems.map(item => calculateItemCosts(item)).filter(Boolean) as any[];
  const totalAmount = allItemsResults.reduce((acc, r) => acc + r.totalPrice, 0);
  const totalProfit = allItemsResults.reduce((acc, r) => acc + r.itemProfit, 0);
  const totalPlatformFee = allItemsResults.reduce((acc, r) => acc + r.itemPlatformFee, 0);
  const avgMargin = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;

  const handleAddItem = () => {
    if (!currentItemResults) return;
    
    if (editingItemId) {
      // Update existing item
      setQuoteItems(quoteItems.map(item => 
        item.id === editingItemId 
          ? {
              ...item,
              productId: currentItemResults.productId,
              productName: currentItemResults.productName,
              quantity: currentItemResults.quantity,
              unitPrice: currentItemResults.unitPrice,
              totalPrice: currentItemResults.totalPrice,
              basePrice: currentItemResults.basePrice,
              finishingValue: currentItemResults.finishingValue,
              accessoriesValue: currentItemResults.accessoriesValue,
              selectedFinishingIds: currentItemResults.selectedFinishingIds,
              selectedAccessoryIds: currentItemResults.selectedAccessoryIds,
              finishingNames: currentItemResults.finishingNames,
              accessoryNames: currentItemResults.accessoryNames,
              customMargin: customMargin,
              materialCost: currentItemResults.materialCost,
              laborCost: currentItemResults.laborCost,
              productionCost: currentItemResults.productionCost,
              margin: currentItemResults.margin,
              platformFee: currentItemResults.platformFee,
            }
          : item
      ));
    } else {
      // Create a proper QuoteItem with an ID
      const newItem: QuoteItem = {
        id: Math.random().toString(36).substr(2, 9),
        productId: currentItemResults.productId,
        productName: currentItemResults.productName,
        quantity: currentItemResults.quantity,
        unitPrice: currentItemResults.unitPrice,
        totalPrice: currentItemResults.totalPrice,
        basePrice: currentItemResults.basePrice,
        finishingValue: currentItemResults.finishingValue,
        accessoriesValue: currentItemResults.accessoriesValue,
        selectedFinishingIds: currentItemResults.selectedFinishingIds,
        selectedAccessoryIds: currentItemResults.selectedAccessoryIds,
        finishingNames: currentItemResults.finishingNames,
        accessoryNames: currentItemResults.accessoryNames,
        customMargin: customMargin,
        materialCost: currentItemResults.materialCost,
        laborCost: currentItemResults.laborCost,
        productionCost: currentItemResults.productionCost,
        margin: currentItemResults.margin,
        platformFee: currentItemResults.platformFee,
      };

      setQuoteItems([...quoteItems, newItem]);
    }
    
    // Reset modal states
    setSelectedProductId('');
    setQuantity(1);
    setSelectedFinishes([]);
    setSelectedAccessories([]);
    setCustomMargin(null);
    setEditingItemId(null);
    setIsAddingItem(false);
  };

  const handleEditItem = (item: QuoteItem) => {
    setSelectedProductId(item.productId);
    setQuantity(item.quantity);
    setSelectedFinishes(item.selectedFinishingIds);
    setSelectedAccessories(item.selectedAccessoryIds);
    setCustomMargin(item.customMargin ?? null);
    setEditingItemId(item.id);
    setIsAddingItem(true);
  };

  const handleUpdateItemQuantity = (id: string, delta: number) => {
    setQuoteItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(1, item.quantity + delta);
        const results = calculateItemCosts({ ...item, quantity: newQuantity });
        if (results) {
          return {
            ...item,
            quantity: newQuantity,
            unitPrice: results.unitPrice,
            totalPrice: results.totalPrice,
          };
        }
      }
      return item;
    }));
  };

  const handleRemoveItem = (index: number) => {
    setQuoteItems(quoteItems.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (!currentItemResults) return;
    const product = products.find(p => p.id === currentItem.productId);
    if (!product) return;
    
    setAiLoading(true);
    try {
      const analysis = await analyzePriceHealth(product.name, currentItemResults.itemTotalCost, currentItemResults.unitPrice, (currentItemResults.itemProfit / currentItemResults.totalPrice) * 100);
      setAiAnalysis(analysis || '');
    } catch (e) {
      setAiAnalysis('Erro ao analisar preço.');
    }
    setAiLoading(false);
  };

  const handleSuggestMargin = async () => {
    const product = products.find(p => p.id === currentItem.productId);
    if (!product) return;
    
    setAiLoading(true);
    try {
      const suggestion = await suggestIdealMargin(product.category, product.productionTime);
      setAiAnalysis(suggestion || '');
    } catch (e) {
      setAiAnalysis('Erro ao sugerir margem.');
    }
    setAiLoading(false);
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClientId(client.id);
    setClientName(client.name);
    setClientType(client.type);
    if (client.type === 'PJ') setCnpj(client.document);
    setClientSearch(client.name);
    setShowClientList(false);
  };

  const handleGenerateQuote = async () => {
    if (isGenerating) return;
    
    setQuoteError('');
    setQuoteSuccess('');

    if (!activeStore) {
      setQuoteError('Nenhuma loja ativa selecionada.');
      return;
    }

    if (quoteItems.length === 0) {
      setQuoteError('Adicione pelo menos um item ao orçamento.');
      return;
    }

    if (!clientName.trim()) {
      setQuoteError('O nome do cliente é obrigatório.');
      return;
    }

    // Validate all items for NaN
    const hasInvalidItems = allItemsResults.some(r => 
      isNaN(r.totalPrice) || !isFinite(r.totalPrice) || 
      isNaN(r.unitPrice) || !isFinite(r.unitPrice)
    );

    if (hasInvalidItems) {
      setQuoteError('Erro: Um ou mais itens possuem valores inválidos. Verifique os dados.');
      return;
    }

    setIsGenerating(true);

    try {
      const quoteData: any = {
        storeId: activeStore.id,
        date: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        clientName: clientName.trim(),
        clientType,
        items: allItemsResults.map(r => ({
          id: Math.random().toString(36).substr(2, 9),
          productId: r.productId,
          productName: r.productName,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          totalPrice: r.totalPrice,
          basePrice: r.basePrice,
          finishingValue: r.finishingValue,
          accessoriesValue: r.accessoriesValue,
          selectedFinishingIds: r.selectedFinishingIds,
          selectedAccessoryIds: r.selectedAccessoryIds,
          finishingNames: r.finishingNames,
          accessoryNames: r.accessoryNames,
          customMargin: r.customMargin,
          materialCost: r.materialCost,
          laborCost: r.laborCost,
          productionCost: r.productionCost,
          margin: r.margin,
          platformFee: r.platformFee,
        })),
        totalAmount: isFinite(totalAmount) ? totalAmount : 0,
        totalProfit: isFinite(totalProfit) ? totalProfit : 0,
        avgMargin: isFinite(avgMargin) ? avgMargin : 0,
        channel,
        status: 'Pendente',
        followUpStatus: 'Pendente',
        createdBy: user?.id || 'unknown',
        createdByName: user?.name || 'Sistema'
      };

      if (selectedClientId) {
        quoteData.clientId = selectedClientId;
      }
      
      if (clientType === 'PJ' && cnpj) {
        quoteData.cnpj = cnpj;
      }

      // Permission check
      const hasPermission = isAdmin || (user?.storeIds && user.storeIds.includes(activeStore.id));
      if (!hasPermission) {
        throw new Error('Você não tem permissão para gerar orçamentos nesta loja. Verifique seus acessos com o administrador.');
      }

      const docRef = await addDoc(collection(db, 'quotes'), quoteData);
      setGeneratedQuote({ ...quoteData, id: docRef.id } as Quote);
      setQuoteSuccess('Orçamento criado com sucesso!');
      setShowQuoteModal(true);

      // AI Description (optional, don't block on it)
      try {
        const firstItem = allItemsResults[0];
        const desc = await rewriteDescription({ productName: firstItem.productName, clientName, quantity: firstItem.quantity });
        setAiDescription(desc || '');
      } catch (e) {
        console.warn('AI Description failed:', e);
      }

      // Reset form
      setQuoteItems([]);
      setSelectedClientId('');
      setClientName('');
      setCnpj('');
      setClientSearch('');
    } catch (error: any) {
      console.error('Error generating quote:', error);
      let displayMessage = error.message || 'Erro ao gerar orçamento. Tente novamente.';
      try {
        const parsed = JSON.parse(displayMessage);
        if (parsed.error) {
          if (parsed.error.includes('insufficient permissions')) {
            displayMessage = 'Ação não permitida: Você não tem permissão para salvar orçamentos.';
          } else {
            displayMessage = parsed.error;
          }
        }
      } catch (e) {}
      setQuoteError(displayMessage);
      handleFirestoreError(error, OperationType.CREATE, 'quotes');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!activeStore) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
          <Calculator className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
        <p className="text-neutral-500">Você precisa selecionar uma loja para realizar orçamentos.</p>
      </div>
    );
  }

  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  if (!costs) return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <AlertCircle className="w-12 h-12 text-neutral-300" />
      <h2 className="text-xl font-bold text-neutral-900">Configure sua Base de Custos primeiro</h2>
      <p className="text-neutral-500 max-w-xs">Você precisa definir seus custos fixos e horas produtivas antes de precificar.</p>
    </div>
  );

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-neutral-400">
            <Calculator className="w-5 h-5" />
            <span className="text-sm font-bold uppercase tracking-widest">Calculadora de Orçamentos</span>
          </div>
          <h1 className="text-4xl font-black text-neutral-900 tracking-tight">Novo Orçamento</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}
            className="px-4 py-3 bg-white border-2 border-neutral-100 rounded-2xl text-sm font-bold text-neutral-700 outline-none focus:border-neutral-900 transition-all shadow-sm"
          >
            {Object.keys(CHANNELS).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Form Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Client Selection */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-neutral-100 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">Dados do Cliente</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 relative">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Buscar ou Nome do Cliente</label>
                <div className="relative">
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setClientName(e.target.value);
                      setShowClientList(true);
                    }}
                    onFocus={() => setShowClientList(true)}
                    placeholder="Ex: João Silva ou Empresa ABC"
                    className="w-full px-5 py-4 bg-neutral-50 border-2 border-transparent rounded-2xl text-neutral-900 placeholder-neutral-300 outline-none focus:bg-white focus:border-neutral-900 transition-all"
                  />
                  <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
                </div>

                {showClientList && clientSearch && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-neutral-100 rounded-2xl shadow-2xl max-h-60 overflow-y-auto overflow-x-hidden">
                    {clients
                      .filter(c => (c.name || '').toLowerCase().includes(clientSearch.toLowerCase()))
                      .map(client => (
                        <button
                          key={client.id}
                          onClick={() => handleSelectClient(client)}
                          className="w-full px-5 py-4 text-left hover:bg-neutral-50 flex items-center justify-between group transition-colors"
                        >
                          <div>
                            <p className="font-bold text-neutral-900 group-hover:text-black">{client.name}</p>
                            <p className="text-xs text-neutral-400">{client.type} • {client.document || 'Sem documento'}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-neutral-200 group-hover:text-neutral-400 transition-all" />
                        </button>
                      ))}
                    {clients.filter(c => (c.name || '').toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                      <div className="px-5 py-4 text-sm text-neutral-400 italic">
                        Nenhum cliente encontrado. Continue digitando para cadastrar novo.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Tipo de Cliente</label>
                <div className="flex bg-neutral-50 p-1 rounded-2xl border-2 border-transparent focus-within:border-neutral-900 transition-all">
                  <button
                    onClick={() => setClientType('PF')}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                      clientType === 'PF' ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                    )}
                  >
                    Pessoa Física
                  </button>
                  <button
                    onClick={() => setClientType('PJ')}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                      clientType === 'PJ' ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                    )}
                  >
                    Pessoa Jurídica
                  </button>
                </div>
              </div>

              {clientType === 'PJ' && (
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">CNPJ (Opcional)</label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="w-full px-5 py-4 bg-neutral-50 border-2 border-transparent rounded-2xl text-neutral-900 placeholder-neutral-300 outline-none focus:bg-white focus:border-neutral-900 transition-all"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Items List */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-neutral-100 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-neutral-900">Itens do Orçamento</h2>
              </div>
              <button
                onClick={() => {
                  setEditingItemId(null);
                  setSelectedProductId('');
                  setQuantity(1);
                  setSelectedFinishes([]);
                  setSelectedAccessories([]);
                  setCustomMargin(null);
                  setIsAddingItem(true);
                }}
                className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar Item
              </button>
            </div>

            <div className="space-y-4">
              {quoteItems.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-neutral-100 rounded-[32px] space-y-3">
                  <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mx-auto">
                    <Package className="w-6 h-6 text-neutral-200" />
                  </div>
                  <p className="text-neutral-400 text-sm font-medium">Nenhum item adicionado ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {quoteItems.map((item, index) => {
                    const results = calculateItemCosts(item);
                    return (
                      <div key={item.id} className="group flex items-center justify-between p-5 bg-neutral-50 rounded-2xl border border-neutral-100 hover:border-neutral-200 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-row sm:flex-col items-center gap-1 bg-white p-1 rounded-xl border border-neutral-100">
                            <button 
                              onClick={() => handleUpdateItemQuantity(item.id, -1)}
                              className="p-1 hover:bg-neutral-50 rounded transition-colors"
                            >
                              <ArrowRight className="w-3 h-3 text-neutral-400 rotate-180" />
                            </button>
                            <div className="w-8 h-8 flex items-center justify-center font-black text-neutral-900 text-sm">
                              {item.quantity}
                            </div>
                            <button 
                              onClick={() => handleUpdateItemQuantity(item.id, 1)}
                              className="p-1 hover:bg-neutral-50 rounded transition-colors"
                            >
                              <Plus className="w-3 h-3 text-neutral-400" />
                            </button>
                          </div>
                          <div>
                            <p className="font-bold text-neutral-900">{results?.productName}</p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                              <span>{formatCurrency(results?.unitPrice || 0)} / un</span>
                              {(results?.finishingValue ?? 0) > 0 && (
                                <span className="px-1.5 py-0.5 bg-neutral-200 rounded text-neutral-600 font-bold">
                                  +{formatCurrency(results?.finishingValue ?? 0)} acab.
                                </span>
                              )}
                              {(results?.accessoriesValue ?? 0) > 0 && (
                                <span className="px-1.5 py-0.5 bg-neutral-200 rounded text-neutral-600 font-bold">
                                  +{formatCurrency(results?.accessoriesValue ?? 0)} aces.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-black text-neutral-900">{formatCurrency(results?.totalPrice || 0)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditItem(item)}
                              className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors"
                            >
                              <FileText className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleRemoveItem(index)}
                              className="p-2 text-neutral-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-neutral-100 space-y-8 sticky top-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">Resumo</h2>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400 font-bold uppercase tracking-wider">Subtotal</span>
                <span className="text-neutral-900 font-black">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400 font-bold uppercase tracking-wider">Itens</span>
                <span className="text-neutral-900 font-black">{quoteItems.length}</span>
              </div>
              <div className="h-px bg-neutral-100" />
              <div className="flex justify-between items-end">
                <span className="text-neutral-400 font-bold uppercase tracking-wider text-xs mb-1">Total Geral</span>
                <span className="text-3xl font-black text-neutral-900">{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleGenerateQuote}
                disabled={loading || quoteItems.length === 0}
                className="w-full py-5 bg-neutral-900 text-white rounded-2xl font-black text-lg hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-neutral-200"
              >
                {loading ? (
                  <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <FileText className="w-6 h-6" />
                    Gerar Orçamento
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-neutral-400 font-bold uppercase tracking-widest">
                Válido por 7 dias • {CHANNELS[channel]}% de acréscimo canal
              </p>
            </div>

            {/* AI Insights in Sidebar */}
            {quoteItems.length > 0 && (
              <div className="pt-8 border-t border-neutral-100 space-y-4">
                <div className="flex items-center gap-2 text-neutral-900">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-widest">Insights IA</span>
                </div>
                <div className="p-4 bg-neutral-50 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase">Saúde do Preço</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                      avgMargin >= 30 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    )}>
                      {avgMargin >= 30 ? 'Excelente' : 'Atenção'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    Margem média de <span className="font-bold text-neutral-900">{formatPercent(avgMargin)}</span>. 
                    {avgMargin < 30 ? ' Considere revisar os custos dos acessórios para melhorar a rentabilidade.' : ' Preço competitivo com ótima margem de lucro.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      {isAddingItem && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center">
                  {editingItemId ? <FileText className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                </div>
                <h2 className="text-xl font-bold text-neutral-900">{editingItemId ? 'Editar Item' : 'Adicionar Item'}</h2>
              </div>
              <button onClick={() => setIsAddingItem(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Produto</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-5 py-4 bg-neutral-50 border-2 border-transparent rounded-2xl text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 transition-all"
                >
                  <option value="">Selecione um produto</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-5 py-4 bg-neutral-50 border-2 border-transparent rounded-2xl text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Margem Personalizada (%)</label>
                  <input
                    type="number"
                    value={customMargin !== null ? customMargin : ''}
                    onChange={(e) => setCustomMargin(e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="Padrão"
                    className="w-full px-5 py-4 bg-neutral-50 border-2 border-transparent rounded-2xl text-neutral-900 outline-none focus:bg-white focus:border-neutral-900 transition-all"
                  />
                </div>
              </div>

              {selectedProduct && selectedProduct.finishingOptions && selectedProduct.finishingOptions.length > 0 && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Acabamentos</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedProduct.finishingOptions.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setSelectedFinishes(prev => 
                            prev.includes(opt.id) ? prev.filter(id => id !== opt.id) : [...prev, opt.id]
                          );
                        }}
                        className={cn(
                          "p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between group",
                          selectedFinishes.includes(opt.id) 
                            ? "border-neutral-900 bg-neutral-900 text-white" 
                            : "border-neutral-100 bg-neutral-50 text-neutral-600 hover:border-neutral-200"
                        )}
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-bold">{opt.name}</p>
                          <p className={cn("text-[10px]", selectedFinishes.includes(opt.id) ? "text-neutral-400" : "text-neutral-400")}>
                            +{formatCurrency(opt.additionalValue)}
                          </p>
                        </div>
                        {selectedFinishes.includes(opt.id) && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedProduct && selectedProduct.accessories && selectedProduct.accessories.length > 0 && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider ml-1">Acessórios</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedProduct.accessories.map(acc => (
                      <button
                        key={acc.id}
                        onClick={() => {
                          setSelectedAccessories(prev => 
                            prev.includes(acc.id) ? prev.filter(id => id !== acc.id) : [...prev, acc.id]
                          );
                        }}
                        className={cn(
                          "p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between group",
                          selectedAccessories.includes(acc.id) 
                            ? "border-neutral-900 bg-neutral-900 text-white" 
                            : "border-neutral-100 bg-neutral-50 text-neutral-600 hover:border-neutral-200"
                        )}
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-bold">{acc.name}</p>
                          <p className={cn("text-[10px]", selectedAccessories.includes(acc.id) ? "text-neutral-400" : "text-neutral-400")}>
                            +{formatCurrency(acc.additionalValue)}
                          </p>
                        </div>
                        {selectedAccessories.includes(acc.id) && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-neutral-100 flex items-center justify-between">
              <div className="text-left">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Total do Item</p>
                <p className="text-2xl font-black text-neutral-900">
                  {formatCurrency(calculateItemCosts({
                    productId: selectedProductId,
                    quantity,
                    selectedFinishingIds: selectedFinishes,
                    selectedAccessoryIds: selectedAccessories,
                    customMargin: customMargin !== null ? customMargin : undefined
                  })?.totalPrice || 0)}
                </p>
              </div>
              <button
                onClick={handleAddItem}
                disabled={!selectedProductId}
                className="px-8 py-4 bg-neutral-900 text-white rounded-2xl font-black hover:bg-black transition-all disabled:opacity-50"
              >
                {editingItemId ? 'Salvar Alterações' : 'Confirmar Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quote Modal */}
      {showQuoteModal && generatedQuote && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl p-10 space-y-10 animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-neutral-900 rounded-2xl flex items-center justify-center text-white font-black text-2xl">Q</div>
                <div>
                  <h2 className="text-3xl font-black text-neutral-900">Orçamento Gerado</h2>
                  <p className="text-sm text-neutral-400 font-bold uppercase tracking-widest mt-1">
                    Válido até {new Date(generatedQuote.expiryDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowQuoteModal(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="md:col-span-2 space-y-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Itens do Orçamento</h3>
                  <div className="border border-neutral-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-neutral-50 border-b border-neutral-100">
                        <tr>
                          <th className="px-5 py-3 text-[10px] font-black text-neutral-400 uppercase">Item</th>
                          <th className="px-5 py-3 text-[10px] font-black text-neutral-400 uppercase text-center">Qtd</th>
                          <th className="px-5 py-3 text-[10px] font-black text-neutral-400 uppercase text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {generatedQuote.items.map((item, i) => (
                          <tr key={i}>
                            <td className="px-5 py-4">
                              <p className="font-bold text-neutral-900 text-sm">{item.productName}</p>
                              <p className="text-[10px] text-neutral-400">Unitário: {formatCurrency(item.unitPrice)}</p>
                            </td>
                            <td className="px-5 py-4 text-center font-bold text-neutral-900 text-sm">{item.quantity}</td>
                            <td className="px-5 py-4 text-right font-black text-neutral-900 text-sm">{formatCurrency(item.totalPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-6 bg-neutral-50 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-neutral-900 mb-2">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Descrição Inteligente</span>
                  </div>
                  <p className="text-sm text-neutral-600 leading-relaxed italic">
                    "{generatedQuote.description || 'Este orçamento foi cuidadosamente calculado para oferecer o melhor custo-benefício para o seu projeto.'}"
                  </p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-neutral-900 p-8 rounded-[32px] text-white space-y-6">
                  <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Resumo Financeiro</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-neutral-400">Total Bruto</span>
                      <span className="font-black text-lg">{formatCurrency(generatedQuote.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-neutral-400">Canal ({generatedQuote.channel})</span>
                      <span className="font-bold">+{formatPercent(CHANNELS[generatedQuote.channel as Channel])}</span>
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="flex justify-between items-end">
                      <span className="text-xs text-neutral-400 mb-1">Total Final</span>
                      <span className="text-3xl font-black text-white">{formatCurrency(generatedQuote.totalAmount)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={async () => {
                      try {
                        generateClientPDF(generatedQuote, activeStore);
                        addToast('PDF do Cliente gerado com sucesso!', 'success');
                      } catch (error) {
                        addToast('Erro ao gerar PDF do Cliente', 'error');
                      }
                    }}
                    className="w-full py-4 bg-neutral-100 text-neutral-900 rounded-2xl font-black text-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Baixar PDF Cliente
                  </button>
                  <button 
                    onClick={async () => {
                      try {
                        generateInternalPDF(generatedQuote, activeStore);
                        addToast('PDF Interno gerado com sucesso!', 'success');
                      } catch (error) {
                        addToast('Erro ao gerar PDF Interno', 'error');
                      }
                    }}
                    className="w-full py-4 bg-neutral-50 text-neutral-400 rounded-2xl font-bold text-xs hover:bg-neutral-100 transition-all flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Relatório Interno
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-8 border-t border-neutral-100">
              <button 
                onClick={() => {
                  setShowQuoteModal(false);
                  setQuoteItems([]);
                  setClientName('');
                  setClientSearch('');
                  setSelectedClientId('');
                  setCnpj('');
                }}
                className="px-10 py-4 bg-neutral-900 text-white rounded-2xl font-black text-lg hover:bg-black transition-all shadow-xl shadow-neutral-200"
              >
                Concluir e Novo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
