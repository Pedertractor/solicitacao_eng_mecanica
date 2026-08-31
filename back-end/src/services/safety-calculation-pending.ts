const pendingCycleIds = new Set<string>();

export function markCycleRecalculating(cycleId: string) {
  pendingCycleIds.add(cycleId);
}

export function clearCycleRecalculating(cycleId: string) {
  pendingCycleIds.delete(cycleId);
}

export function isCycleRecalculating(cycleId: string) {
  return pendingCycleIds.has(cycleId);
}
