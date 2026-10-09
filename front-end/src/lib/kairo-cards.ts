import type { Solicitation } from '@/services/solicitation';

export function splitCommaList(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function listKairoCardIds(
  item: Pick<Solicitation, 'kairoCardId' | 'kairoCardIds'>,
): string[] {
  const listed = splitCommaList(item.kairoCardIds);
  if (listed.length > 0) return listed;
  return item.kairoCardId ? [item.kairoCardId] : [];
}

export function isProcessPartNumberKairoSend(
  item: Pick<Solicitation, 'department' | 'partNumbers'>,
): boolean {
  return (
    item.department === 'DESENVOLVIMENTO_PROCESSOS' &&
    splitCommaList(item.partNumbers).length > 0
  );
}

export function processPartNumberKairoTitle(
  partNumber: string,
  type: string | null,
): string {
  return `${partNumber} — ${type?.trim() || 'Instrução de processo'}`;
}
