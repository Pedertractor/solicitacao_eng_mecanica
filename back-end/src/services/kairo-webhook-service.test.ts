import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  findSolicitations: vi.fn(), findStages: vi.fn(), sync: vi.fn(), tooling: vi.fn(), sample: vi.fn(),
}));
vi.mock('../lib/prisma.js', () => ({ prisma: {
  solicitation: { findMany: mocks.findSolicitations }, solicitationWorkflowStage: { findMany: mocks.findStages },
} }));
vi.mock('./solicitation-service.js', () => ({ SolicitationService: class { syncFromKairo = mocks.sync; } }));
vi.mock('./workflow-service.js', () => ({ WorkflowService: class {
  syncToolingFromKairo = mocks.tooling; syncSampleFromKairo = mocks.sample;
} }));
import { syncKairoWebhookCard } from './kairo-webhook-service.js';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findSolicitations.mockResolvedValue([]);
  mocks.findStages.mockResolvedValue([]);
});
describe('targeted Kairo synchronization', () => {
  it('matches legacy and comma-separated engineering IDs exactly', async () => {
    mocks.findSolicitations.mockResolvedValue([
      { id: 'engineering', kairoCardId: null, kairoCardIds: 'other, card-1' },
      { id: 'substring', kairoCardId: null, kairoCardIds: 'card-10' },
      { id: 'legacy', kairoCardId: 'card-1', kairoCardIds: null },
    ]);
    expect(await syncKairoWebhookCard('team-1', 'card-1')).toEqual({ synced: 2 });
    expect(mocks.sync.mock.calls).toEqual([['engineering'], ['legacy']]);
    expect(mocks.findSolicitations.mock.calls[0][0].where.kairoTeamId).toBe('team-1');
  });
  it('updates tooling and sample using their existing synchronization rules', async () => {
    mocks.findStages.mockResolvedValue([
      { solicitationId: 'tooling', stage: 'FERRAMENTARIA', kairoCardIds: 'card-1,another' },
      { solicitationId: 'sample', stage: 'AMOSTRA', kairoCardIds: 'card-1' },
      { solicitationId: 'unrelated', stage: 'AMOSTRA', kairoCardIds: 'card-10' },
    ]);
    expect(await syncKairoWebhookCard('team-1', 'card-1')).toEqual({ synced: 2 });
    expect(mocks.tooling.mock.calls).toEqual([['tooling']]);
    expect(mocks.sample.mock.calls).toEqual([['sample']]);
  });
  it('acknowledges unrelated cards without updating any solicitation', async () => {
    expect(await syncKairoWebhookCard('team-1', 'unlinked')).toEqual({ synced: 0 });
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it('propagates failures so the sender can retry', async () => {
    mocks.findStages.mockResolvedValue([{ solicitationId: 'sample', stage: 'AMOSTRA', kairoCardIds: 'card-1' }]);
    mocks.sample.mockRejectedValue(new Error('offline'));
    await expect(syncKairoWebhookCard('team-1', 'card-1')).rejects.toThrow('offline');
  });
});
