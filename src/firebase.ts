import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            as string,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        as string,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         as string,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             as string,
  measurementId:    (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID     as string) || undefined,
};

const app = initializeApp(firebaseConfig);

export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export { firebaseConfig };
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

export { onAuthStateChanged };
export type { User };

// ─── Tipos e helpers de erro (não alterar — usado em todo o sistema) ─────────

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST   = 'list',
  GET    = 'get',
  WRITE  = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId:        string | undefined;
    email:         string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous:   boolean | undefined;
    tenantId:      string | null | undefined;
    providerInfo: {
      providerId:  string;
      displayName: string | null;
      email:       string | null;
      photoUrl:    string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const message = error instanceof Error ? error.message : String(error);
  const isPermissionError =
    message.includes('permission-denied') ||
    message.includes('insufficient permissions');

  const userMessage = isPermissionError
    ? 'Acesso negado. Você não tem permissão para esta ação.'
    : message;

  const errInfo: FirestoreErrorInfo = {
    error: userMessage,
    authInfo: {
      userId:        auth.currentUser?.uid,
      email:         auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous:   auth.currentUser?.isAnonymous,
      tenantId:      auth.currentUser?.tenantId,
      providerInfo:  auth.currentUser?.providerData.map(p => ({
        providerId:  p.providerId,
        displayName: p.displayName,
        email:       p.email,
        photoUrl:    p.photoURL,
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
      })
    );
  }

  // Only throw for imperative operations (create/update/delete/get).
  // For LIST operations called inside onSnapshot listeners, throwing would
  // crash the ErrorBoundary. The event dispatch above handles user notification.
  if (operationType !== OperationType.LIST) {
    throw new Error(JSON.stringify(errInfo));
  }
}
