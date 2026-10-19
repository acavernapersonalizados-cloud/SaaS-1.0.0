import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { setUpdateAvailable } from './lib/appUpdate';

// Etapa 7.1: a versão nova não entra sozinha. O app avisa ("Nova versão disponível") e bloqueia
// gravações nesta aba até a pessoa atualizar, para uma versão antiga não gravar dados.
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
