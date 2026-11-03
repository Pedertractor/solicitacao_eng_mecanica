type LinkedRow = {
  kind: 'PROJETO' | 'ATIVIDADE' | null;
  kairoTeamId: string | null;
  kairoCardId: string | null;
  kairoCardIds?: string | null;
  kairoSyncedByUserId?: string | null;
  workflowStages?: Array<{
    stage: string; kairoTeamId: string | null; kairoCardIds: string | null; kairoSyncedByUserId: string | null;
  }>;
};

/** Include stage cards as well as the original engineering card, without duplicates. */
export function collectKairoLinks(row: LinkedRow) {
  const links = new Map<string, { teamId: string; cardId: string; kind: 'PROJETO' | 'ATIVIDADE' | null; userId: string | null }>();
  const add = (teamId: string | null, ids: string | null | undefined, kind: 'PROJETO' | 'ATIVIDADE' | null, userId: string | null | undefined) => {
    if (!teamId) return;
    for (const cardId of ids?.split(',').map((id) => id.trim()).filter(Boolean) ?? []) {
      const key = `${teamId}:${cardId}`;
      if (!links.has(key)) links.set(key, { teamId, cardId, kind, userId: userId ?? null });
    }
  };
  add(row.kairoTeamId, row.kairoCardIds?.trim() || row.kairoCardId, row.kind, row.kairoSyncedByUserId);
  for (const stage of row.workflowStages ?? []) {
    add(stage.kairoTeamId, stage.kairoCardIds, stage.stage === 'ENGENHARIA' ? row.kind : 'ATIVIDADE', stage.kairoSyncedByUserId);
  }
  return [...links.values()];
}
