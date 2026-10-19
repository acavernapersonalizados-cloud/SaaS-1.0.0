// Cria os dados de teste no Firebase Emulator (NUNCA no banco real).
//
// Uso: roda sozinho dentro do `npm run dev`. Pode ser rodado de novo sem
// duplicar nada (cada documento tem um id fixo).
//
// Usuário de teste (só existe no emulador):
//   e-mail: admin@teste.local
//   senha:  Teste@123
//   cargo:  ADMIN, aprovado, com acesso à "Loja Teste"

const PROJECT_ID = 'demo-precificaatelie';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const TEST_ADMIN = { email: 'admin@teste.local', password: 'Teste@123', name: 'Admin de Teste' };
const STORE_ID = 'loja-teste';

if (!PROJECT_ID.startsWith('demo-')) {
  throw new Error('Seed recusado: o projeto precisa ser "demo-*" (só emulador).');
}

// Converte um objeto JS no formato de campos da API REST do Firestore.
function toValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number')
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'object') return { mapValue: { fields: toFields(value) } };
  return { stringValue: String(value) };
}
const toFields = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toValue(v)]));

async function call(url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
}

async function ensureAuthUser() {
  const base = `http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts`;
  const payload = JSON.stringify({ ...TEST_ADMIN, returnSecureToken: true });
  const headers = { 'Content-Type': 'application/json' };
  const created = await call(`${base}:signUp?key=demo-api-key`, { method: 'POST', headers, body: payload });
  if (created.ok) return created.body.localId;
  if (created.body?.error?.message !== 'EMAIL_EXISTS') {
    throw new Error('Falha ao criar o usuário de teste: ' + JSON.stringify(created.body));
  }
  const signed = await call(`${base}:signInWithPassword?key=demo-api-key`, { method: 'POST', headers, body: payload });
  if (!signed.ok) throw new Error('Falha ao entrar com o usuário de teste: ' + JSON.stringify(signed.body));
  return signed.body.localId;
}

// "Bearer owner" é aceito só pelo emulador e ignora as regras de segurança.
async function setDoc(path, data) {
  const url = `http://${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const res = await call(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`Falha ao gravar ${path}: ` + JSON.stringify(res.body));
}

// Cria só se ainda não existir: mantém o que foi editado na tela entre um npm run dev e outro.
async function createIfMissing(path, data) {
  const url = `http://${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer owner' } });
  if (res.ok) return false;
  if (res.status !== 404) throw new Error(`Falha ao consultar ${path}: HTTP ${res.status}`);
  await setDoc(path, data);
  return true;
}

const now = new Date().toISOString();
const uid = await ensureAuthUser();

await setDoc(`stores/${STORE_ID}`, {
  name: 'Loja Teste LTDA',
  fantasyName: 'Loja Teste',
  phone: '(11) 99999-9999',
  email: 'loja@teste.local',
  city: 'São Paulo',
  state: 'SP',
});

await setDoc(`users/${uid}`, {
  name: TEST_ADMIN.name,
  email: TEST_ADMIN.email,
  phone: '',
  role: 'ADMIN',
  status: 'aprovado',
  storeIds: [STORE_ID],
  createdAt: now,
});

// Base de custos do CHECKLIST-TESTES.md (seção 5): R$ 3.200 / 160 h → R$ 20/h, meta 50%.
await setDoc(`costBases/${STORE_ID}`, {
  storeId: STORE_ID,
  fixedCosts: 3200,
  productiveHours: 160,
  profitGoal: 50,
  hourlyRate: 20,
});

// Impressora 3D de teste: valores do CHECKLIST-TESTES.md (seção 13).
const PRINTER_ID = 'impressora-teste';
await createIfMissing(`printers/${PRINTER_ID}`, {
  id: PRINTER_ID,
  storeId: STORE_ID,
  label: 'TESTE 3D',
  brand: 'Teste',
  model: 'Emulador',
  powerConsumptionW: 200,
  buildVolumeX: 220,
  buildVolumeY: 220,
  buildVolumeZ: 250,
  maxSpeedMmS: 100,
  hotendReplacementCost: 80,
  hotendLifeH: 500,
  bedReplacementCost: 60,
  bedLifeH: 2000,
  maintenanceCostPerH: 0.1,
  acquisitionCost: 2000,
  lifetimeHours: 5000,
  createdAt: now,
});

// Máquina de laser de teste: valores do CHECKLIST-TESTES.md (seção 12).
const LASER_ID = 'laser-teste';
await createIfMissing(`laserMachines/${LASER_ID}`, {
  id: LASER_ID,
  storeId: STORE_ID,
  label: 'TESTE Laser',
  laserType: 'Diodo',
  powerW: 10,
  powerConsumptionW: 60,
  workAreaW: 400,
  workAreaH: 400,
  maxSpeedMmMin: 10000,
  diodeLifeH: 10000,
  moduleReplacementCost: 400,
  materials: ['MDF 3mm', 'Acrílico 3mm'],
  createdAt: now,
});

