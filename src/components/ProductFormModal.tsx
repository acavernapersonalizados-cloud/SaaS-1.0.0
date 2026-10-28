// Janela de cadastro/edição de produto (Etapa 8A). O estado e as gravações ficam em Products.tsx;
// as seções Precificação e Imagens & Catálogo chegam prontas (ProductFormSections.tsx).
import React from 'react';
import { Material, Product } from '../types';
import { formatCurrency } from '../lib/utils';
import { CategoryPicker } from './CategoryPicker';
import { Plus, Search, Trash2, X } from 'lucide-react';

type NewFinishing = { name: string; description: string; additionalValue: number };
type NewAccessory = { name: string; additionalValue: number };

export function ProductFormModal({
  editingProduct,
  resetForm,
  handleAddProduct,
  newProduct,
  setNewProduct,
  materials,
  materialSearchTerm,
  setMaterialSearchTerm,
  filteredMaterialsSearch,
  addMaterialToProduct,
  updateMaterialQuantity,
  removeMaterialFromProduct,
  newFinishing,
  setNewFinishing,
  addFinishingOption,
  removeFinishingOption,
  newAccessory,
  setNewAccessory,
  addAccessory,
  removeAccessory,
  pricingSection,
  kitSection,
  catalogSection,
}: {
  editingProduct: Product | null;
  resetForm: () => void;
  handleAddProduct: (e: React.FormEvent) => void;
  newProduct: Partial<Product>;
  setNewProduct: React.Dispatch<React.SetStateAction<Partial<Product>>>;
  materials: Material[];
  materialSearchTerm: string;
  setMaterialSearchTerm: (value: string) => void;
  filteredMaterialsSearch: Material[];
  addMaterialToProduct: (materialId: string) => void;
  updateMaterialQuantity: (materialId: string, quantity: number) => void;
  removeMaterialFromProduct: (materialId: string) => void;
  newFinishing: NewFinishing;
  setNewFinishing: React.Dispatch<React.SetStateAction<NewFinishing>>;
  addFinishingOption: () => void;
  removeFinishingOption: (id: string) => void;
  newAccessory: NewAccessory;
  setNewAccessory: React.Dispatch<React.SetStateAction<NewAccessory>>;
  addAccessory: () => void;
  removeAccessory: (id: string) => void;
  pricingSection: React.ReactNode;
  catalogSection: React.ReactNode;
  kitSection: React.ReactNode;
}) {
  // Etapa 8C, item 4 (correção de 26/10/2026): produto criado de trabalho de calculadora. Tempo, embalagem e materiais
  // vêm do trabalho, só como informação e baixa de estoque, e ficam travados: o custo é o do trabalho.
  const fromJob = (Number(newProduct.jobCostUnit) || 0) > 0;
  // Estacionamento item 19: no kit, tempo, embalagem e materiais vêm dos produtos do kit (travados como no trabalho).
  const locked = fromJob || !!newProduct.isKit;
  return (
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
                <input
                  type="text"
                  required
                  value={newProduct.name || ''}
                  onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                  placeholder="Ex: Caneca Personalizada"
                />
              </div>
              {/* Estacionamento item 14: categoria só da lista oficial (abaixo); o texto livre saiu. */}
              {!(newProduct.categoryIds || []).length && newProduct.category && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Categoria antiga</span>
                  <p className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
                    "{newProduct.category}" — escolha abaixo uma categoria da lista (ou use "Organizar categorias" na
                    tela Categorias).
                  </p>
                </div>
              )}
            </div>

            <CategoryPicker
              scope="product"
              value={newProduct.categoryIds || []}
              onChange={ids => setNewProduct(p => ({ ...p, categoryIds: ids }))}
            />

            {fromJob && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 space-y-1">
                <p className="font-bold">
                  Vem da calculadora: custo {formatCurrency(Number(newProduct.jobCostUnit) || 0)} por unidade, que já
                  inclui materiais, mão de obra, embalagem e máquina.
                </p>
                <p>
                  Tempo, embalagem e materiais abaixo são só informação (e a baixa de estoque). Para mudar, refaça o
                  trabalho na calculadora e use "Atualizar preço do produto".
                </p>
              </div>
            )}

            {/* Production time + Packaging */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Tempo de Produção (min)
                </label>
                <input
                  type="number"
                  required={!locked}
                  readOnly={locked}
                  value={locked ? (newProduct.productionTime ?? 0) : newProduct.productionTime || ''}
                  onChange={e => setNewProduct(p => ({ ...p, productionTime: Number(e.target.value) }))}
                  className={
                    locked
                      ? 'w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-neutral-500'
                      : 'w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none'
                  }
                  placeholder="Ex: 30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Custo de Embalagem (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required={!locked}
                  readOnly={locked}
                  value={locked ? (newProduct.packagingCost ?? 0) : newProduct.packagingCost || ''}
                  onChange={e => setNewProduct(p => ({ ...p, packagingCost: Number(e.target.value) }))}
                  className={
                    locked
                      ? 'w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none text-neutral-500'
                      : 'w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none'
                  }
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Package */}
            {!newProduct.isKit && (
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newProduct.isPackage || false}
                    onChange={e => setNewProduct(p => ({ ...p, isPackage: e.target.checked }))}
                    className="w-5 h-5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                  />
                  <span className="text-sm font-bold text-neutral-700">
                    Este produto é um pacote (várias unidades do mesmo produto)?
                  </span>
                </label>
                {newProduct.isPackage && (
                  <div className="space-y-1.5 border-t border-neutral-200 pt-3">
                    <label className="text-xs font-bold text-neutral-600">Quantidade de itens no pacote</label>
                    <input
                      type="number"
                      min="2"
                      value={newProduct.packageQuantity || ''}
                      onChange={e => setNewProduct(p => ({ ...p, packageQuantity: Number(e.target.value) }))}
                      className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Kit (Estacionamento item 19) */}
            {kitSection}

            {/* Materials */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Materiais</label>
              {!locked && (
                <>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus-within:ring-2 focus-within:ring-neutral-900">
                    <Search className="text-neutral-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Pesquisar material..."
                      value={materialSearchTerm}
                      onChange={e => setMaterialSearchTerm(e.target.value)}
                      className="bg-transparent border-none outline-none flex-1 text-sm"
                    />
                  </div>
                  <div className="bg-white border border-neutral-200 rounded-xl max-h-40 overflow-y-auto">
                    {filteredMaterialsSearch.length > 0 ? (
                      filteredMaterialsSearch.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            addMaterialToProduct(m.id);
                            setMaterialSearchTerm('');
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 transition-colors border-b border-neutral-50 last:border-0 flex items-center justify-between"
                        >
                          <span className="font-medium text-sm text-neutral-900">{m.name}</span>
                          <span className="text-xs text-neutral-400 font-bold">
                            {m.unit} · {formatCurrency(m.unitCost)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-neutral-400 text-center italic">
                        Nenhum material encontrado.
                      </div>
                    )}
                  </div>
                </>
              )}
              <div className="space-y-2">
                {newProduct.materials?.map(pm => {
                  const mat = materials.find(m => m.id === pm.materialId);
                  const lineCost = (mat?.unitCost || 0) * (pm.quantity || 0);
                  return (
                    <div
                      key={pm.materialId}
                      className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-neutral-900 truncate">{mat?.name}</p>
                        <p className="text-xs text-neutral-400">
                          {mat?.unit} · {formatCurrency(mat?.unitCost || 0)}/un
                        </p>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={pm.quantity || ''}
                        readOnly={locked}
                        onChange={e => updateMaterialQuantity(pm.materialId, Number(e.target.value))}
                        className="w-24 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm text-center font-bold outline-none focus:ring-2 focus:ring-neutral-900"
                        placeholder="Qtd"
                      />
                      {!locked && (
                        <>
                          <span className="text-xs font-bold text-emerald-700 w-16 text-right">
                            {formatCurrency(lineCost)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeMaterialFromProduct(pm.materialId)}
                            className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
                {!newProduct.materials?.length && (
                  <div className="text-center py-5 border-2 border-dashed border-neutral-100 rounded-xl text-neutral-400 text-xs italic">
                    Nenhum material adicionado.
                  </div>
                )}
              </div>
            </div>

            {/* Finishing */}
            <div className="space-y-3 pt-2 border-t border-neutral-100">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Acabamentos (opcional)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Nome"
                  value={newFinishing.name}
                  onChange={e => setNewFinishing(f => ({ ...f, name: e.target.value }))}
                  className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                />
                <input
                  type="number"
                  placeholder="Valor"
                  value={newFinishing.additionalValue || ''}
                  onChange={e => setNewFinishing(f => ({ ...f, additionalValue: Number(e.target.value) }))}
                  className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                />
                <button
                  type="button"
                  onClick={addFinishingOption}
                  className="px-3 py-2 bg-neutral-100 text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-200 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </button>
              </div>
              <div className="space-y-1.5">
                {newProduct.finishingOptions?.map(o => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100"
                  >
                    <div>
                      <p className="text-sm font-bold text-neutral-900">{o.name}</p>
                      <p className="text-xs text-neutral-500">{formatCurrency(o.additionalValue)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFinishingOption(o.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Accessories */}
            <div className="space-y-3 pt-2 border-t border-neutral-100">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Acessórios (opcional)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Nome"
                  value={newAccessory.name}
                  onChange={e => setNewAccessory(a => ({ ...a, name: e.target.value }))}
                  className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                />
                <input
                  type="number"
                  placeholder="Valor"
                  value={newAccessory.additionalValue || ''}
                  onChange={e => setNewAccessory(a => ({ ...a, additionalValue: Number(e.target.value) }))}
                  className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                />
                <button
                  type="button"
                  onClick={addAccessory}
                  className="px-3 py-2 bg-neutral-100 text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-200 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </button>
              </div>
              <div className="space-y-1.5">
                {newProduct.accessories?.map(a => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100"
                  >
                    <div>
                      <p className="text-sm font-bold text-neutral-900">{a.name}</p>
                      <p className="text-xs text-neutral-500">{formatCurrency(a.additionalValue)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAccessory(a.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {pricingSection}

            {catalogSection}

            <div className="sticky -bottom-6 -mx-8 -mb-6 px-8 pb-6 pt-4 bg-white border-t border-neutral-100">
              <button
                type="submit"
                className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg"
              >
                {editingProduct ? 'Atualizar Produto' : 'Cadastrar Produto'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
