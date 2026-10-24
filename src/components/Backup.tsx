import React, { useState } from 'react';
import { collection, getDocs, getDoc, writeBatch, doc, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Download, Upload, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

// Versão do formato do arquivo de backup (não é a versão do app).
// 1 = arquivo antigo, sem `_meta`. 2 = exportação por loja com `_meta`.
const BACKUP_FORMAT_VERSION = 2;
const BACKUP_APP_ID = 'PrecificaAteliê';

// Coleções lidas sem filtro: as regras permitem `list` para ADMIN.
const GLOBAL_COLLECTIONS = ['stores', 'users'];

// Coleções com campo `storeId`: as regras (canRead/hasStoreAccess) só aceitam
// consultas filtradas por loja, então são lidas com where('storeId', '==', id).
const STORE_COLLECTIONS = [
  'materials',
  'products',
  'quotes',
  'clients',
  'suppliers',
  'categories',
  'laserMachines',
  'laserJobs',
  'printers',
  'printJobs',
  'sublimationMachines',
  'sublimationJobs',
  'papelariaJobs',
  'cestaJobs',
  'purchaseList',
  'stockMovements',
  'stockReservations',
];

// Coleções com um documento por loja (id do documento = storeId).
const DOC_PER_STORE_COLLECTIONS = ['costBases'];

const ALL_COLLECTIONS = [...GLOBAL_COLLECTIONS, ...DOC_PER_STORE_COLLECTIONS, ...STORE_COLLECTIONS];

const FIRESTORE_BATCH_LIMIT = 450;

type BackupDoc = { id: string; [key: string]: unknown };

interface BackupFailure {
  collection: string;
  storeId?: string;
  error: string;
}

interface BackupMeta {
  app: string;
  formatVersion: number;
  exportedAt: string;
  exportedBy: string | null;
  complete: boolean;
  failures: BackupFailure[];
  storeIds: string[];
  counts: Record<string, number>;
}

type BackupFile = { _meta: BackupMeta } & Record<string, BackupDoc[] | BackupMeta>;

interface ImportPreview {
  data: Record<string, unknown>;
  fileName: string;
  meta: BackupMeta | null;
  counts: Record<string, number>;
  warnings: string[];
}

type Message = { type: '' | 'success' | 'error' | 'warning'; text: string; details?: string[] };

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

const describeFailure = (f: BackupFailure) =>
  `${f.collection}${f.storeId ? ` (loja ${f.storeId})` : ''}: ${f.error.includes('permission') ? 'acesso negado' : f.error}`;

function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildImportPreview(raw: unknown, fileName: string): ImportPreview {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('O arquivo não contém um backup válido.');
  }
  const data = raw as Record<string, unknown>;
  const counts: Record<string, number> = {};
  for (const colName of ALL_COLLECTIONS) {
    if (Array.isArray(data[colName])) counts[colName] = (data[colName] as unknown[]).length;
  }
  if (Object.keys(counts).length === 0) {
    throw new Error('O arquivo não contém nenhuma coleção reconhecida.');
  }

  const warnings: string[] = [];
  const rawMeta = data._meta as Partial<BackupMeta> | undefined;
  let meta: BackupMeta | null = null;

  if (!rawMeta || typeof rawMeta !== 'object') {
    warnings.push(
      'Arquivo sem bloco _meta (backup antigo). Não é possível confirmar se ele está completo — backups antigos podem estar sem matérias-primas, orçamentos, clientes e base de custos.',
    );
  } else {
    meta = {
      app: String(rawMeta.app ?? ''),
      formatVersion: Number(rawMeta.formatVersion ?? 0),
      exportedAt: String(rawMeta.exportedAt ?? ''),
      exportedBy: rawMeta.exportedBy ?? null,
      complete: rawMeta.complete === true,
      failures: Array.isArray(rawMeta.failures) ? rawMeta.failures : [],
      storeIds: Array.isArray(rawMeta.storeIds) ? rawMeta.storeIds : [],
      counts: rawMeta.counts && typeof rawMeta.counts === 'object' ? rawMeta.counts : {},
    };
    if (meta.app !== BACKUP_APP_ID) {
      warnings.push(`O arquivo não parece ser um backup do ${BACKUP_APP_ID} (app: "${meta.app || 'desconhecido'}").`);
    }
    if (meta.formatVersion > BACKUP_FORMAT_VERSION) {
      warnings.push(
        `O backup usa um formato mais novo (v${meta.formatVersion}) do que este app entende (v${BACKUP_FORMAT_VERSION}).`,
      );
    }
    if (!meta.complete) {
      warnings.push(
        'Este backup foi marcado como INCOMPLETO na exportação. Coleções que falharam: ' +
          (meta.failures.length ? meta.failures.map(describeFailure).join('; ') : 'não informadas') +
          '.',
      );
    }
    const mismatches = ALL_COLLECTIONS.filter(c => (meta!.counts[c] ?? 0) !== (counts[c] ?? 0));
    if (mismatches.length) {
      warnings.push(
        'A contagem de documentos não confere com o _meta em: ' +
          mismatches.map(c => `${c} (esperado ${meta!.counts[c] ?? 0}, encontrado ${counts[c] ?? 0})`).join(', ') +
          '. O arquivo pode ter sido editado ou truncado.',
      );
    }
  }

  return { data, fileName, meta, counts, warnings };
}

