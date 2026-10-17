import { doc, updateDoc, getDoc, collection, addDoc, query, where, getDocs, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { QuoteStatus, Quote, StockReservation } from '../types';
import { sendWhatsAppMessage, generateStatusMessage } from './whatsapp';

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

export async function updateQuoteStatus(quoteId: string, newStatus: QuoteStatus, phone?: string, productName?: string) {
  const quoteRef = doc(db, 'quotes', quoteId);
  const quoteSnap = await getDoc(quoteRef);
  if (!quoteSnap.exists()) throw new Error(`Quote ${quoteId} not found`);

  const quoteData = quoteSnap.data() as Quote & { stockProcessed?: boolean };
  const previousStatus = quoteData.status as QuoteStatus;

  // ── 1. CREATE RESERVATION (atomic via transaction to prevent duplicates) ──
  if (RESERVE_STATUSES.includes(newStatus) && !RESERVE_STATUSES.includes(previousStatus)) {
    try {
      const reservations = await buildReservations(quoteData);

      if (reservations.length > 0) {
        // Use runTransaction to guarantee idempotency — only one reservation per quote
        // ID determinístico por orçamento: garante no máximo UMA reserva ativa,
        // mesmo com dois cliques simultâneos (getDocs dentro de transação não
        // participa do controle de concorrência do Firestore).
        await runTransaction(db, async tx => {
          const newResRef = doc(db, 'stockReservations', `res_${quoteId}`);
          const existing = await tx.get(newResRef);
          if (existing.exists() && existing.data()?.status === 'active') return;

          tx.set(newResRef, {
            storeId: quoteData.storeId,
            quoteId,
            clientName: quoteData.clientName || '',
            reservations,
            status: 'active',
            createdAt: new Date().toISOString(),
          });
        });

        // Log movement (non-critical — fire and forget)
        addDoc(collection(db, 'stockMovements'), {
          storeId: quoteData.storeId,
          quoteId,
          type: 'reservation',
          reason: `Orçamento ${newStatus}`,
          reservations,
          createdAt: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('[automations] Reservation creation failed:', err);
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
          }).catch(() => {});

          if (phone && productName) {
            const msg = generateStatusMessage(newStatus, productName);
            if (msg) sendWhatsAppMessage(phone, msg);
          }
          return; // transaction already updated status — exit early
        }
        // Nada foi baixado (já processado): segue para a atualização simples de status.
      } catch (err) {
        console.warn('[automations] Stock deduction failed, falling through to simple status update:', err);
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
        }).catch(() => {});
      } catch (err) {
        console.warn('[automations] Reservation release failed:', err);
      }
    }
  }

  // ── 4. SIMPLE STATUS UPDATE (fallback / non-stock-affecting transitions) ──
  await updateDoc(quoteRef, { status: newStatus });

  if (phone && productName) {
    const msg = generateStatusMessage(newStatus, productName);
    if (msg) sendWhatsAppMessage(phone, msg);
  }
}

export async function checkFollowUps() {
  // Placeholder — implement in Cloud Functions for production use
}
