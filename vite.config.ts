import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Sem estas variáveis o app abre só com "Configuração do Firebase incompleta".
// O build falha antes, para nunca publicar um site quebrado (ex.: GitHub Actions sem secrets).
const REQUIRED_BUILD_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), '');
    const missing = REQUIRED_BUILD_ENV.filter(name => !env[name]);
    if (missing.length > 0) {
      throw new Error(
        `Build cancelado: faltam as variáveis ${missing.join(', ')}. ` +
          'Local: preencha o .env. GitHub Actions: cadastre-as em Settings > Secrets and variables > Actions.',
      );
    }
  }

  return {
    base: '/',

    // Versão visível no app (data e hora do build), para conferir depois de publicar.
    define: {
      __APP_VERSION__: JSON.stringify(
        new Date()
          .toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
          .replace(',', ''),
      ),
    },

    plugins: [
      react(),
      VitePWA({
        // Etapa 7.1: a versão nova espera a pessoa clicar em "Atualizar agora" (UpdateGate).
        registerType: 'prompt',
        includeAssets: ['favicon.ico'],
        manifest: {
          name: 'PrecificaAteliê',
          short_name: 'Precifica',
          start_url: './',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#000000',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
      }),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    build: {
      rollupOptions: {
        output: {
          manualChunks: (id: string) => {
            // Ajudante do Vite que carrega as telas sob demanda. Sem isto ele ia parar dentro do
            // vendor-pdf (o jsPDF também carrega partes sob demanda), e o PDF inteiro baixava na abertura.
            if (id.includes('vite/preload-helper')) return 'preload-helper';
            // React com pacote próprio: senão ia junto com os gráficos (que dependem dele) e os
            // gráficos baixavam na abertura.
            if (/node_modules\/(react|react-dom|scheduler|clsx)\//.test(id)) return 'vendor-react';
            if (id.includes('node_modules/firebase')) return 'vendor-firebase';
            if (
              id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3') ||
              id.includes('node_modules/victory')
            )
              return 'vendor-charts';
            if (id.includes('node_modules/jspdf')) return 'vendor-pdf';
          },
        },
      },
      // Suppress the 500kB chunk warning (we split above, remaining chunks are expected)
      chunkSizeWarningLimit: 600,
    },
  };
});
