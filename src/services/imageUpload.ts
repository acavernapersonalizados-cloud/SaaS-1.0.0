/**
 * imageUpload.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Serviço de upload de imagens para Firebase Storage.
 * Comprime automaticamente antes do upload.
 * Retrocompatível: todos os campos de imagem no Firestore são opcionais.
 */

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

const MAX_WIDTH = 1200;
const THUMB_WIDTH = 400;
const QUALITY = 0.82;

/**
 * Comprime e redimensiona uma imagem antes do upload.
 * Suporte: PNG, JPG, JPEG, WEBP
 */
async function compressImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/webp',
        quality
      );
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}

/**
 * Faz upload de uma imagem de produto.
 * Retorna { imageUrl, thumbnailUrl }
 */
export async function uploadProductImage(
  storeId: string,
  productId: string,
  file: File
): Promise<{ imageUrl: string; thumbnailUrl: string }> {
  const allowed = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error('Formato inválido. Use PNG, JPG, JPEG ou WEBP.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Arquivo muito grande. Máximo 10MB.');
  }

  const timestamp = Date.now();
  const basePath = `stores/${storeId}/products/${productId}`;

  // Compress main + thumbnail in parallel
  const [mainBlob, thumbBlob] = await Promise.all([
    compressImage(file, MAX_WIDTH, QUALITY),
    compressImage(file, THUMB_WIDTH, QUALITY),
  ]);

  const mainRef = ref(storage, `${basePath}/main_${timestamp}.webp`);
  const thumbRef = ref(storage, `${basePath}/thumb_${timestamp}.webp`);

  const [mainSnap, thumbSnap] = await Promise.all([
    uploadBytes(mainRef, mainBlob, { contentType: 'image/webp' }),
    uploadBytes(thumbRef, thumbBlob, { contentType: 'image/webp' }),
  ]);

  const [imageUrl, thumbnailUrl] = await Promise.all([
    getDownloadURL(mainSnap.ref),
    getDownloadURL(thumbSnap.ref),
  ]);

  return { imageUrl, thumbnailUrl };
}

/**
 * Faz upload de imagem adicional para a galeria.
 */
export async function uploadGalleryImage(
  storeId: string,
  productId: string,
  file: File,
  index: number
): Promise<string> {
  const allowed = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error('Formato inválido. Use PNG, JPG, JPEG ou WEBP.');
  }

  const blob = await compressImage(file, MAX_WIDTH, QUALITY);
  const timestamp = Date.now();
  const galleryRef = ref(storage, `stores/${storeId}/products/${productId}/gallery_${index}_${timestamp}.webp`);
  const snap = await uploadBytes(galleryRef, blob, { contentType: 'image/webp' });
  return getDownloadURL(snap.ref);
}

/**
 * Remove uma imagem do Storage pelo URL.
 * Silencia erros — imagem pode já ter sido removida.
 */
export async function deleteImageByUrl(url: string): Promise<void> {
  try {
    const imageRef = ref(storage, url);
    await deleteObject(imageRef);
  } catch {
    // Silent — file may already be deleted
  }
}
