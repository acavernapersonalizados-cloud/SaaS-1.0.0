import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CatalogPriceDisplay, Product } from '../types';
import { formatCurrency } from '../lib/utils';
import { catalogPriceDisplayOf, catalogPriceLines } from '../lib/catalog';
import { useStore } from '../contexts/StoreContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useCategories, categoryNames } from '../hooks/useCategories';
import { CategoryChips, CategoryFilterBar } from './CategoryPicker';
import {
  ShoppingBag,
  Copy,
  ExternalLink,
  MessageCircle,
  Eye,
  EyeOff,
  Search,
  DollarSign,
  Image as ImageIcon,
  Link2,
  CheckCircle2,
} from 'lucide-react';

export function Catalog() {
  const { activeStore } = useStore();
  const { addToast } = useToast();
  const { isAdmin, isGerente } = useAuth();
  const { categories } = useCategories('product');
  // Etapa 8C: preço que o catálogo mostra (Pix, crédito = Pix ÷ 0,95, ou os dois). Fica no documento da loja,
  // o único que o catálogo público lê; a regra do banco deixa só gerente ou administrador alterar.
  const [priceDisplay, setPriceDisplay] = useState<CatalogPriceDisplay>(catalogPriceDisplayOf(activeStore));
  useEffect(() => setPriceDisplay(catalogPriceDisplayOf(activeStore)), [activeStore]);
  const canEditDisplay = isAdmin || isGerente;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCats, setFilterCats] = useState<string[]>([]);
  const [onlyVisible, setOnlyVisible] = useState(false);

  useEffect(() => {
    if (!activeStore) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, 'products'), where('storeId', '==', activeStore.id)),
      snap => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Product));
        setLoading(false);
      },
      err => {
        handleFirestoreError(err, OperationType.LIST, 'products');
        setLoading(false);
      },
    );
    return () => unsub();
  }, [activeStore]);

  const savePriceDisplay = async (display: CatalogPriceDisplay) => {
    if (!activeStore || display === priceDisplay) return;
    try {
      await updateDoc(doc(db, 'stores', activeStore.id), { catalogPriceDisplay: display });
      setPriceDisplay(display);
      addToast('Preço do catálogo atualizado.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `stores/${activeStore.id}`);
    }
  };

  const publicUrl = activeStore ? `${window.location.origin}/catalogo/${activeStore.id}` : '';

  const toggleField = async (p: Product, field: 'showInCatalog' | 'showPrice', value: boolean) => {
    try {
      await updateDoc(doc(db, 'products', p.id), { [field]: value });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${p.id}`);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      addToast('Link do catálogo copiado!', 'success');
    } catch {
      addToast('Não foi possível copiar. Copie manualmente.', 'error');
    }
  };

  const whatsappShare = () => {
    const msg = `Confira o catálogo de ${activeStore?.fantasyName || activeStore?.name}: ${publicUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const filtered = useMemo(
    () =>
      products
        .filter(p => {
          const term = search.toLowerCase();
          const matchSearch =
            !term ||
            (p.name || '').toLowerCase().includes(term) ||
            (p.category || '').toLowerCase().includes(term) ||
            categoryNames(p.categoryIds, categories).some(n => n.toLowerCase().includes(term));
          const matchCats = filterCats.length === 0 || filterCats.some(id => (p.categoryIds || []).includes(id));
          const matchVisible = !onlyVisible || p.showInCatalog !== false;
          return matchSearch && matchCats && matchVisible;
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [products, search, filterCats, onlyVisible, categories],
  );

  const visibleCount = products.filter(p => p.showInCatalog !== false).length;
  const withImage = products.filter(p => p.imageUrl || (p.galleryImages || []).length > 0).length;
  const withoutPrice = products.filter(p => !(Number(p.catalogPrice) > 0)).length;

  if (!activeStore)
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
          <ShoppingBag className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Selecione uma loja</h2>
      </div>
    );

  if (loading) return <div className="animate-pulse h-96 bg-neutral-200 rounded-2xl" />;

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2 text-neutral-400 mb-1">
          <ShoppingBag className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Vitrine</span>
        </div>
        <h1 className="text-3xl font-black text-neutral-900">Catálogo</h1>
        <p className="text-neutral-500 mt-1">
          Escolha o que aparece para seus clientes e compartilhe o link do catálogo.
        </p>
      </header>

      {/* Link público */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 uppercase tracking-wider">
          <Link2 className="w-3.5 h-3.5" /> Link público do catálogo
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            readOnly
            value={publicUrl}
            onFocus={e => e.currentTarget.select()}
            className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={copyLink}
              className="flex items-center gap-2 px-4 py-3 bg-neutral-900 text-white rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all"
            >
              <Copy className="w-4 h-4" /> Copiar
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 border border-neutral-200 text-neutral-700 rounded-xl font-bold text-sm hover:bg-neutral-50 transition-all"
            >
              <ExternalLink className="w-4 h-4" /> Abrir
            </a>
            <button
              onClick={whatsappShare}
              className="flex items-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-400 transition-all"
            >
              <MessageCircle className="w-4 h-4" /> Enviar
            </button>
          </div>
        </div>
      </div>

      {/* Preço no catálogo (Etapa 8C) */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 uppercase tracking-wider">
          <DollarSign className="w-3.5 h-3.5" /> Preço no catálogo
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['pix', 'No Pix'],
              ['credito', 'No crédito'],
              ['ambos', 'Os dois'],
            ] as Array<[CatalogPriceDisplay, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={!canEditDisplay}
              onClick={() => savePriceDisplay(value)}
              className={
                priceDisplay === value
                  ? 'px-4 py-2 rounded-xl text-sm font-bold bg-neutral-900 text-white disabled:opacity-60'
                  : 'px-4 py-2 rounded-xl text-sm font-bold bg-neutral-100 text-neutral-600 hover:bg-neutral-200 disabled:opacity-60'
              }
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-neutral-400">
          O preço calculado é o do Pix. No crédito, o catálogo mostra Pix ÷ 0,95, para cobrir os 5% do cartão.
          {!canEditDisplay && ' Só gerente ou administrador altera esta opção.'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'No catálogo', value: `${visibleCount}/${products.length}`, icon: Eye, color: 'text-neutral-900' },
          { label: 'Com foto', value: `${withImage}`, icon: ImageIcon, color: 'text-blue-600' },
          { label: 'Sem preço', value: `${withoutPrice}`, icon: DollarSign, color: 'text-amber-600' },
          { label: 'Categorias', value: `${categories.length}`, icon: CheckCircle2, color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm">
            <div className="flex items-center gap-2 text-neutral-400">
              <s.icon className="w-3.5 h-3.5" />
              <p className="text-[10px] font-bold uppercase tracking-wider">{s.label}</p>
            </div>
            <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar produto ou categoria..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={onlyVisible}
              onChange={e => setOnlyVisible(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-xs font-bold text-neutral-600">Mostrar só o que está no catálogo</span>
          </label>
        </div>

        <CategoryFilterBar scope="product" selected={filterCats} onChange={setFilterCats} />

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-neutral-400 italic text-sm">Nenhum produto encontrado.</p>
        ) : (
          <div className="divide-y divide-neutral-50">
            {filtered.map(p => {
              const price = Number(p.catalogPrice) || 0;
              const img = p.thumbnailUrl || p.imageUrl || (p.galleryImages || [])[0];
              const inCatalog = p.showInCatalog !== false;
              return (
                <div key={p.id} className="py-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-neutral-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {img ? (
                      <img src={img} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-neutral-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-bold text-neutral-900 truncate">{p.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.category && (
                        <span className="text-[10px] px-2 py-0.5 bg-neutral-900 text-white rounded-full font-bold">
                          {p.category}
                        </span>
                      )}
                      <CategoryChips names={categoryNames(p.categoryIds, categories)} />
                    </div>
                    <p className="text-xs font-bold text-neutral-500">
                      {price > 0
                        ? catalogPriceLines(price, priceDisplay)
                            .map(l => `${formatCurrency(l.value)} ${l.label}`)
                            .join(' · ')
                        : 'Sem preço calculado'}
                      {p.showPrice === false && price > 0 ? ' · preço oculto' : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleField(p, 'showInCatalog', !inCatalog)}
                      title={inCatalog ? 'Remover do catálogo' : 'Exibir no catálogo'}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        inCatalog
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                      }`}
                    >
                      {inCatalog ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {inCatalog ? 'Visível' : 'Oculto'}
                    </button>
                    <button
                      onClick={() => toggleField(p, 'showPrice', p.showPrice === false)}
                      title="Exibir ou ocultar o preço"
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        p.showPrice !== false
                          ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      {p.showPrice !== false ? 'Preço' : 'Sob consulta'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 text-xs text-amber-700 leading-relaxed">
        O preço exibido no catálogo é calculado automaticamente a partir dos custos do produto. Fotos, descrição e prazo
        são editados na tela de Produtos.
      </div>
    </div>
  );
}
