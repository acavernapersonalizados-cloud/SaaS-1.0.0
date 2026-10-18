import React, { Suspense, lazy, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { StoreProvider, useStore } from './contexts/StoreContext';
import { ToastProvider } from './contexts/ToastContext';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { Loader2, AlertCircle } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';

// ── Carregamento sob demanda: cada tela vira um chunk separado ──────────────
// O Dashboard também: assim a tela de login não baixa os gráficos.
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const CostBaseSettings = lazy(() => import('./components/CostBase').then(m => ({ default: m.CostBaseSettings })));
const Materials = lazy(() => import('./components/Materials').then(m => ({ default: m.Materials })));
const Inventory = lazy(() => import('./components/Inventory').then(m => ({ default: m.Inventory })));
const Products = lazy(() => import('./components/Products').then(m => ({ default: m.Products })));
const Pricing = lazy(() => import('./components/Pricing').then(m => ({ default: m.Pricing })));
const History = lazy(() => import('./components/History').then(m => ({ default: m.History })));
const Clients = lazy(() => import('./components/Clients').then(m => ({ default: m.Clients })));
const Suppliers = lazy(() => import('./components/Suppliers').then(m => ({ default: m.Suppliers })));
const Stores = lazy(() => import('./components/Stores').then(m => ({ default: m.Stores })));
const Users = lazy(() => import('./components/Users').then(m => ({ default: m.Users })));
const Backup = lazy(() => import('./components/Backup').then(m => ({ default: m.Backup })));
const LaserCalculator = lazy(() => import('./components/LaserCalculator').then(m => ({ default: m.LaserCalculator })));
const PrintCalculator = lazy(() => import('./components/PrintCalculator').then(m => ({ default: m.PrintCalculator })));
const PurchaseList = lazy(() => import('./components/PurchaseList').then(m => ({ default: m.PurchaseList })));
const ProductionPanel = lazy(() => import('./components/ProductionPanel').then(m => ({ default: m.ProductionPanel })));
const PapelariaCalculator = lazy(() =>
  import('./components/PapelariaCalculator').then(m => ({ default: m.PapelariaCalculator })),
);
const CestaCalculator = lazy(() => import('./components/CestaCalculator').then(m => ({ default: m.CestaCalculator })));
const Categories = lazy(() => import('./components/Categories').then(m => ({ default: m.Categories })));
const Catalog = lazy(() => import('./components/Catalog').then(m => ({ default: m.Catalog })));
const PublicCatalog = lazy(() => import('./components/PublicCatalog').then(m => ({ default: m.PublicCatalog })));

// ── Public catalog: no auth needed ──────────────────────────────────────────
function getCatalogRoute(): string | null {
  const path = window.location.pathname;
  const match = path.match(/^\/catalogo\/([^/?]+)/);
  if (match) return match[1];
  const params = new URLSearchParams(window.location.search);
  return params.get('catalog');
}

function ScreenLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
    </div>
  );
}

function AppContent() {
  const { user, loading: authLoading, isAdmin, isGerente } = useAuth();
  const { loading: storeLoading } = useStore();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (authLoading || storeLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'clients':
        return <Clients />;
      case 'suppliers':
        return <Suppliers />;
      case 'costs':
        return <CostBaseSettings />;
      case 'materials':
        return <Materials />;
      case 'inventory':
        return <Inventory />;
      case 'products':
        return <Products />;
      case 'categories':
        return <Categories />;
      case 'catalog':
        return <Catalog />;
      case 'pricing':
        return <Pricing />;
      case 'history':
        return <History />;
      case 'laser':
        return <LaserCalculator />;
      case 'print3d':
        return <PrintCalculator />;
      case 'purchases':
        return <PurchaseList />;
      case 'production':
        return <ProductionPanel />;
      case 'papelaria':
        return <PapelariaCalculator />;
      case 'cestas':
        return <CestaCalculator />;
      case 'stores':
        return isAdmin ? <Stores /> : <AccessDenied />;
      case 'users':
        return isAdmin || isGerente ? <Users /> : <AccessDenied />;
      case 'backup':
        return isAdmin ? <Backup /> : <AccessDenied />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {/* ErrorBoundary por tela: um erro numa aba não derruba o app inteiro */}
      <ErrorBoundary key={activeTab}>
        <Suspense fallback={<ScreenLoader />}>{renderContent()}</Suspense>
      </ErrorBoundary>
    </Layout>
  );
}

function AccessDenied() {
  return (
    <div className="p-10 text-center space-y-4">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
      <h2 className="text-xl font-bold">Acesso Negado</h2>
      <p className="text-neutral-500">Você não tem permissão para acessar esta área.</p>
    </div>
  );
}

export default function App() {
  // Check for public catalog route before rendering auth stack
  const catalogStoreId = getCatalogRoute();
  if (catalogStoreId) {
    return (
      <ToastProvider>
        <ErrorBoundary>
          <Suspense fallback={<ScreenLoader />}>
            <PublicCatalog storeId={catalogStoreId} />
          </Suspense>
        </ErrorBoundary>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <ErrorBoundary>
        <AuthProvider>
          <StoreProvider>
            <AppContent />
          </StoreProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ToastProvider>
  );
}
