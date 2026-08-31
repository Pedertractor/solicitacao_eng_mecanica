/** Estado bruto do cartão (últimos até 4 dígitos, sem zeros à esquerda redundantes). */
export function parseCardNumberInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  const lastFour = digits.slice(-4);
  return lastFour.replace(/^0+/, '');
}

/** Exibição alinhada ao login: preenche com zeros até 4 caracteres. */
export function displayCardNumber(stored: string): string {
  if (stored.length === 0) return '';
  if (stored.length < 4) return stored.padStart(4, '0');
  return stored;
}

/**
 * Valor enviado em fetches/API: só dígitos, sem zeros à esquerda.
 * Na tela pode aparecer 0017 (`displayCardNumber`); aqui vai "17".
 */
export function cardNumberForApi(stored: string): string {
  const digits = stored.trim().replace(/\D/g, '');
  if (!digits) return '';
  const lastFour = digits.slice(-4);
  return lastFour.replace(/^0+/, '');
}
