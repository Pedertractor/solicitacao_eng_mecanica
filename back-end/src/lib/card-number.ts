/** Normaliza cartão para comparação (últimos 4 dígitos, sem zeros à esquerda). */
export function normalizeCardNumber(value: number | string): string {
  const digits = String(value).replace(/\D/g, '');
  const lastFour = digits.slice(-4);
  const trimmed = lastFour.replace(/^0+/, '');
  return trimmed.length > 0 ? trimmed : '0';
}
