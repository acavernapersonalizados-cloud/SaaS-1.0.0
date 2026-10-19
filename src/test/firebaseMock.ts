// Substitui src/firebase.ts nos testes de tela: nenhum app Firebase é criado.
export const USE_EMULATOR = false;
export const EMULATOR_PROJECT_ID = 'demo-precificaatelie';
export const db = {};
export const auth = { currentUser: { uid: 'admin-uid', email: 'admin@teste.local' } };
export const storage = {};
export const firebaseConfig = {};
export const onAuthStateChanged = () => () => {};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError() {}
export function notifyError() {}
