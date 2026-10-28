/**
 * Número para o WhatsApp (Estacionamento item 17, regra aprovada em 28/10/2026): só os dígitos, com o 55 do Brasil
 * na frente, a menos que o número já comece com 55 e tenha 12 ou 13 dígitos (aí já está com o país).
 */
export function whatsappNumber(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') && (digits.length === 12 || digits.length === 13) ? digits : `55${digits}`;
}

/** Link do WhatsApp com a mensagem pronta (abre só quando a pessoa clica). */
export const whatsappLink = (phone: string, message: string) =>
  `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(message)}`;

export function generateQuoteMessage(quote: any) {
  return `Olá ${quote.clientName}! Segue o orçamento para *${quote.productName}* (${quote.quantity} un).
Valor Total: R$ ${(quote.unitPrice * quote.quantity).toFixed(2)}
Validade: 5 dias úteis.
Como podemos prosseguir? 😊`;
}

export function generateStatusMessage(status: string, productName: string) {
  switch (status) {
    case 'Aprovado':
      return `Seu pedido de *${productName}* foi aprovado ✅`;
    case 'Em produção':
      return `Seu pedido de *${productName}* já está em produção 🔥`;
    case 'Finalizado':
      return `Seu pedido de *${productName}* está pronto 🎉`;
    default:
      return '';
  }
}
