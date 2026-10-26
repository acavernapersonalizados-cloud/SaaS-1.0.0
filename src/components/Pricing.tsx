import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, getDoc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, Material, CostBase, Quote, Client, QuoteItem } from '../types';
import {
  CHANNEL_CHECK_DAYS,
  channelFees,
  channelsOf,
  findChannel,
  staleChannelLabel,
  staleChannels,
} from '../lib/channels';
import { wholesaleTiersOf } from '../lib/wholesale';
import { formatCurrency, formatPercent, cn } from '../lib/utils';
import { calcQuoteItem, creditPrice, MAX_CHANNEL_FEE_PERCENT, MAX_MARKUP_PERCENT } from '../lib/pricingEngine';
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
  Trash2,
} from 'lucide-react';

import { QUOTE_VALIDITY_DAYS } from '../lib/quoteFormat';
import { QuoteClientCard, QuoteItemsCard, QuoteSummary } from './QuoteForm';
import { AddItemModal, GeneratedQuoteModal } from './QuoteModals';

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
  const [channel, setChannel] = useState('Venda Direta');
  const [customMarkup, setCustomMarkup] = useState<number | null>(null);
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
    customMarkup: customMarkup !== null ? customMarkup : undefined,
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

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

    const qP = query(collection(db, 'products'), where('storeId', '==', activeStore.id), orderBy('name', 'asc'));
    const unsubscribeP = onSnapshot(
      qP,
      snapshot => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Product));
        setLoading(false);
      },
      error => {
        handleFirestoreError(error, OperationType.LIST, 'products');
        setLoading(false);
      },
    );

    const qM = query(collection(db, 'materials'), where('storeId', '==', activeStore.id), orderBy('name', 'asc'));
    const unsubscribeM = onSnapshot(
      qM,
      snapshot => {
        setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Material));
      },
      error => {
        handleFirestoreError(error, OperationType.LIST, 'materials');
      },
    );

    const qC = query(collection(db, 'clients'), where('storeId', '==', activeStore.id), orderBy('name', 'asc'));
    const unsubscribeC = onSnapshot(
      qC,
      snapshot => {
        setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Client));
      },
      error => {
        handleFirestoreError(error, OperationType.LIST, 'clients');
      },
    );

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

  // Canais da tabela da loja (Base de Custos); orçamentos guardam o nome do canal.
  const channels = channelsOf(costs);
  const { feePct: channelFeePct, fixedFee: channelFixedFee } = channelFees(findChannel(channels, channel));

  // ── Fonte única de verdade: delega ao pricingEngine ──────────────────────
  const calculateItemCosts = (
    item: Partial<QuoteItem & { selectedFinishingIds: string[]; selectedAccessoryIds: string[] }>,
  ) => {
    const product = products.find(p => p.id === item.productId);
    if (!product || !costs) return null;
    return calcQuoteItem(item, product, materials, costs, channelFeePct, channelFixedFee, wholesaleTiersOf(costs));
  };

  const currentItemResults = calculateItemCosts(currentItem);

  const allItemsResults = quoteItems.map(item => calculateItemCosts(item)).filter(Boolean) as any[];
  const totalAmount = allItemsResults.reduce((acc, r) => acc + r.totalPrice, 0);
  const totalProfit = allItemsResults.reduce((acc, r) => acc + r.itemProfit, 0);
  const totalPlatformFee = allItemsResults.reduce((acc, r) => acc + r.itemPlatformFee, 0);
  const avgMargin = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;

  const handleAddItem = () => {
    if (!currentItemResults || currentItemResults.invalidMargin) return;

    if (editingItemId) {
      // Update existing item
      setQuoteItems(
        quoteItems.map(item =>
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
                customMarkup: customMarkup,
                markup: currentItemResults.markup,
                materialCost: currentItemResults.materialCost,
                laborCost: currentItemResults.laborCost,
                productionCost: currentItemResults.productionCost,
                margin: currentItemResults.margin,
                platformFee: currentItemResults.platformFee,
                wholesaleDiscountPct: currentItemResults.wholesaleDiscountPct,
                wholesaleFloorApplied: currentItemResults.wholesaleFloorApplied,
              }
            : item,
        ),
      );
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
        customMarkup: customMarkup,
        markup: currentItemResults.markup,
        materialCost: currentItemResults.materialCost,
        laborCost: currentItemResults.laborCost,
        productionCost: currentItemResults.productionCost,
        margin: currentItemResults.margin,
        platformFee: currentItemResults.platformFee,
        wholesaleDiscountPct: currentItemResults.wholesaleDiscountPct,
        wholesaleFloorApplied: currentItemResults.wholesaleFloorApplied,
      };

      setQuoteItems([...quoteItems, newItem]);
    }

    // Reset modal states
    setSelectedProductId('');
    setQuantity(1);
    setSelectedFinishes([]);
    setSelectedAccessories([]);
    setCustomMarkup(null);
    setEditingItemId(null);
    setIsAddingItem(false);
  };

  const handleEditItem = (item: QuoteItem) => {
    setSelectedProductId(item.productId);
    setQuantity(item.quantity);
    setSelectedFinishes(item.selectedFinishingIds);
    setSelectedAccessories(item.selectedAccessoryIds);
    setCustomMarkup(item.customMarkup ?? null);
    setEditingItemId(item.id);
    setIsAddingItem(true);
  };

  const handleUpdateItemQuantity = (id: string, delta: number) => {
    setQuoteItems(prev =>
      prev.map(item => {
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
      }),
    );
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
      const analysis = await analyzePriceHealth(
        product.name,
        currentItemResults.itemTotalCost,
        currentItemResults.unitPrice,
        (currentItemResults.itemProfit / currentItemResults.totalPrice) * 100,
      );
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
    const hasInvalidItems = allItemsResults.some(
      r => isNaN(r.totalPrice) || !isFinite(r.totalPrice) || isNaN(r.unitPrice) || !isFinite(r.unitPrice),
    );

    if (hasInvalidItems) {
      setQuoteError('Erro: Um ou mais itens possuem valores inválidos. Verifique os dados.');
      return;
    }

    if (allItemsResults.some(r => r.invalidMargin)) {
      setQuoteError(
        `A taxa do canal chega a ${MAX_CHANNEL_FEE_PERCENT}% em um ou mais itens: não existe preço possível. Troque o canal.`,
      );
      return;
    }

    setIsGenerating(true);

    try {
      const quoteData: any = {
        storeId: activeStore.id,
        date: new Date().toISOString(),
        expiryDate: new Date(Date.now() + QUOTE_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
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
          customMarkup: r.customMarkup,
          markup: r.markup,
          materialCost: r.materialCost,
          laborCost: r.laborCost,
          productionCost: r.productionCost,
          margin: r.margin,
          platformFee: r.platformFee,
          wholesaleDiscountPct: r.wholesaleDiscountPct,
          wholesaleFloorApplied: r.wholesaleFloorApplied,
        })),
        totalAmount: isFinite(totalAmount) ? totalAmount : 0,
        // Etapa 8C: total no crédito (Pix ÷ 0,95), só nos orçamentos novos.
        creditTotal: isFinite(totalAmount) ? creditPrice(totalAmount) : 0,
        totalProfit: isFinite(totalProfit) ? totalProfit : 0,
        avgMargin: isFinite(avgMargin) ? avgMargin : 0,
        channel,
        platformFee: channelFeePct,
        channelFixedFee,
        status: 'Pendente',
        createdBy: user?.id || 'unknown',
        createdByName: user?.name || 'Sistema',
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
        throw new Error(
          'Você não tem permissão para gerar orçamentos nesta loja. Verifique seus acessos com o administrador.',
        );
      }

      const docRef = await addDoc(collection(db, 'quotes'), quoteData);
      setGeneratedQuote({ ...quoteData, id: docRef.id } as Quote);
      setQuoteSuccess('Orçamento criado com sucesso!');
      setShowQuoteModal(true);

      // AI Description (optional, don't block on it)
      try {
        const firstItem = allItemsResults[0];
        const desc = await rewriteDescription({
          productName: firstItem.productName,
          clientName,
          quantity: firstItem.quantity,
        });
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

  // Abre a janela de item em branco (botão "Adicionar Item").
  const handleOpenNewItem = () => {
    setEditingItemId(null);
    setSelectedProductId('');
    setQuantity(1);
    setSelectedFinishes([]);
    setSelectedAccessories([]);
    setCustomMarkup(null);
    setIsAddingItem(true);
  };

  // "Concluir e Novo" na janela do orçamento gerado: fecha e limpa o formulário.
  const handleFinishQuote = () => {
    setShowQuoteModal(false);
    setQuoteItems([]);
    setClientName('');
    setClientSearch('');
    setSelectedClientId('');
    setCnpj('');
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

  if (!costs)
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-neutral-300" />
        <h2 className="text-xl font-bold text-neutral-900">Configure sua Base de Custos primeiro</h2>
        <p className="text-neutral-500 max-w-xs">
          Você precisa definir seus custos fixos e horas produtivas antes de precificar.
        </p>
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
            onChange={e => setChannel(e.target.value)}
            className="px-4 py-3 bg-white border-2 border-neutral-100 rounded-2xl text-sm font-bold text-neutral-700 outline-none focus:border-neutral-900 transition-all shadow-sm"
          >
            {channels.map(c => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Etapa 9A: canais com taxas sem conferência há mais de 60 dias. */}
      {costs && staleChannels(channels).length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            <span className="font-bold">Taxas sem conferência há mais de {CHANNEL_CHECK_DAYS} dias:</span>{' '}
            {staleChannels(channels)
              .map(s => `${s.channel.name} (${staleChannelLabel(s)})`)
              .join(' · ')}
            . Confira na Base de Custos.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Form Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Client Selection */}
          <QuoteClientCard
            clientSearch={clientSearch}
            setClientSearch={setClientSearch}
            setClientName={setClientName}
            showClientList={showClientList}
            setShowClientList={setShowClientList}
            clients={clients}
            handleSelectClient={handleSelectClient}
            clientType={clientType}
            setClientType={setClientType}
            cnpj={cnpj}
            setCnpj={setCnpj}
          />

          {/* Items List */}
          <QuoteItemsCard
            quoteItems={quoteItems}
            calculateItemCosts={calculateItemCosts}
            handleOpenNewItem={handleOpenNewItem}
            handleUpdateItemQuantity={handleUpdateItemQuantity}
            handleEditItem={handleEditItem}
            handleRemoveItem={handleRemoveItem}
          />
        </div>

        {/* Summary Sidebar */}
        <QuoteSummary
          totalAmount={totalAmount}
          quoteItems={quoteItems}
          handleGenerateQuote={handleGenerateQuote}
          isGenerating={isGenerating}
          channelFeePct={channelFeePct}
          channelFixedFee={channelFixedFee}
          quoteError={quoteError}
          quoteSuccess={quoteSuccess}
          avgMargin={avgMargin}
        />
      </div>

      {/* Add Item Modal */}
      {isAddingItem && (
        <AddItemModal
          editingItemId={editingItemId}
          setIsAddingItem={setIsAddingItem}
          products={products}
          selectedProduct={selectedProduct}
          selectedProductId={selectedProductId}
          setSelectedProductId={setSelectedProductId}
          quantity={quantity}
          setQuantity={setQuantity}
          customMarkup={customMarkup}
          setCustomMarkup={setCustomMarkup}
          selectedFinishes={selectedFinishes}
          setSelectedFinishes={setSelectedFinishes}
          selectedAccessories={selectedAccessories}
          setSelectedAccessories={setSelectedAccessories}
          currentItemResults={currentItemResults}
          calculateItemCosts={calculateItemCosts}
          handleAddItem={handleAddItem}
        />
      )}

      {/* Quote Modal */}
      {showQuoteModal && generatedQuote && (
        <GeneratedQuoteModal
          generatedQuote={generatedQuote}
          setShowQuoteModal={setShowQuoteModal}
          activeStore={activeStore}
          addToast={addToast}
          handleFinishQuote={handleFinishQuote}
        />
      )}
    </div>
  );
}
