/**
 * Item 33, parte 3 (20/11/2026): produto exclusivo, feito sob medida para um cliente. Nunca entra no catálogo
 * público; o cliente é opcional (digita ou escolhe dos clientes cadastrados).
 */
import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../contexts/StoreContext';

export function ExclusiveFields({
  exclusive,
  client,
  onChange,
}: {
  exclusive: boolean;
  client: string;
  onChange: (next: { exclusive: boolean; client: string }) => void;
}) {
  const { activeStore } = useStore();
  const [clientNames, setClientNames] = useState<string[]>([]);

  useEffect(() => {
    if (!exclusive || !activeStore || clientNames.length > 0) return;
    let alive = true;
    getDocs(query(collection(db, 'clients'), where('storeId', '==', activeStore.id)))
      .then(snap => {
        if (!alive) return;
        const names = snap.docs.map(d => String(d.data().name ?? '').trim()).filter(Boolean);
        setClientNames([...new Set(names)].sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [exclusive, activeStore, clientNames.length]);

  return (
    <div className="p-3 bg-violet-50 border border-violet-100 rounded-xl space-y-2">
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={exclusive}
          onChange={e => onChange({ exclusive: e.target.checked, client })}
          className="w-4 h-4 rounded mt-0.5"
        />
        <span className="text-xs text-violet-900">
          <b>Produto exclusivo</b>: personalizado para um cliente; nunca aparece no catálogo.
        </span>
      </label>
      {exclusive && (
        <div className="space-y-1">
          <label htmlFor="exclusive-client" className="text-[11px] font-bold text-violet-800">
            Cliente (opcional)
          </label>
          <input
            id="exclusive-client"
            list="exclusive-client-names"
            value={client}
            onChange={e => onChange({ exclusive, client: e.target.value })}
            placeholder="Nome do cliente"
            className="w-full px-3 py-2 bg-white border border-violet-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-400"
          />
          <datalist id="exclusive-client-names">
            {clientNames.map(n => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
      )}
    </div>
  );
}

/** Selo "Exclusivo" (com o cliente, quando houver) nas listas de produto. */
export function ExclusiveBadge({ client }: { client?: string | null }) {
  return (
    <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold">
      ⭐ Exclusivo{client ? ` · ${client}` : ''}
    </span>
  );
}
