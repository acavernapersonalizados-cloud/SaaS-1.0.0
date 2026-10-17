// npm run dev        → liga o Firebase Emulator (banco local), cria o ADMIN de teste e abre o app.
// npm run dev:limpo  → igual, mas começa com o banco local vazio.
//
// O banco do emulador fica salvo em .emulator-data/ ao fechar (Ctrl+C) e é
// carregado de novo na próxima vez. Nada disso toca o banco real: o projeto
// é "demo-precificaatelie", que o Firebase não deixa sair do computador.
import { existsSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const PROJECT_ID = 'demo-precificaatelie';
const DATA_DIR = '.emulator-data';
const clean = process.argv.includes('--limpo');

const args = [
  'emulators:exec',
  '--project',
  PROJECT_ID,
  '--only',
  'auth,firestore,storage',
  '--ui',
  '--export-on-exit',
  DATA_DIR,
];
if (!clean && existsSync(path.join(DATA_DIR, 'firebase-export-metadata.json'))) {
  args.push('--import', DATA_DIR);
}
args.push('"node scripts/seed-emulator.mjs && vite"');

// O emulador exige Java 21+. Terminais abertos antes da instalação do JDK não
// têm o JAVA_HOME novo, então procura também nas pastas padrão do Windows.
function findJdkHome() {
  const roots = ['C:\\Program Files\\Microsoft', 'C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Java'];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const jdk = readdirSync(root)
      .filter(name => /^jdk-?(2[1-9]|[3-9]\d)/.test(name))
      .sort()
      .pop();
    if (jdk) return path.join(root, jdk);
  }
  return process.env.JAVA_HOME;
}

const env = { ...process.env };
const jdkHome = findJdkHome();
if (jdkHome) {
  env.JAVA_HOME = jdkHome;
  env.PATH = `${path.join(jdkHome, 'bin')}${path.delimiter}${env.PATH}`;
}

console.log(`[dev] Firebase Emulator (${clean ? 'banco vazio' : 'banco salvo em ' + DATA_DIR}) + Vite`);
console.log('[dev] Painel do emulador: http://127.0.0.1:4000  |  App: http://localhost:5173');

const child = spawn(['firebase', ...args].join(' '), { stdio: 'inherit', shell: true, env });
child.on('exit', code => process.exit(code ?? 0));
