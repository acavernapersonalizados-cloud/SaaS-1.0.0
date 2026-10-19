export interface Store {
  id: string;
  name: string;
  fantasyName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  address?: string;
  zipCode?: string;
  neighborhood?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  observations?: string;
}

export interface CostBase {
  id?: string;
  storeId: string;
  fixedCosts: number;
  productiveHours: number;
  profitGoal: number;
  hourlyRate: number;
}

// ── Categorias (matéria-prima/estoque e produtos) ───────────────────────────
// Um item pode pertencer a várias categorias (categoryIds).
export type CategoryScope = 'material' | 'product';

export interface Category {
  id: string;
  storeId: string;
  name: string;
  scope: CategoryScope;
  color?: string;
  createdAt: string;
}

export interface Material {
  id: string;
  storeId: string;
  name: string;
  unit: string;
  purchasePrice: number;
  purchaseQuantity: number;
  unitCost: number;
  isPackage?: boolean;
  packageQuantity?: number;
  supplierId?: string;
  createdAt: string;
  updatedAt?: string;
  stockQuantity: number;
  minStockQuantity: number;
  /** Categorias (múltiplas) — ids da coleção `categories` com scope 'material' */
  categoryIds?: string[];
}

export interface ProductMaterial {
  materialId: string;
  quantity: number;
}

export interface FinishingOption {
  id: string;
  name: string;
  description?: string;
  additionalValue: number;
}

export interface Accessory {
  id: string;
  name: string;
  additionalValue: number;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  category: string;
  /** Categorias (múltiplas) — ids da coleção `categories` com scope 'product' */
  categoryIds?: string[];
  materials: ProductMaterial[];
  productionTime: number;
  packagingCost: number;
  isPackage?: boolean;
  packageQuantity?: number;
  finishingOptions?: FinishingOption[];
  accessories?: Accessory[];
  manualPrice?: number | null; // Preço manual definido pelo usuário
  suggestedPrice?: number | null; // Preço sugerido calculado pelo sistema
  aiPriceAnalysis?: string | null; // Análise IA sobre o preço manual
  // Image fields (all optional, backward-compatible — existing docs unaffected)
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  galleryImages?: string[];
  description?: string | null;
  leadTimeDays?: number | null;
  showInCatalog?: boolean;
  /** Preço público pré-calculado (evita expor custos no catálogo público) */
  catalogPrice?: number | null;
  showPrice?: boolean;
}

export interface LaserMachineProfile {
  id: string;
  storeId: string;
  label: string;
  laserType: string; // 'Diodo 450nm', 'CO2', etc.
  powerW: number;
  powerConsumptionW: number;
  workAreaW: number;
  workAreaH: number;
  maxSpeedMmMin: number;
  diodeLifeH: number;
  moduleReplacementCost: number; // BRL
  materials: string[];
  isDefault?: boolean;
  createdAt: string;
}

export interface LaserJob {
  id: string;
  storeId: string;
  name: string;
  machineId: string; // references LaserMachineProfile.id (or legacy LaserMachine string)
  machineName?: string; // snapshot
  material: string;
  /** Legado (T5): não é mais gravado; trabalhos antigos podem ter. */
  widthMm?: number;
  heightMm?: number;
  cuttingTimeMin: number;
  engravingTimeMin: number;
  passes: number;
  materialCost: number;
  quantity: number;
  manualPrice?: number | null;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PrinterProfile {
  id: string;
  storeId: string;
  label: string;
  brand: string;
  model: string;
  powerConsumptionW: number; // watts while printing
  buildVolumeX: number; // mm
  buildVolumeY: number; // mm
  buildVolumeZ: number; // mm
  maxSpeedMmS: number;
  hotendReplacementCost: number; // BRL
  hotendLifeH: number;
  bedReplacementCost: number; // BRL
  bedLifeH: number;
  maintenanceCostPerH: number; // BRL/h for misc wear
  acquisitionCost?: number; // BRL, custo total da impressora
  lifetimeHours?: number; // vida útil estimada da impressora
  isDefault?: boolean;
  createdAt: string;
}

export interface PrintJob {
  id: string;
  storeId: string;
  name: string;
  printerId: string;
  printerName?: string;
  filamentType: string; // PLA, PETG, ABS, TPU, Resina…
  filamentCostPerKg: number; // BRL
  filamentUsedG: number;
  printTimeH: number;
  failureRatePct: number; // 0-100: extra material/time buffer
  quantity: number;
  manualPrice?: number | null;
  notes?: string;
  materialId?: string | null;
  postProcessHours?: number;
  packagingCost?: number;
  extrasCost?: number;
  channelId?: string;
  channelCommissionPercent?: number;
  channelPaymentPercent?: number;
  channelFixedFee?: number;
  logisticsCost?: number;
  suggestedPrice?: number;
  totalCostUnit?: number;
  gcodeFileName?: string | null;
  gcodeSlicer?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface Client {
  id: string;
  storeId: string;
  name: string;
  type: 'PF' | 'PJ';
  document: string; // CPF or CNPJ
  phone: string;
  email: string;
  city: string;
  state: string;
  observations?: string;
  totalSpent?: number;
  lastPurchase?: string;
  quoteCount?: number;
}

export type QuoteStatus = 'Pendente' | 'Aprovado' | 'Em produção' | 'Finalizado';
export type FollowUpStatus = 'Pendente' | 'Realizado' | 'Nenhum';

export interface QuoteItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  basePrice: number;
  finishingValue: number;
  accessoriesValue: number;
  selectedFinishingIds: string[];
  selectedAccessoryIds: string[];
  finishingNames?: string[];
  accessoryNames?: string[];
  customMargin?: number | null;
  // Snapshots for historical accuracy
  materialCost?: number;
  laborCost?: number;
  productionCost?: number;
  margin?: number;
  platformFee?: number;
}

export interface Quote {
  id: string;
  storeId: string;
  createdBy?: string;
  createdByName?: string;
  date: string;
  expiryDate: string;
  clientId?: string; // Linked client
  clientName: string;
  clientType: 'PF' | 'PJ';
  cnpj?: string;
  items: QuoteItem[];
  totalAmount: number;
  totalProfit: number;
  avgMargin: number;
  channel: string;
  platformFee: number;
  status: QuoteStatus;
  /** Legado: não é mais gravado nem lido; orçamentos antigos podem ter o valor. */
  followUpStatus?: FollowUpStatus;
  description?: string;
}

export interface Supplier {
  id: string;
  storeId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  observations?: string;
  createdAt: string;
  paymentMethod?: 'dinheiro' | 'pix' | 'credito' | 'boleto';
  paymentTerms?:
    | 'credito_avista'
    | 'credito_parcelado'
    | 'boleto_30'
    | 'boleto_60'
    | 'boleto_90'
    | 'boleto_30_60'
    | 'boleto_30_60_90';
  /** Legado (T12): saiu da tela; fornecedores antigos podem ter. */
  discount?: number;
}

export type UserRole = 'ADMIN' | 'GERENTE' | 'OPERADOR';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  storeIds: string[]; // Stores the user has access to
  status: 'pendente' | 'aprovado' | 'bloqueado';
  createdAt: string;
}

