/** Tamanho máximo do ficheiro da nota (validado também em disco após parse). */
export const MAX_RECEIPT_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Limite do corpo da requisição multipart (ficheiro + campos de formulário + overhead).
 * Deve ser ≥ MAX_RECEIPT_FILE_BYTES.
 */
export const MAX_MULTIPART_BODY_BYTES = MAX_RECEIPT_FILE_BYTES + 1024 * 1024;

export const RECEIPT_FILE_TOO_LARGE_MESSAGE =
  'O peso da foto é maior que 5 MB.';
