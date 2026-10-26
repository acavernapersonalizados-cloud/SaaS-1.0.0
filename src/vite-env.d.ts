/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Data e hora do build (vite.config.ts), mostrada no menu. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  // Firebase
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;

  // IA (Firebase AI Logic): a chave do Gemini fica só no Firebase. Esta é a chave do site do
  // reCAPTCHA Enterprise para o App Check (pública por natureza). Sem ela, o App Check não liga.
  readonly VITE_RECAPTCHA_ENTERPRISE_SITE_KEY?: string;

  // Admin config (optional — falls back to hardcoded email)
  readonly VITE_ADMIN_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
