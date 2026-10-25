// Hook UserPromptSubmit: bloqueia mensagem 100% idêntica a uma enviada nos últimos 7 dias.
// - Guarda só o hash (sha256) de cada mensagem em .claude/prompt-history.json (fora do git).
// - Ignora mensagens com menos de 40 caracteres e comandos com barra (/ecc:..., /clear etc.).
// - Mensagem começando com "REPETIR:" passa de propósito.
// Não toca no app. Se algo der errado aqui, a mensagem passa (nunca trava o trabalho).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DAYS = 7;
const MIN_LENGTH = 40;
const HISTORY =
  process.env.PROMPT_HISTORY_FILE || join(dirname(fileURLToPath(import.meta.url)), '..', 'prompt-history.json');

const readStdin = () =>
  new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => (data += c));
    process.stdin.on('end', () => resolve(data));
  });

const fmt = iso =>
  new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

try {
  const input = JSON.parse((await readStdin()) || '{}');
  const prompt = String(input.prompt ?? '').trim();

  // De propósito, curtas e comandos com barra: passam sem registrar.
  if (prompt.startsWith('REPETIR:') || prompt.length < MIN_LENGTH || prompt.startsWith('/')) process.exit(0);

  const hash = createHash('sha256').update(prompt).digest('hex');
  const now = Date.now();
  let history = {};
  if (existsSync(HISTORY)) {
    try {
      history = JSON.parse(readFileSync(HISTORY, 'utf8'));
    } catch {
      history = {};
    }
  }
  // Esquece o que tem mais de 7 dias.
  for (const [h, iso] of Object.entries(history)) {
    if (now - Date.parse(iso) > DAYS * 24 * 60 * 60 * 1000) delete history[h];
  }

  const previous = history[hash];
  if (previous) {
    // Bloqueia: a mensagem não é processada e o motivo aparece para o usuário.
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason: `Comando já dado em ${fmt(previous)}. Se quiser repetir de propósito, comece a mensagem com 'REPETIR:'.`,
      }),
    );
    process.exit(0);
  }

  history[hash] = new Date(now).toISOString();
  mkdirSync(dirname(HISTORY), { recursive: true });
  writeFileSync(HISTORY, JSON.stringify(history, null, 2));
  process.exit(0);
} catch {
  process.exit(0);
}
