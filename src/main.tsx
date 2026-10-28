import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { setUpdateAvailable } from './lib/appUpdate';
import { isPublicCatalogPage } from './lib/publicCatalogRoute';

// Correção de 28/10/2026: no catálogo público o cliente não pode receber a oferta de instalar o sistema. Lá não há
// manifesto nem service worker; um service worker que este aparelho já tenha (de uma visita antiga) é desligado,
// junto com o cache dele. No painel (logado), tudo continua como antes: instalável e com aviso de versão nova.
if (isPublicCatalogPage(window.location)) {
  navigator.serviceWorker
    ?.getRegistrations()
    .then(regs => regs.forEach(r => void r.unregister()))
    .catch(() => {});
  window.caches
    ?.keys()
    .then(keys => keys.filter(k => k.startsWith('workbox')).forEach(k => void caches.delete(k)))
    .catch(() => {});
} else {
  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = '/manifest.webmanifest';
  document.head.appendChild(manifest);
  registerAppServiceWorker();
}

// Etapa 7.1: a versão nova não entra sozinha. O app avisa ("Nova versão disponível") e bloqueia
// gravações nesta aba até a pessoa atualizar, para uma versão antiga não gravar dados.
function registerAppServiceWorker() {
  const updateSW = registerSW({
    onNeedRefresh() {
      setUpdateAvailable(() => {
        void updateSW(true);
        // Se a página não recarregar sozinha (ex.: aba ainda não controlada pelo service worker),
        // recarrega direto: a versão nova já está no servidor.
        setTimeout(() => window.location.reload(), 1500);
      });
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Abas que ficam abertas por horas também descobrem uma publicação nova.
      const check = () => registration.update().catch(() => {});
      setInterval(check, 5 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
    onOfflineReady() {
      console.log('App pronto para uso offline');
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
