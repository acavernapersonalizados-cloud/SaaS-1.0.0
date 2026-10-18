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

console.log(
  `[seed] Emulador pronto. Entre com ${TEST_ADMIN.email} / ${TEST_ADMIN.password} (ADMIN, "Loja Teste", com a impressora "TESTE 3D" e o laser "TESTE Laser").`,
);
