/* eslint-disable @typescript-eslint/no-explicit-any */
// Firestore falso para os testes de tela (vi.mock('firebase/firestore', ...)).
// Lê dos dados de exemplo (fixtures.ts), aplica where/orderBy e nunca grava nada de verdade.
import { fixtures } from './fixtures';

type Data = Record<string, any>;
type Constraint =
  { kind: 'where'; field: string; op: string; value: any } | { kind: 'orderBy'; field: string; dir: string };

export const collection = (_db: unknown, name: string) => ({ kind: 'collection', name });

export function doc(base: any, ...segments: string[]) {
  if (base?.kind === 'collection') return { kind: 'doc', name: base.name, id: segments[0] ?? 'novo-id' };
  return { kind: 'doc', name: segments[0], id: segments[1] };
}

export const where = (field: string, op: string, value: any): Constraint => ({ kind: 'where', field, op, value });
export const orderBy = (field: string, dir = 'asc'): Constraint => ({ kind: 'orderBy', field, dir });
export const query = (col: { name: string }, ...constraints: Constraint[]) => ({
  kind: 'query',
  name: col.name,
  constraints,
});
export const documentId = () => '__name__';

const fieldOf = (d: Data, field: string) => (field === '__name__' ? d.id : d[field]);

function matches(d: Data, c: Constraint & { kind: 'where' }) {
  const v = fieldOf(d, c.field);
  switch (c.op) {
    case '==':
      return v === c.value;
    case '!=':
      return v !== c.value;
    case 'in':
      return (c.value as any[]).includes(v);
    case 'array-contains':
      return Array.isArray(v) && v.includes(c.value);
    case 'array-contains-any':
      return Array.isArray(v) && v.some(x => (c.value as any[]).includes(x));
    default:
      throw new Error(`firestoreMock: operador não simulado ${c.op}`);
  }
}

function run(q: any): Data[] {
  let docs = [...(fixtures[q.name] ?? [])];
  for (const c of (q.constraints ?? []) as Constraint[]) {
    if (c.kind === 'where') docs = docs.filter(d => matches(d, c));
  }
  for (const c of [...((q.constraints ?? []) as Constraint[])].reverse()) {
    if (c.kind === 'orderBy') {
      const sign = c.dir === 'desc' ? -1 : 1;
      docs.sort((a, b) => {
        const x = fieldOf(a, c.field);
        const y = fieldOf(b, c.field);
        return x === y ? 0 : x > y ? sign : -sign;
      });
    }
  }
  return docs;
}

const docSnap = (d: Data | undefined, ref: any) => ({
  id: d?.id ?? ref.id,
  ref,
  exists: () => Boolean(d),
  data: () => {
    if (!d) return undefined;
    const { id: _id, ...rest } = d;
    return rest;
  },
});

const querySnap = (docs: Data[], name: string) => {
  const list = docs.map(d => docSnap(d, { kind: 'doc', name, id: d.id }));
  return { docs: list, size: list.length, empty: list.length === 0, forEach: (fn: any) => list.forEach(fn) };
};

const findDoc = (ref: any) => (fixtures[ref.name] ?? []).find(d => d.id === ref.id);

export function onSnapshot(target: any, next: (snap: any) => void) {
  next(target.kind === 'doc' ? docSnap(findDoc(target), target) : querySnap(run(target), target.name));
  return () => {};
}

export const getDocs = async (q: any) => querySnap(run(q), q.name);
export const getDoc = async (ref: any) => docSnap(findDoc(ref), ref);
/** Gravações feitas pela tela no teste (nada vai para banco nenhum), para conferir o que seria gravado. */
export const writes: Array<{ op: 'add' | 'set' | 'update'; path: string; data: Data }> = [];
export const addDoc = async (col: any, data?: Data) => {
  writes.push({ op: 'add', path: col.name, data: data ?? {} });
  return { id: 'novo-id', kind: 'doc', name: col.name };
};
export const setDoc = async (ref?: any, data?: Data) => {
  writes.push({ op: 'set', path: `${ref?.name}/${ref?.id}`, data: data ?? {} });
};
export const updateDoc = async (ref?: any, data?: Data) => {
  writes.push({ op: 'update', path: `${ref?.name}/${ref?.id}`, data: data ?? {} });
};
export const deleteDoc = async () => {};
export const serverTimestamp = () => '2026-10-17T15:00:00.000Z';
export const increment = (n: number) => n;
export const arrayUnion = (...v: unknown[]) => v;
export const arrayRemove = (...v: unknown[]) => v;
export const runTransaction = async (_db: unknown, fn: (tx: any) => unknown) =>
  fn({ get: getDoc, set: () => {}, update: () => {}, delete: () => {} });
export const writeBatch = () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: async () => {} });
export const getFirestore = () => ({});
