import { describe, expect, it } from 'vitest';
import { collectKairoLinks } from './kairo-links.js';
const base = { kind: 'PROJETO' as const, kairoTeamId: 'engineering', kairoCardId: 'project', kairoSyncedByUserId: 'engineer' };
describe('all linked Kairo cards', () => {
  it('keeps an unknown legacy kind available for runtime lookup', () => {
    expect(collectKairoLinks({ ...base, kind: null })[0]?.kind).toBeNull();
  });
  it('retains the legacy single project and its credential owner', () => {
    expect(collectKairoLinks(base)).toEqual([{ teamId: 'engineering', cardId: 'project', kind: 'PROJETO', userId: 'engineer' }]);
  });
  it('includes stage cards from separate teams and their credential owners', () => {
    expect(collectKairoLinks({ ...base, workflowStages: [{ stage: 'FERRAMENTARIA', kairoTeamId: 'tooling', kairoCardIds: 'one, two', kairoSyncedByUserId: 'toolmaker' }] })).toHaveLength(3);
    expect(collectKairoLinks({ ...base, workflowStages: [{ stage: 'FERRAMENTARIA', kairoTeamId: 'tooling', kairoCardIds: 'one', kairoSyncedByUserId: 'toolmaker' }] })[1]).toEqual({teamId:'tooling',cardId:'one',kind:'ATIVIDADE',userId:'toolmaker'});
  });
  it('deduplicates engineering and repeated stage references', () => {
    expect(collectKairoLinks({ ...base, kairoCardIds: 'project, project', workflowStages: [{ stage:'ENGENHARIA',kairoTeamId:'engineering',kairoCardIds:'project',kairoSyncedByUserId:'engineer'}] })).toHaveLength(1);
  });
  it('ignores empty links and includes direct tooling without an engineering card', () => {
    expect(collectKairoLinks({ ...base, kairoTeamId:null,kairoCardId:null,workflowStages:[{stage:'FERRAMENTARIA',kairoTeamId:'tooling',kairoCardIds:' card, ',kairoSyncedByUserId:'toolmaker'}]})).toEqual([{teamId:'tooling',cardId:'card',kind:'ATIVIDADE',userId:'toolmaker'}]);
  });
});