export function Backup() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message>({ type: '', text: '' });

  // Backup que falhou em alguma coleção: só baixa se o usuário pedir.
  const [incompleteBackup, setIncompleteBackup] = useState<BackupFile | null>(null);

  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);

  const backupFileName = (complete: boolean) =>
    `backup_precifica_ja_${new Date().toISOString().split('T')[0]}${complete ? '' : '_INCOMPLETO'}.json`;

  const handleExport = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    setIncompleteBackup(null);

    const failures: BackupFailure[] = [];
    const collected: Record<string, Map<string, BackupDoc>> = {};
    for (const colName of ALL_COLLECTIONS) collected[colName] = new Map();

    const addDocs = (colName: string, docs: { id: string; data: () => Record<string, unknown> }[]) => {
      for (const d of docs) collected[colName].set(d.id, { id: d.id, ...d.data() });
    };

    try {
      for (const colName of GLOBAL_COLLECTIONS) {
        try {
          const snap = await getDocs(collection(db, colName));
          addDocs(colName, snap.docs);
        } catch (err) {
          console.error(`[Backup] Falha ao ler ${colName}:`, err);
          failures.push({ collection: colName, error: errorText(err) });
        }
      }

      const storeIds = [...collected.stores.keys()];
      if (failures.some(f => f.collection === 'stores')) {
        for (const colName of [...DOC_PER_STORE_COLLECTIONS, ...STORE_COLLECTIONS]) {
          failures.push({ collection: colName, error: 'não foi possível listar as lojas' });
        }
      }

      for (const storeId of storeIds) {
        for (const colName of DOC_PER_STORE_COLLECTIONS) {
          try {
            const snap = await getDoc(doc(db, colName, storeId));
            if (snap.exists()) addDocs(colName, [snap]);
          } catch (err) {
            console.error(`[Backup] Falha ao ler ${colName}/${storeId}:`, err);
            failures.push({ collection: colName, storeId, error: errorText(err) });
          }
        }
        for (const colName of STORE_COLLECTIONS) {
          try {
            const snap = await getDocs(query(collection(db, colName), where('storeId', '==', storeId)));
            addDocs(colName, snap.docs);
          } catch (err) {
            console.error(`[Backup] Falha ao ler ${colName} da loja ${storeId}:`, err);
            failures.push({ collection: colName, storeId, error: errorText(err) });
          }
        }
      }

      const counts: Record<string, number> = {};
      const backupData: Record<string, BackupDoc[]> = {};
      for (const colName of ALL_COLLECTIONS) {
        backupData[colName] = [...collected[colName].values()];
        counts[colName] = backupData[colName].length;
      }

      const backup: BackupFile = {
        _meta: {
          app: BACKUP_APP_ID,
          formatVersion: BACKUP_FORMAT_VERSION,
          exportedAt: new Date().toISOString(),
          exportedBy: auth.currentUser?.email ?? null,
          complete: failures.length === 0,
          failures,
          storeIds,
          counts,
        },
        ...backupData,
      };

      if (failures.length > 0) {
        setIncompleteBackup(backup);
        setMessage({
          type: 'error',
          text: `Backup NÃO foi baixado: ${failures.length} leitura(s) falharam. O arquivo ficaria incompleto.`,
          details: failures.map(describeFailure),
        });
        return;
      }

      downloadJson(backup, backupFileName(true));
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      setMessage({
        type: 'success',
        text: `Backup exportado com sucesso: ${total} documentos de ${storeIds.length} loja(s).`,
        details: ALL_COLLECTIONS.map(c => `${c}: ${counts[c]}`),
      });
    } catch (error) {
      console.error('Export error:', error);
      setMessage({ type: 'error', text: 'Erro ao exportar backup: ' + errorText(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadIncomplete = () => {
    if (!incompleteBackup) return;
    downloadJson(incompleteBackup, backupFileName(false));
    setIncompleteBackup(null);
    setMessage({
      type: 'warning',
      text: 'Backup INCOMPLETO baixado. A lista de coleções que falharam está no bloco _meta do arquivo.',
      details: incompleteBackup._meta.failures.map(describeFailure),
    });
  };

  const processImport = async (preview: ImportPreview) => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    let written = 0;
    let batch = writeBatch(db);
    let pending = 0;
    let pendingCollections = new Set<string>();

    const commit = async () => {
      try {
        await batch.commit();
      } catch (err) {
        throw new Error(
          `falha ao gravar (${[...pendingCollections].join(', ')}) depois de ${written} documentos já restaurados: ${errorText(err)}`,
        );
      }
      written += pending;
      batch = writeBatch(db);
      pending = 0;
      pendingCollections = new Set();
    };

    try {
      for (const colName of ALL_COLLECTIONS) {
        const items = preview.data[colName];
        if (!Array.isArray(items)) continue;
        for (const item of items as BackupDoc[]) {
          const { id, ...data } = item;
          if (!id) continue;
          batch.set(doc(db, colName, String(id)), data);
          pending++;
          pendingCollections.add(colName);
          if (pending >= FIRESTORE_BATCH_LIMIT) await commit();
        }
      }
      if (pending > 0) await commit();

      setMessage({ type: 'success', text: `Backup restaurado com sucesso: ${written} documentos gravados.` });
    } catch (error) {
      console.error('Import error:', error);
      setMessage({ type: 'error', text: 'Erro ao restaurar backup: ' + errorText(error) });
    } finally {
      setLoading(false);
      setImportPreview(null);
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMessage({ type: '', text: '' });

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        setImportPreview(buildImportPreview(raw, file.name));
      } catch (error) {
        setMessage({ type: 'error', text: 'Não foi possível ler o arquivo de backup: ' + errorText(error) });
      }
    };
    reader.onerror = () => setMessage({ type: 'error', text: 'Não foi possível ler o arquivo de backup.' });
    reader.readAsText(file);
  };

  const messageStyle =
    message.type === 'error'
      ? 'bg-red-50 text-red-600 border border-red-100'
      : message.type === 'warning'
        ? 'bg-orange-50 text-orange-700 border border-orange-100'
        : 'bg-green-50 text-green-600 border border-green-100';

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Backup e Restauração</h1>
        <p className="text-neutral-500">Exporte e importe os dados do sistema para segurança.</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-2xl flex items-start gap-3 text-sm ${messageStyle}`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <div className="space-y-2 min-w-0">
            <p className="font-medium">{message.text}</p>
            {message.details && message.details.length > 0 && (
              <ul className="list-disc pl-5 space-y-0.5 break-words">
                {message.details.map(d => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            {incompleteBackup && (
              <button
                onClick={handleDownloadIncomplete}
                className="mt-2 px-4 py-2 bg-white text-red-700 border border-red-200 rounded-xl font-bold hover:bg-red-50 transition-all"
              >
                Baixar mesmo assim (marcado como incompleto)
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setMessage({ type: '', text: '' });
              setIncompleteBackup(null);
            }}
            className="ml-auto shrink-0 opacity-60 hover:opacity-100"
            aria-label="Fechar mensagem"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Card */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-neutral-100 space-y-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Download className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Exportar Dados</h2>
            <p className="text-sm text-neutral-500 mt-2">
              Baixe um arquivo JSON com todos os dados de todas as lojas: matérias-primas, produtos, orçamentos,
              clientes, base de custos, fornecedores, categorias, estoque, laser, impressão, papelaria, cestas, lojas e
              usuários.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={loading}
            className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 mt-auto"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            Fazer Backup
          </button>
        </div>

        {/* Import Card */}
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-neutral-100 space-y-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center">
            <Upload className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Restaurar Backup</h2>
            <p className="text-sm text-neutral-500 mt-2">
              Envie um arquivo de backup anterior para restaurar os dados. Isso pode sobrescrever dados atuais.
            </p>
          </div>
          <div className="w-full mt-auto relative">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={loading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <button
              disabled={loading}
              className="w-full py-4 bg-white text-neutral-900 border-2 border-neutral-200 rounded-2xl font-bold hover:bg-neutral-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              Restaurar Dados
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {importPreview && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl p-10 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center text-orange-600 mx-auto">
              <AlertCircle className="w-10 h-10" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-neutral-900">Confirmar Restauração?</h3>
              <p className="text-neutral-500 text-sm">
                ATENÇÃO: A restauração do backup irá sobrescrever os dados existentes com os mesmos IDs. Esta ação não
                pode ser desfeita.
              </p>
            </div>

            <div className="text-sm text-neutral-700 bg-neutral-50 rounded-2xl p-4 space-y-2">
              <p className="font-bold break-words">{importPreview.fileName}</p>
              {importPreview.meta && (
                <p>
                  Exportado em{' '}
                  {importPreview.meta.exportedAt
                    ? new Date(importPreview.meta.exportedAt).toLocaleString('pt-BR')
                    : 'data desconhecida'}
                  {importPreview.meta.exportedBy ? ` por ${importPreview.meta.exportedBy}` : ''} · formato v
                  {importPreview.meta.formatVersion}
                </p>
              )}
              <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {ALL_COLLECTIONS.map(c => (
                  <li key={c} className={importPreview.counts[c] ? '' : 'text-neutral-400'}>
                    {c}: {importPreview.counts[c] ?? 0}
                  </li>
                ))}
              </ul>
            </div>

            {importPreview.warnings.length > 0 && (
              <div className="text-sm bg-red-50 text-red-700 border border-red-100 rounded-2xl p-4 space-y-2">
                <p className="font-bold">Verifique antes de continuar:</p>
                <ul className="list-disc pl-5 space-y-1 break-words">
                  {importPreview.warnings.map(w => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-3 sticky -bottom-10 -mx-10 -mb-10 px-10 pb-10 bg-white pt-4 border-t border-neutral-100">
              <button
                onClick={() => processImport(importPreview)}
                disabled={loading}
                className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {importPreview.warnings.length > 0 ? 'Restaurar mesmo assim' : 'Sim, Restaurar Dados'}
              </button>
              <button
                onClick={() => setImportPreview(null)}
                disabled={loading}
                className="w-full py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
