// Substitui StoreContext, AuthContext e ToastContext nos testes de tela:
// um ADMIN aprovado, com a "Loja Teste" ativa. Os avisos (toasts) não aparecem.
import { fixtures } from './fixtures';

const store = fixtures.stores[0];
const admin = fixtures.users[0];

export const useStore = () => ({
  stores: fixtures.stores,
  activeStore: store,
  setActiveStore: () => {},
  loading: false,
});

export const useAuth = () => ({
  user: admin,
  firebaseUser: { uid: admin.id, email: admin.email },
  loading: false,
  logout: async () => {},
  isAdmin: true,
  isGerente: false,
  isOperador: false,
  status: 'aprovado' as const,
});

export const useToast = () => ({ addToast: () => {} });
