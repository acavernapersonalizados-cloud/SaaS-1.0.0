import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

type StockFields = { stockQuantity?: number; minStockQuantity?: number };

/** Estoque baixo: só conta quando há um mínimo definido (> 0) e o saldo chegou nele. */
export function isLowStock(material: StockFields) {
  const min = Number(material.minStockQuantity) || 0;
  return min > 0 && (Number(material.stockQuantity) || 0) <= min;
}

/** Itens por pacote de um material (1 quando não é vendido em pacote). */
export function packageSize(material?: { isPackage?: boolean; unit?: string; packageQuantity?: number } | null) {
  if (!material || !(material.isPackage || material.unit === 'pct')) return 1;
  return Math.max(Number(material.packageQuantity) || 1, 1);
}

/** Arredonda para centavos (2 casas). Campos de preço com step 0,01 recusam valores com mais casas. */
export const roundCents = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

export function formatPercent(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}
