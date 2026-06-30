import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { StoreProvider, useStore } from './contexts/StoreContext';
import { ToastProvider } from './contexts/ToastContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { CostBaseSettings } from './components/CostBase';
import { Materials } from './components/Materials';
import { Inventory } from './components/Inventory';
import { Products } from './components/Products';
import { Pricing } from './components/Pricing';
import { History } from './components/History';
import { Clients } from './components/Clients';
import { Suppliers } from './components/Suppliers';
import { Stores } from './components/Stores';
import { Users } from './components/Users';
import { Login } from './components/Login';
import { Backup } from './components/Backup';
import { LaserCalculator } from './components/LaserCalculator';
import { PrintCalculator } from './components/PrintCalculator';
import { PurchaseList } from './components/PurchaseList';
import { ProductionPanel } from './components/ProductionPanel';
import { PublicCatalog } from './components/PublicCatalog';
import { Loader2, AlertCircle } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';

// ── Public catalog: no auth needed ──────────────────────────────────────────
function getCatalogRoute(): string | null {
  const path = window.location.pathname;
  const match = path.match(/^\/catalogo\/([^/?]+)/);
  if (match) return match[1];
  const params = new URLSearchParams(window.location.search);
  return params.get('catalog');
}

function AppContent() {
  const { user, loading: authLoading, isAdmin, isGerente } = useAuth();
  const { activeStore, loading: storeLoading } = useStore();
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
      case 'dashboard': return <Dashboard />;
      case 'clients': return <Clients />;
      case 'suppliers': return <Suppliers />;
      case 'costs': return <CostBaseSettings />;
      case 'materials': return <Materials />;
      case 'inventory': return <Inventory />;
      case 'products': return <Products />;
      case 'pricing': return <Pricing />;
      case 'history': return <History />;
      case 'laser': return <LaserCalculator />;
      case 'print3d': return <PrintCalculator />;
      case 'purchases': return <PurchaseList />;
      case 'production': return <ProductionPanel />;
      case 'stores': return isAdmin ? <Stores /> : <AccessDenied />;
      case 'users': return (isAdmin || isGerente) ? <Users /> : <AccessDenied />;
      case 'backup': return isAdmin ? <Backup /> : <AccessDenied />;
      default: return <Dashboard />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderContent()}
      </Layout>
    </ErrorBoundary>
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
        <PublicCatalog storeId={catalogStoreId} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <AuthProvider>
        <StoreProvider>
          <AppContent />
        </StoreProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
