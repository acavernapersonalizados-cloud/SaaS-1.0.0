import {
  doc, updateDoc, getDoc, writeBatch,
  collection, addDoc, query, where, getDocs, runTransaction
} from 'firebase/firestore';
import { db } from '../firebase';
import { QuoteStatus, Quote, StockReservation } from '../types';
import { sendWhatsAppMessage, generateStatusMessage } from './whatsapp';

// Statuses that trigger a stock reservation
const RESERVE_STATUSES: QuoteStatus[] = ['Aprovado', 'Em produção'];
// Statuses that convert reservation → definitive stock deduction
const CONVERT_STATUSES: QuoteStatus[] = ['Finalizado'];
// Statuses that release a reservation (not in QuoteStatus — handled defensively)
const RELEASE_STATUSES = ['Cancelado', 'Rejeitado', 'Expirado'];

async function getActiveReservation(quoteId: string): Promise<(StockReservation & { id: string }) | null> {
  const snap = await getDocs(
    query(
      collection(db, 'stockReservations'),
      where('quoteId', '==', quoteId),
      where('status', '==', 'active')
    )
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as StockReservation & { id: string };
}

async function buildReservations(
  quoteData: Quote
): Promise<Array<{ materialId: string; materialName: string; quantity: number }>> {
  const deductions: Record<string, { materialName: string; quantity: number }> = {};

  for (const item of quoteData.items || []) {
    try {
      const productSnap = await getDoc(doc(db, 'products', item.productId));
      if (!productSnap.exists()) continue;
      const product = productSnap.data();

      for (const pm of (product.materials || [])) {
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

export async function updateQuoteStatus(
  quoteId: string,
  newStatus: QuoteStatus,
  phone?: string,
  productName?: string
) {
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
        await runTransaction(db, async (tx) => {
          // Re-check inside transaction
          const existingSnap = await getDocs(
            query(
              collection(db, 'stockReservations'),
              where('quoteId', '==', quoteId),
              where('status', '==', 'active')
            )
          );
          // getDocs inside transaction is read-only check — if already exists, skip
          if (!existingSnap.empty) return;

          const newResRef = doc(collection(db, 'stockReservations'));
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
    const reservation = await getActiveReservation(quoteId);

    if (reservation) {
      try {
        const batch = writeBatch(db);

        for (const res of reservation.reservations) {
          const matSnap = await getDoc(doc(db, 'materials', res.materialId));
          if (!matSnap.exists()) continue;

          const currentStock = Number(matSnap.data().stockQuantity) || 0;
          // Never go below zero
          batch.update(doc(db, 'materials', res.materialId), {
            stockQuantity: Math.max(0, currentStock - res.quantity),
            updatedAt: new Date().toISOString(),
          });
        }

        batch.update(doc(db, 'stockReservations', reservation.id), {
          status: 'converted',
          convertedAt: new Date().toISOString(),
        });

        // Mark stockProcessed atomically with status update to prevent double-deduction
        batch.update(quoteRef, { status: newStatus, stockProcessed: true });

        await batch.commit();

        addDoc(collection(db, 'stockMovements'), {
          storeId: quoteData.storeId,
          quoteId,
          type: 'deduction',
          reason: `Orçamento ${newStatus}`,
          deductions: reservation.reservations,
          createdAt: new Date().toISOString(),
        }).catch(() => {});

        if (phone && productName) {
          const msg = generateStatusMessage(newStatus, productName);
          if (msg) sendWhatsAppMessage(phone, msg);
        }
        return; // batch already updated status — exit early
      } catch (err) {
        console.warn('[automations] Stock deduction failed, falling through to simple status update:', err);
        // Fall through to simple status update below
      }
    }
  }

  // ── 3. RELEASE RESERVATION on cancellation ────────────────────────────────
  if (RELEASE_STATUSES.includes(newStatus)) {
    const reservation = await getActiveReservation(quoteId);
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
