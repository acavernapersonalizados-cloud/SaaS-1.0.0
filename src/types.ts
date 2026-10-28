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
  /** Preço que o catálogo mostra (Etapa 8C). Sem ele, o preço no Pix. */
  catalogPriceDisplay?: CatalogPriceDisplay;
}

/** Pix (o preço base), crédito (Pix ÷ 0,95) ou os dois. */
export type CatalogPriceDisplay = 'pix' | 'credito' | 'ambos';

export interface CostBase {
  id?: string;
  storeId: string;
  fixedCosts: number;
  productiveHours: number;
  /** Legado: meta como margem sobre o preço (17/10 a Etapa 7). Lida só quando não há markupPct. */
  profitGoal: number;
  /** Meta de lucro como markup sobre o custo (0 a 500%). Gravado ao salvar a Base de Custos. */
  markupPct?: number;
  hourlyRate: number;
  /** Tarifa de energia (R$/kWh) para Laser e 3D (Etapa 7.2). Sem ela, vale a padrão (0,79). */
  electricityRate?: number;
  /** Tabela de canais de venda da loja (Etapa 7). Sem ela, vale a padrão de lib/channels.ts. */
  salesChannels?: SalesChannel[];
  /** Faixas de desconto de atacado por quantidade (Etapa 8C). Sem elas, valem as padrão de lib/wholesale.ts. */
  wholesaleTiers?: WholesaleTier[];
}

/** Faixa de atacado: a partir de minQty unidades no item, desconto de discountPct% sobre o varejo. */
export interface WholesaleTier {
  minQty: number;
  discountPct: number;
}

/** Canal de venda da tabela única da loja. */
export interface SalesChannel {
  id: string;
  name: string;
  /** Comissão do canal (% do preço). */
  commissionPct: number;
  /** Taxa fixa por unidade vendida (R$). */
  fixedFee: number;
  /** Taxa de pagamento (% do preço). */
  paymentPct: number;
  note?: string;
  /** Data da última conferência das taxas (AAAA-MM-DD). */
  checkedAt?: string;
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
  /** Custo fixo por unidade de um trabalho de calculadora (Etapa 8C, item 4); soma no custo do produto. */
  jobCostUnit?: number;
  /** Preço sugerido da calculadora no trabalho de origem; é o sugerido do produto (correção de 26/10/2026). */
  jobSuggestedUnit?: number;
  /** Trabalho de calculadora que originou o produto. */
  sourceJob?: { kind: JobKind; id: string };
}

/** Calculadoras cujos trabalhos salvos podem virar produto (Etapa 8C, item 4). */
export type JobKind = 'laser' | 'print3d' | 'papelaria' | 'cestas' | 'sublimacao';

/** Campos gravados no trabalho salvo para ele virar produto sem recalcular (Etapa 8C, item 4). */
export interface JobProductFields {
  /** Custo por unidade mostrado na calculadora ao salvar. */
  totalCostUnit?: number;
  /** Preço por unidade que valia na calculadora ao salvar (o manual ou, sem ele, o sugerido). */
  unitPrice?: number;
  /** Preço sugerido por unidade mostrado na calculadora ao salvar (no canal escolhido). */
  suggestedUnit?: number;
  /** Produto criado a partir deste trabalho. */
  productId?: string | null;
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

export interface LaserJob extends JobProductFields {
  id: string;
  storeId: string;
  name: string;
  /** Canal de venda usado no cálculo (Etapa 7). */
  channel?: string;
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
  /** Estacionamento item 13: material do estoque usado (o custo vem dele) e quanto, no trabalho todo. */
  materialId?: string | null;
  materialQty?: number;
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

export interface PrintJob extends JobProductFields {
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
  /** Legado: margem personalizada (% do preço) de orçamentos anteriores à Etapa 7. */
  customMargin?: number | null;
  /** Markup personalizado (% sobre o custo) do item. */
  customMarkup?: number | null;
  // Snapshots for historical accuracy
  materialCost?: number;
  laborCost?: number;
  productionCost?: number;
  /** Markup sobre o custo usado no preço (Etapa 7 em diante). */
  markup?: number;
  /** Margem (%): até a Etapa 7, a margem pedida; depois, a margem real após a taxa do canal. */
  margin?: number;
  platformFee?: number;
  /** Desconto de atacado (%) aplicado ao preço do item pela quantidade (Etapa 8C). */
  wholesaleDiscountPct?: number;
  /** O desconto passaria do piso (custo × 1,30 + taxas) e o preço ficou no piso. */
  wholesaleFloorApplied?: boolean;
  /**
   * Estacionamento item 18 (28/10/2026): preço manual por unidade, no Pix (o crédito continua Pix ÷ 0,95). É o preço
   * final: sem desconto de atacado e sem somar acabamentos e acessórios. Sem ele, o preço é o calculado.
   */
  manualUnitPrice?: number | null;
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
  /** Total no Pix (o preço base). */
  totalAmount: number;
  /** Total no crédito = Pix ÷ 0,95 (Etapa 8C). Orçamentos anteriores não têm. */
  creditTotal?: number;
  totalProfit: number;
  avgMargin: number;
  channel: string;
  platformFee: number;
  /** Taxa fixa do canal por unidade (R$), da tabela de canais (Etapa 7). */
  channelFixedFee?: number;
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

export interface PapelariaJob extends JobProductFields {
  id: string;
  storeId: string;
  name: string;
  /** Canal de venda usado no cálculo (Etapa 7). */
  channel?: string;
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

export interface CestaJob extends JobProductFields {
  id: string;
  storeId: string;
  name: string;
  /** Canal de venda usado no cálculo (Etapa 7). */
  channel?: string;
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
