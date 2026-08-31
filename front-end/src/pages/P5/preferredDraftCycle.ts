import type { MonthlyCycle } from '@/services/p5';

export function preferredDraftCycle(
  drafts: MonthlyCycle[],
  now = new Date(),
): MonthlyCycle | null {
  if (drafts.length === 0) return null;
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return (
    drafts.find((cycle) => cycle.month === month && cycle.year === year) ??
    drafts[0] ??
    null
  );
}
