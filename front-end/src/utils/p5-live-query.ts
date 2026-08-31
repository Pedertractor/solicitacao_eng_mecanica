const RECALCULATING_REFETCH_MS = 1_500;

export function refetchWhileRecalculating(recalculating: boolean | undefined) {
  return recalculating ? RECALCULATING_REFETCH_MS : false;
}
