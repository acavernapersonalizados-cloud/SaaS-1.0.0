import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { friendlyFirestoreMessage } from './lib/firestoreErrors';

// ─────────────────────────────────────────────────────────────────────────────
// Desenvolvimento (npm run dev) usa SEMPRE o Firebase Emulator, nunca o banco
// real. O projeto "demo-*" é um projeto de demonstração do Firebase que não
// consegue falar com nenhum servidor do Google: se o emulador estiver
// desligado, o app só mostra erro de conexão. O banco real só existe no build
// de produção (npm run build), com as variáveis do .env.
// ─────────────────────────────────────────────────────────────────────────────
export const USE_EMULATOR = import.meta.env.DEV;
export const EMULATOR_PROJECT_ID = 'demo-precificaatelie';
const EMULATOR_HOST = '127.0.0.1';

// ─────────────────────────────────────────────────────────────────────────────
// Firebase — configurado exclusivamente via variáveis de ambiente Vite.
//
// Crie (ou edite) o arquivo .env na raiz do projeto:
//
//   VITE_FIREBASE_API_KEY=...
//   VITE_FIREBASE_AUTH_DOMAIN=...
//   VITE_FIREBASE_PROJECT_ID=...
//   VITE_FIREBASE_STORAGE_BUCKET=...
//   VITE_FIREBASE_MESSAGING_SENDER_ID=...
//   VITE_FIREBASE_APP_ID=...
//   VITE_FIREBASE_MEASUREMENT_ID=...        (opcional)
//
// Para trocar de projeto Firebase, basta alterar o .env — nenhum código-fonte
// precisa ser modificado.
// ─────────────────────────────────────────────────────────────────────────────

const firebaseConfig = USE_EMULATOR
  ? {
      apiKey: 'demo-api-key',
      authDomain: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
      projectId: EMULATOR_PROJECT_ID,
      storageBucket: `${EMULATOR_PROJECT_ID}.appspot.com`,
      messagingSenderId: '000000000000',
      appId: '1:000000000000:web:demo',
      measurementId: undefined,
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
      appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
      measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string) || undefined,
    };

// Validação: se faltar configuração, avisa claramente em vez de quebrar o app
const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'] as const;
const missingConfigKeys = REQUIRED_KEYS.filter(k => !firebaseConfig[k]);

if (missingConfigKeys.length > 0) {
  const msg =
    'Configuração do Firebase incompleta. Faltam as variáveis: ' +
    missingConfigKeys.map(k => 'VITE_FIREBASE_' + k.replace(/([A-Z])/g, '_$1').toUpperCase()).join(', ') +
    '. Crie o arquivo .env a partir do .env.example e reinicie o servidor.';
  console.error('[Firebase] ' + msg);
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const el = document.getElementById('root');
      if (el && !el.childElementCount) {
        el.innerHTML =
          '<div style="font-family:system-ui;padding:32px;max-width:640px;margin:0 auto;color:#171717">' +
          '<h1 style="font-size:20px;font-weight:700;margin-bottom:8px">Configuração ausente</h1>' +
          '<p style="color:#525252">' +
          msg +
          '</p></div>';
      }
    });
  }
}

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

if (USE_EMULATOR) {
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
  connectStorageEmulator(storage, EMULATOR_HOST, 9199);
  console.info(`[Firebase] Modo desenvolvimento: usando o EMULADOR local (projeto ${EMULATOR_PROJECT_ID}).`);
}

export { firebaseConfig };

export { onAuthStateChanged };
export type { User };

// ─── Tipos e helpers de erro (não alterar — usado em todo o sistema) ─────────

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

/**
 * Mostra um aviso na tela (via ToastContext) com o contexto e o motivo do erro, sem lançar exceção.
 * Para falhas que não podem passar em silêncio (ex.: estoque não baixado).
 */
export function notifyError(context: string, error: unknown, type: 'error' | 'warning' = 'error') {
  const message = `${context}: ${friendlyFirestoreMessage(error)}`;
  console.error(`[Firestore] ${message}`, error);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('firestore-error', { detail: { message, type } }));
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const userMessage = friendlyFirestoreMessage(error);
  const isPermissionError = userMessage.startsWith('Acesso negado');

  const errInfo: FirestoreErrorInfo = {
    error: userMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map(p => ({
          providerId: p.providerId,
          displayName: p.displayName,
          email: p.email,
          photoUrl: p.photoURL,
        })) ?? [],
    },
    operationType,
    path,
  };

  console.error(`[Firestore] ${operationType} on ${path}:`, userMessage);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('firestore-error', {
        detail: { message: userMessage, type: isPermissionError ? 'error' : 'warning' },
      }),
    );
  }

  // Only throw for imperative operations (create/update/delete/get).
  // For LIST operations called inside onSnapshot listeners, throwing would
  // crash the ErrorBoundary. The event dispatch above handles user notification.
  if (operationType !== OperationType.LIST) {
    throw new Error(JSON.stringify(errInfo));
  }
}
