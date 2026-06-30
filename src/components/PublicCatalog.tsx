import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Product, Store, CostBase, Material } from '../types';
import { calcProductPricing } from '../lib/pricingEngine';
import { formatCurrency } from '../lib/utils';
import {
  MessageCircle, Share2, ShoppingBag, ChevronLeft, ChevronRight,
  X, Clock, Tag, Star, ExternalLink, Search, Filter
} from 'lucide-react';

interface CatalogProps {
  storeId: string;
}

export function PublicCatalog({ storeId }: CatalogProps) {
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [costs, setCosts] = useState<CostBase | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    if (!storeId) { setNotFound(true); setLoading(false); return; }

    const loadStore = async () => {
      try {
        const snap = await getDoc(doc(db, 'stores', storeId));
        if (!snap.exists()) { setNotFound(true); setLoading(false); return; }
        setStore({ id: snap.id, ...snap.data() } as Store);
      } catch { setNotFound(true); setLoading(false); }
    };
    loadStore();

    const unsubP = onSnapshot(
      query(collection(db, 'products'), where('storeId', '==', storeId)),
      snap => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
        setLoading(false);
      },
      () => setLoading(false)
    );

    const unsubM = onSnapshot(
      query(collection(db, 'materials'), where('storeId', '==', storeId)),
      snap => setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material))),
      () => {}
    );

    const unsubC = onSnapshot(doc(db, 'costBases', storeId),
      snap => { if (snap.exists()) setCosts(snap.data() as CostBase); },
      () => {}
    );

    return () => { unsubP(); unsubM(); unsubC(); };
  }, [storeId]);

  const primaryColor = store?.primaryColor || '#171717';
  const secondaryColor = store?.secondaryColor || '#404040';

  // Only show products marked for catalog (showInCatalog defaults to true)
  const catalogProducts = products.filter(p => p.showInCatalog !== false);

  const categories = Array.from(new Set(catalogProducts.map(p => p.category).filter(Boolean)));

  const filtered = catalogProducts.filter(p => {
    const matchSearch = !search ||
      (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = !selectedCategory || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const getWhatsAppUrl = (product?: Product) => {
    const phone = (store?.phone || '').replace(/\D/g, '');
    if (!phone) return '#';
    const msg = product
      ? `Olá! Tenho interesse no produto "${product.name}" do seu catálogo. Poderia me passar mais informações?`
      : `Olá! Gostaria de solicitar um orçamento.`;
    return `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`;
  };

  const handleShare = (product?: Product) => {
    const url = window.location.href;
    const text = product
      ? `Confira "${product.name}" no catálogo de ${store?.fantasyName || store?.name || 'nosso ateliê'}!`
      : `Confira o catálogo de ${store?.fantasyName || store?.name || 'nosso ateliê'}!`;
    if (navigator.share) {
      navigator.share({ title: text, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).catch(() => {});
      alert('Link copiado!');
    }
  };

  const getProductImages = (p: Product): string[] => {
    const imgs: string[] = [];
    if (p.imageUrl) imgs.push(p.imageUrl);
    if (p.galleryImages?.length) imgs.push(...p.galleryImages);
    return imgs;
  };

  const openProduct = (p: Product) => { setSelectedProduct(p); setGalleryIndex(0); };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="w-12 h-12 rounded-full border-4 border-neutral-200 border-t-neutral-900 animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 gap-4 p-6">
      <ShoppingBag className="w-16 h-16 text-neutral-300" />
      <h1 className="text-2xl font-bold text-neutral-900">Catálogo não encontrado</h1>
      <p className="text-neutral-500 text-center">O catálogo que você está procurando não existe ou foi removido.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header style={{ backgroundColor: primaryColor }} className="text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {store?.logo && (
                <img src={store.logo} alt={store.fantasyName || store.name}
                  className="w-14 h-14 rounded-2xl object-cover bg-white/20" />
              )}
              <div>
                <h1 className="text-2xl font-black">{store?.fantasyName || store?.name}</h1>
                {store?.city && <p className="text-white/70 text-sm">{store.city}, {store.state}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {store?.phone && (
                <a href={getWhatsAppUrl()} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-400 text-white rounded-xl font-bold text-sm transition-colors shadow-lg">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
              )}
              <button onClick={() => handleShare()}
                className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl transition-colors">
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search + filters */}
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text" placeholder="Buscar produtos..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 outline-none text-sm"
              style={{ '--tw-ring-color': primaryColor } as any}
            />
          </div>
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              <button onClick={() => setSelectedCategory('')}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors border ${!selectedCategory ? 'text-white border-transparent' : 'text-neutral-600 border-neutral-200 bg-white hover:bg-neutral-50'}`}
                style={!selectedCategory ? { backgroundColor: primaryColor } : {}}>
                Todos
              </button>
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors border ${selectedCategory === cat ? 'text-white border-transparent' : 'text-neutral-600 border-neutral-200 bg-white hover:bg-neutral-50'}`}
                  style={selectedCategory === cat ? { backgroundColor: primaryColor } : {}}>
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {filtered.length === 0 ? (
          <div className="py-24 text-center text-neutral-400 space-y-3">
            <ShoppingBag className="w-12 h-12 mx-auto text-neutral-300" />
            <p className="font-bold text-lg text-neutral-500">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(p => {
              const pricing = calcProductPricing(p, materials, costs);
              const showPrice = p.showPrice !== false;
              const imgs = getProductImages(p);
              return (
                <div key={p.id}
                  onClick={() => openProduct(p)}
                  className="bg-white rounded-2xl border border-neutral-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group">
                  {/* Image */}
                  <div className="aspect-square bg-neutral-100 relative overflow-hidden">
                    {imgs[0] ? (
                      <img src={p.thumbnailUrl || imgs[0]} alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-10 h-10 text-neutral-300" />
                      </div>
                    )}
                    {imgs.length > 1 && (
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/50 rounded text-white text-[10px] font-bold">
                        +{imgs.length - 1}
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{p.category}</span>
                    <p className="font-bold text-neutral-900 text-sm leading-tight line-clamp-2">{p.name}</p>
                    {p.leadTimeDays && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-neutral-400" />
                        <span className="text-[10px] text-neutral-400">{p.leadTimeDays} dias</span>
                      </div>
                    )}
                    {showPrice && pricing.effectivePrice > 0 && (
                      <p className="text-base font-black" style={{ color: primaryColor }}>
                        {formatCurrency(pricing.effectivePrice)}
                        {p.isPackage && p.packageQuantity && (
                          <span className="text-xs font-normal text-neutral-400 ml-1">kit {p.packageQuantity}un</span>
                        )}
                      </p>
                    )}
                    {!showPrice && (
                      <p className="text-xs text-neutral-400 italic">Consulte o preço</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-8 mt-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-neutral-400">
          <p>{store?.fantasyName || store?.name} — Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            {store?.phone && (
              <a href={`tel:${store.phone}`} className="hover:text-neutral-700 transition-colors">{store.phone}</a>
            )}
            {store?.email && (
              <a href={`mailto:${store.email}`} className="hover:text-neutral-700 transition-colors">{store.email}</a>
            )}
          </div>
        </div>
      </footer>

      {/* Product detail modal */}
      {selectedProduct && (() => {
        const p = selectedProduct;
        const pricing = calcProductPricing(p, materials, costs);
        const showPrice = p.showPrice !== false;
        const imgs = getProductImages(p);
        const currentImg = imgs[galleryIndex] || null;
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedProduct(null)}>
            <div
              className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()}>
              {/* Gallery */}
              <div className="relative bg-neutral-100 aspect-video flex-shrink-0">
                {currentImg ? (
                  <img src={currentImg} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="w-16 h-16 text-neutral-300" />
                  </div>
                )}
                <button onClick={() => setSelectedProduct(null)}
                  className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
                {imgs.length > 1 && (
                  <>
                    <button onClick={() => setGalleryIndex(i => (i - 1 + imgs.length) % imgs.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => setGalleryIndex(i => (i + 1) % imgs.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {imgs.map((_, i) => (
                        <button key={i} onClick={() => setGalleryIndex(i)}
                          className={`w-2 h-2 rounded-full transition-all ${i === galleryIndex ? 'bg-white' : 'bg-white/40'}`} />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Content */}
              <div className="overflow-y-auto p-6 space-y-4 flex-1">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">{p.category}</span>
                  <h2 className="text-2xl font-black text-neutral-900 mt-0.5">{p.name}</h2>
                </div>

                {showPrice && pricing.effectivePrice > 0 && (
                  <p className="text-3xl font-black" style={{ color: primaryColor }}>
                    {formatCurrency(pricing.effectivePrice)}
                    {p.isPackage && p.packageQuantity && (
                      <span className="text-base font-normal text-neutral-400 ml-2">kit com {p.packageQuantity} unidades</span>
                    )}
                  </p>
                )}
                {!showPrice && (
                  <p className="text-lg text-neutral-500 italic">Solicite um orçamento</p>
                )}

                {p.leadTimeDays && (
                  <div className="flex items-center gap-2 text-neutral-500">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Prazo estimado: <strong>{p.leadTimeDays} dias úteis</strong></span>
                  </div>
                )}

                {p.description && (
                  <p className="text-neutral-600 text-sm leading-relaxed">{p.description}</p>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3 pt-2">
                  {store?.phone && (
                    <a href={getWhatsAppUrl(p)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3.5 bg-green-500 hover:bg-green-400 text-white rounded-2xl font-bold transition-colors shadow-lg shadow-green-100">
                      <MessageCircle className="w-5 h-5" /> Solicitar pelo WhatsApp
                    </a>
                  )}
                  <button onClick={() => handleShare(p)}
                    className="flex items-center justify-center gap-2 py-3 border-2 border-neutral-200 text-neutral-700 rounded-2xl font-bold hover:bg-neutral-50 transition-colors">
                    <Share2 className="w-4 h-4" /> Compartilhar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