// Cliente, fornecedor e orçamentos de teste: abrem as janelas de detalhes (Clientes,
// Fornecedores e Histórico) e alimentam os números do cliente (T1).
await createIfMissing('clients/cliente-teste', {
  storeId: STORE_ID,
  name: 'TESTE Cliente',
  type: 'PJ',
  document: '12.345.678/0001-90',
  phone: '5511999999999',
  email: 'cliente@teste.local',
  city: 'São Paulo',
  state: 'SP',
  address: 'Rua Cliente, 100',
  observations: 'Cliente de teste do emulador',
  totalSpent: 0,
  quoteCount: 0,
  lastPurchase: null,
  createdAt: now,
});

await createIfMissing('suppliers/fornecedor-teste', {
  storeId: STORE_ID,
  name: 'TESTE Fornecedor',
  contactName: 'Maria Teste',
  email: 'fornecedor@teste.local',
  phone: '(11) 97777-6666',
  website: 'https://fornecedor.teste',
  address: 'Rua Fornecedor, 1',
  observations: 'Entrega em 3 dias',
  paymentMethod: 'pix',
  paymentTerms: 'boleto_30',
  createdAt: now,
});

// Produto de teste: permite montar um orçamento em Precificação (janela do orçamento gerado).
await createIfMissing('products/produto-teste', {
  storeId: STORE_ID,
  name: 'TESTE Chaveiro',
  category: 'Presentes',
  categoryIds: [],
  materials: [],
  productionTime: 15,
  packagingCost: 0.75,
  finishingOptions: [{ id: 'verniz', name: 'Verniz', additionalValue: 2 }],
  accessories: [{ id: 'caixinha', name: 'Caixinha', additionalValue: 3 }],
  manualPrice: null,
  catalogPrice: 15,
  showInCatalog: true,
  showPrice: true,
  description: 'Chaveiro de MDF personalizado',
  leadTimeDays: 7,
  createdAt: now,
});

const quoteItem = (id, name, quantity, unitPrice) => ({
  id,
  productId: '',
  productName: name,
  quantity,
  unitPrice,
  totalPrice: quantity * unitPrice,
  basePrice: unitPrice,
  finishingValue: 0,
  accessoriesValue: 0,
  selectedFinishingIds: [],
  selectedAccessoryIds: [],
  finishingNames: [],
  accessoryNames: [],
  margin: 50,
  platformFee: 0,
});
const quoteBase = {
  storeId: STORE_ID,
  createdBy: uid,
  createdByName: TEST_ADMIN.name,
  clientId: 'cliente-teste',
  clientName: 'TESTE Cliente',
  clientType: 'PJ',
  cnpj: '12.345.678/0001-90',
  channel: 'Instagram',
  platformFee: 0,
  avgMargin: 50,
};
await createIfMissing('quotes/orcamento-teste-1', {
  ...quoteBase,
  date: '2026-10-10T12:00:00.000Z',
  expiryDate: '2026-10-17T12:00:00.000Z',
  items: [quoteItem('i1', 'TESTE Chaveiro', 10, 15), quoteItem('i2', 'TESTE Caneca', 2, 40)],
  totalAmount: 230,
  totalProfit: 115,
  status: 'Aprovado',
});
await createIfMissing('quotes/orcamento-teste-2', {
  ...quoteBase,
  date: '2026-10-15T12:00:00.000Z',
  expiryDate: '2026-10-22T12:00:00.000Z',
  items: [quoteItem('i1', 'TESTE Chaveiro', 4, 15)],
  totalAmount: 60,
  totalProfit: 30,
  status: 'Pendente',
});
// Finalizado SEM clientId (nome digitado na Precificação sem escolher da lista): liga pelo nome.
const { clientId: _semClientId, ...quoteSemCliente } = quoteBase;
await createIfMissing('quotes/orcamento-teste-3', {
  ...quoteSemCliente,
  clientName: 'teste cliente',
  date: '2026-10-05T12:00:00.000Z',
  expiryDate: '2026-10-12T12:00:00.000Z',
  items: [quoteItem('i1', 'TESTE Chaveiro', 6, 15)],
  totalAmount: 90,
  totalProfit: 45,
  status: 'Finalizado',
});

console.log(
  `[seed] Emulador pronto. Entre com ${TEST_ADMIN.email} / ${TEST_ADMIN.password} (ADMIN, "Loja Teste", com a impressora "TESTE 3D" e o laser "TESTE Laser").`,
);
