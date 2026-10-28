import {
  doc,
  updateDoc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import { db, notifyError } from '../firebase';
import { QuoteStatus, Quote, StockReservation, Product, CostBase } from '../types';
import { productionDeadline } from '../lib/productionDeadline';

/**
 * Estacionamento item 20: início e prazo de produção do orçamento a partir de "start", com os produtos e a Base de
 * Custos da loja. Se não der para ler, devolve vazio (o status muda mesmo assim, sem prazo).
 */
async function deadlineFields(
  quote: Pick<Quote, 'items'>,
  storeId: string,
  start: Date,
): Promise<{ productionStartedAt?: string; productionDueAt?: string }> {
  try {
    const snaps = await Promise.all(
      // Item sem produto (orçamento antigo) fica de fora: ler um produto sem código dá erro na hora.
      (quote.items || [])
        .filter(i => !!i.productId)
        .map(i => getDoc(doc(db, 'products', i.productId)).catch(() => null)),
    );
    const products = snaps.flatMap(s => (s?.exists() ? [{ id: s.id, ...s.data() } as Product] : []));
    const costSnap = await getDoc(doc(db, 'costBases', storeId)).catch(() => null);
    const costs = costSnap?.exists() ? (costSnap.data() as CostBase) : null;
    const { productionStartedAt, productionDueAt } = productionDeadline(quote, products, costs, start);
    return { productionStartedAt, productionDueAt };
  } catch (err) {
    notifyError('O prazo de produção não foi calculado', err, 'warning');
    return {};
  }
}

/** Botão "Calcular prazo a partir de hoje" (pedidos que já estavam em produção antes do item 20). */
export async function setProductionDeadlineFromToday(quote: Quote) {
  const fields = await deadlineFields(quote, quote.storeId, new Date());
  if (fields.productionDueAt) await updateDoc(doc(db, 'quotes', quote.id), fields);
  return fields;
}

// Statuses that trigger a stock reservation
const RESERVE_STATUSES: QuoteStatus[] = ['Aprovado', 'Em produção'];
// Statuses that convert reservation → definitive stock deduction
const CONVERT_STATUSES: QuoteStatus[] = ['Finalizado'];
// Statuses that release a reservation. 'Pendente' covers a quote sent back
// from Aprovado/Em produção; the others are not in QuoteStatus (defensive).
const RELEASE_STATUSES = ['Pendente', 'Cancelado', 'Rejeitado', 'Expirado'];

async function getActiveReservation(
  quoteId: string,
  storeId: string,
): Promise<(StockReservation & { id: string }) | null> {
  // Current reservations use a deterministic ID, so this lookup is both
  // cheaper and authorized by the document's own storeId.
  const deterministicRef = doc(db, 'stockReservations', `res_${quoteId}`);
  try {
    const deterministicSnap = await getDoc(deterministicRef);
    if (deterministicSnap.exists() && deterministicSnap.data()?.status === 'active') {
      return { id: deterministicSnap.id, ...deterministicSnap.data() } as StockReservation & { id: string };
    }
  } catch (error) {
    // Older budgets may not have a deterministic reservation document. Some
    // Firestore rule sets report a missing protected document as denied.
    console.warn('[automations] Deterministic reservation lookup failed:', error);
  }

  // Backward compatibility for reservations created before deterministic IDs.
  // Including storeId is required so Firestore can prove this list is limited
  // to the signed-in user's active store.
  try {
    const snap = await getDocs(
      query(collection(db, 'stockReservations'), where('storeId', '==', storeId), where('quoteId', '==', quoteId)),
    );
    const active = snap.docs.find(item => item.data()?.status === 'active');
    return active ? ({ id: active.id, ...active.data() } as StockReservation & { id: string }) : null;
  } catch (error) {
    // A legacy reservation must never prevent a quote status from changing.
    console.warn('[automations] Legacy reservation lookup failed:', error);
    return null;
  }
}

async function buildReservations(
  quoteData: Quote,
): Promise<Array<{ materialId: string; materialName: string; quantity: number }>> {
  const deductions: Record<string, { materialName: string; quantity: number }> = {};

  for (const item of quoteData.items || []) {
    try {
      const productSnap = await getDoc(doc(db, 'products', item.productId));
      if (!productSnap.exists()) continue;
      const product = productSnap.data();

      for (const pm of product.materials || []) {
        const totalQty = (Number(pm.quantity) || 0) * (Number(item.quantity) || 1);
        if (totalQty <= 0) continue;

        const matSnap = await getDoc(doc(db, 'materials', pm.materialId));
        const matName = matSnap.exists() ? matSnap.data().name : pm.materialId;

        if (!deductions[pm.materialId]) {
          deductions[pm.materialId] = { materialName: matName, quantity: 0 };
        }
        deductions[pm.materialId].quantity += totalQty;
      }
    } catch {
      // skip products that no longer exist — don't block the status update
    }
  }

  return Object.entries(deductions).map(([materialId, d]) => ({
    materialId,
    materialName: d.materialName,
    quantity: d.quantity,
  }));
}

// Estacionamento item 17 (28/10/2026): mudar o status não abre mais o WhatsApp; o Histórico mostra o botão
// "Enviar no WhatsApp", que só abre com o clique.
export async function updateQuoteStatus(quoteId: string, newStatus: QuoteStatus) {
  const quoteRef = doc(db, 'quotes', quoteId);
  const quoteSnap = await getDoc(quoteRef);
  if (!quoteSnap.exists()) throw new Error(`Quote ${quoteId} not found`);

  const quoteData = quoteSnap.data() as Quote & { stockProcessed?: boolean };
  const previousStatus = quoteData.status as QuoteStatus;

  // ── 1. CREATE RESERVATION (ID fixo por orçamento: no máximo uma reserva) ──
  if (RESERVE_STATUSES.includes(newStatus) && !RESERVE_STATUSES.includes(previousStatus)) {
    try {
      const reservations = await buildReservations(quoteData);

      // Correção de 28/10/2026: a transação lia res_<orçamento> antes de existir, e a regra nega ler um documento
      // que não existe (resource nulo) — a reserva nunca era criada desde 17/10/2026. Agora procura a reserva ativa
      // (ID fixo ou busca pela loja, que a regra permite) e grava com o mesmo ID fixo: continua no máximo UMA
      // reserva por orçamento, mesmo com dois cliques (os dois gravam o mesmo documento).
      const active = reservations.length > 0 ? await getActiveReservation(quoteId, quoteData.storeId) : null;
      if (reservations.length > 0 && !active) {
        await setDoc(doc(db, 'stockReservations', `res_${quoteId}`), {
          storeId: quoteData.storeId,
          quoteId,
          clientName: quoteData.clientName || '',
          reservations,
          status: 'active',
          createdAt: new Date().toISOString(),
        });

        // Log movement (non-critical — fire and forget)
        addDoc(collection(db, 'stockMovements'), {
          storeId: quoteData.storeId,
          quoteId,
          type: 'reservation',
          reason: `Orçamento ${newStatus}`,
          reservations,
          createdAt: new Date().toISOString(),
        }).catch(err => notifyError('Registro do movimento de estoque (reserva) não foi gravado', err, 'warning'));
      }
    } catch (err) {
      notifyError('A reserva de estoque não foi criada', err, 'warning');
      // Don't block status update — reservation failure is non-critical
    }
  }

  // ── 2. CONVERT RESERVATION → DEFINITIVE STOCK DEDUCTION ──────────────────
  if (CONVERT_STATUSES.includes(newStatus) && !quoteData.stockProcessed) {
    const reservation = await getActiveReservation(quoteId, quoteData.storeId);
    // Finalizado direto de Pendente não tem reserva: calcula a baixa agora.
    const deductions = reservation ? reservation.reservations : await buildReservations(quoteData);

    if (deductions.length > 0) {
      try {
        // Tudo em uma transação: leitura do estoque e baixa acontecem de forma
        // atômica, evitando baixa duplicada ou perda de atualização.
        const applied = await runTransaction(db, async tx => {
          const resRef = doc(db, 'stockReservations', reservation ? reservation.id : `res_${quoteId}`);
          if (reservation) {
            const resSnap = await tx.get(resRef);
            if (!resSnap.exists() || resSnap.data()?.status !== 'active') return false;
          }

          const quoteNow = await tx.get(quoteRef);
          if (quoteNow.data()?.stockProcessed) return false;

          const matRefs = deductions.map(r => doc(db, 'materials', r.materialId));
          const matSnaps = await Promise.all(matRefs.map(ref => tx.get(ref)));

          matSnaps.forEach((matSnap, i) => {
            if (!matSnap.exists()) return;
            const currentStock = Number(matSnap.data().stockQuantity) || 0;
            tx.update(matRefs[i], {
              stockQuantity: Math.max(0, currentStock - deductions[i].quantity),
              updatedAt: new Date().toISOString(),
            });
          });

          const now = new Date().toISOString();
          if (reservation) {
            tx.update(resRef, { status: 'converted', convertedAt: now });
          } else {
            // Registra a baixa como reserva já convertida, para manter o histórico.
            tx.set(resRef, {
              storeId: quoteData.storeId,
              quoteId,
              clientName: quoteData.clientName || '',
              reservations: deductions,
              status: 'converted',
              createdAt: now,
              convertedAt: now,
            });
          }
          tx.update(quoteRef, { status: newStatus, stockProcessed: true });
          return true;
        });

        if (applied) {
          addDoc(collection(db, 'stockMovements'), {
            storeId: quoteData.storeId,
            quoteId,
            type: 'deduction',
            reason: `Orçamento ${newStatus}`,
            deductions,
            createdAt: new Date().toISOString(),
          }).catch(err => notifyError('Registro do movimento de estoque (baixa) não foi gravado', err, 'warning'));

          return; // transaction already updated status — exit early
        }
        // Nada foi baixado (já processado): segue para a atualização simples de status.
      } catch (err) {
        notifyError('O estoque NÃO foi baixado; o status do orçamento será atualizado mesmo assim', err);
        // Fall through to simple status update below
      }
    }
  }

  // ── 3. RELEASE RESERVATION on cancellation ────────────────────────────────
  if (RELEASE_STATUSES.includes(newStatus)) {
    const reservation = await getActiveReservation(quoteId, quoteData.storeId);
    if (reservation) {
      try {
        await updateDoc(doc(db, 'stockReservations', reservation.id), {
          status: 'released',
          releasedAt: new Date().toISOString(),
          reason: newStatus,
        });

        addDoc(collection(db, 'stockMovements'), {
          storeId: quoteData.storeId,
          quoteId,
          type: 'release',
          reason: `Orçamento ${newStatus}`,
          released: reservation.reservations,
          createdAt: new Date().toISOString(),
        }).catch(err => notifyError('Registro do movimento de estoque (liberação) não foi gravado', err, 'warning'));
      } catch (err) {
        notifyError('A reserva de estoque não foi liberada', err, 'warning');
      }
    }
  }

  // ── 4. SIMPLE STATUS UPDATE (fallback / non-stock-affecting transitions) ──
  // Item 20: ao entrar "Em produção" pela primeira vez, grava o início e o prazo estimado (dias úteis).
  const deadline =
    newStatus === 'Em produção' && !quoteData.productionDueAt
      ? await deadlineFields(quoteData, quoteData.storeId, new Date())
      : {};
  await updateDoc(quoteRef, { status: newStatus, ...deadline });
}