export type Channel = 'Shopee' | 'Mercado Livre' | 'Instagram' | 'Venda Direta' | 'Atacado';

export const CHANNELS: Record<Channel, number> = {
  Shopee: 20,
  'Mercado Livre': 18,
  Instagram: 0,
  'Venda Direta': 0,
  Atacado: 5,
};

// ── Stock Reservation ──────────────────────────────────────────────────────
export type ReservationStatus = 'active' | 'converted' | 'released';

export interface StockReservation {
  id: string;
  storeId: string;
  quoteId: string;
  clientName: string;
  reservations: Array<{
    materialId: string;
    materialName: string;
    quantity: number;
  }>;
  status: ReservationStatus;
  createdAt: string;
  convertedAt?: string;
  releasedAt?: string;
  reason?: string;
}

// ── Purchase List ──────────────────────────────────────────────────────────
export type PurchaseItemStatus = 'pending' | 'purchased';

export interface PurchaseListItem {
  id: string;
  storeId: string;
  materialId: string;
  materialName: string;
  unit: string;
  currentStock: number;
  minStock: number;
  suggestedQty: number;
  supplierId?: string;
  supplierName?: string;
  lastPricePaid?: number;
  observations?: string;
  status: PurchaseItemStatus;
  /** true quando o item foi incluído manualmente (não veio do estoque baixo) */
  manual?: boolean;
  addedAt: string;
  purchasedAt?: string;
  purchasedQty?: number;
  purchasedPrice?: number;
}

// ── Papelaria Personalizada ─────────────────────────────────────────────────
// Segue o mesmo padrão de LaserJob/PrintJob: job avulso, sem alterar coleções existentes.
export interface PapelariaMaterialItem {
  id: string;
  name: string; // Ex: "Papel Color Plus 180g", "Adesivo Vinil", "Wire-o 1/4"
  unitCost: number; // custo por unidade/folha/metro
  quantity: number;
  /** Quando vem da matéria-prima/estoque */
  materialId?: string | null;
  unit?: string | null;
}

export interface PapelariaJob {
  id: string;
  storeId: string;
  name: string;
  /** Legado (T6): o campo saiu da tela; trabalhos antigos podem ter. */
  printQuantity?: number;
  materials: PapelariaMaterialItem[];
  laminationCost?: number; // BOPP, hot stamping, etc.
  bindingCost?: number; // wire-o, espiral, elástico, cola
  assemblyTimeMin: number;
  finishingTimeMin: number;
  packagingTimeMin: number;
  hourlyRate: number;
  quantity: number; // quantidade de kits/conjuntos finais
  manualPrice?: number | null;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ── Cestas Personalizadas ────────────────────────────────────────────────────
export interface CestaItem {
  id: string;
  name: string; // produto dentro da cesta
  unitCost: number;
  quantity: number;
  supplierName?: string;
  /** Quando vem da matéria-prima/estoque */
  materialId?: string | null;
  unit?: string | null;
}

export interface CestaJob {
  id: string;
  storeId: string;
  name: string;
  items: CestaItem[]; // produtos internos
  packagingCost?: number; // celofane, caixa, palha, papel seda
  ribbonCost?: number; // fitas e laços
  tagCost?: number; // etiqueta/tag
  assemblyTimeMin: number;
  hourlyRate: number;
  deliveryCost?: number; // frete/entrega
  commissionPct?: number; // comissão de vendedor, se houver
  quantity: number; // quantidade de cestas
  manualPrice?: number | null;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}
