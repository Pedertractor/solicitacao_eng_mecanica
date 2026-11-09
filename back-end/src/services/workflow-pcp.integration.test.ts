import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { WorkflowStagePrismaRepository } from '../repositories/prisma/workflow-stage-repository.js';
import { WorkflowService } from './workflow-service.js';
import { SolicitationService } from './solicitation-service.js';

const kairo = vi.hoisted(() => ({ createActivity: vi.fn(), getActivity: vi.fn(), cancelActivity: vi.fn(), cancelProject: vi.fn(), unavailable: false }));
const mail = vi.hoisted(() => ({ completed: vi.fn() }));
vi.mock('../lib/solicitation-mail.js', () => ({
  notifySolicitationCompleted: mail.completed,
  notifySolicitationCreated: vi.fn(), notifySolicitationApproved: vi.fn(), notifySolicitationDeleted: vi.fn(),
}));
vi.mock('./kairo-credential-service.js', () => ({ KairoCredentialService: class {
  async getClientForUser() { return kairo; }
  async tryGetClientForUser() { return kairo.unavailable ? null : kairo; }
  async touchValidated() {}
} }));

// Explicitly opt in with a disposable PostgreSQL database; never use the app database.
const testUrl = process.env.WORKFLOW_TEST_DATABASE_URL;
describe.skipIf(!testUrl)('PCP workflow against PostgreSQL', () => {
  const pool = new Pool({ connectionString: testUrl });
  const repo = new WorkflowStagePrismaRepository(prisma);
  const service = new WorkflowService();
  let pcpUserId: string;
  let sampleUserId: string;
  let toolingUserId: string;
  let qualityUserId: string;
  let engineeringUserId: string;
  const legacy = new Map<string, string>();

  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (!/^\/pcp_workflow_test(?:_\d+)?$/.test(url.pathname) || !['localhost', '127.0.0.1'].includes(url.hostname)
      || process.env.DATABASE_URL !== testUrl) throw new Error('Use the disposable local pcp_workflow_test database for both URLs');
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    const migrations = (await readdir('prisma/migrations')).filter((file) => /^\d/.test(file)).sort();
    for (const migration of migrations.filter((name) => name < '20261023120000')) {
      await pool.query(await readFile(`prisma/migrations/${migration}/migration.sql`, 'utf8'));
    }
    for (const [name, tooling, engineering, tool, sample, status, linked] of [
      ['new-tool', true, 'PENDING', 'PENDING', 'PENDING', 'APPROVED', false],
      ['working-tool', true, 'IN_PROGRESS', 'IN_PROGRESS', 'PENDING', 'APPROVED', true],
      ['tool-done', true, 'IN_PROGRESS', 'DONE', 'READY', 'APPROVED', true],
      ['sample-linked', false, 'DONE', null, 'READY', 'APPROVED', true],
      ['sample-start-date', false, 'DONE', null, 'READY', 'APPROVED', false],
      ['sample-working', true, 'DONE', 'DONE', 'IN_PROGRESS', 'APPROVED', true],
      ['no-tool-open', false, 'IN_PROGRESS', null, 'PENDING', 'APPROVED', false],
      ['no-tool-done', false, 'DONE', null, 'READY', 'APPROVED', false],
      ['closed', true, 'DONE', 'DONE', 'DONE', 'COMPLETED', true],
      ['cancelled', true, 'DONE', 'CANCELLED', 'CANCELLED', 'CANCELLED', false],
      ['deleted', false, 'CANCELLED', null, 'CANCELLED', 'DELETED', false],
    ] as const) {
      const id = randomUUID();
      legacy.set(name, id);
      await pool.query(`INSERT INTO "Solicitation" ("id", "trackingCode", "employeeId", "requesterName", "cardNumber", "unit", "costCenter", "sectorId", "sectorName", "pillarOrLocation", "title", "description", "department", "processInstructionRequester", "requiresTooling", "status", "updatedAt")
        VALUES ($1, $1, 'test', 'Test', '123', 'PEDERTRACTOR', '1', '1', 'Test', 'Test', 'Test', 'Test', 'DESENVOLVIMENTO_PROCESSOS', 'Comercial', $2, $3, CURRENT_TIMESTAMP)`, [id, tooling, status]);
      for (const [stage, stageStatus, order] of [['ENGENHARIA', engineering, 0], ['FERRAMENTARIA', tool, 1], ['AMOSTRA', sample, tooling ? 2 : 1]] as const) {
        if (!stageStatus) continue;
        await pool.query(`INSERT INTO "SolicitationWorkflowStage" ("id", "solicitationId", "stage", "status", "order", "actualStartAt", "kairoCardIds", "kairoTeamId", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $8, $6, $7, CURRENT_TIMESTAMP)`,
        [randomUUID(), id, stage, stageStatus, order, linked && stage !== 'ENGENHARIA' && ((stageStatus !== 'PENDING' && stageStatus !== 'READY') || name === 'sample-linked') ? `${name}-${stage}` : null, linked ? 'team' : null, ['IN_PROGRESS', 'DONE'].includes(stageStatus) || name === 'sample-start-date' ? '2026-10-20T12:00:00Z' : null]);
      }
    }
    for (const migration of migrations.filter((name) => name >= '20261023120000')) {
      if (migration.startsWith('20261103120000')) {
        for (const role of ['PCP', 'COMERCIAL']) {
          await pool.query(`INSERT INTO "User" ("id", "employeeId", "name", "cardNumber", "unit", "passwordHash", "role", "department", "updatedAt") VALUES ($1, $1, $1, $1, 'PEDERTRACTOR', 'test', $2::"UserRole", 'DESENVOLVIMENTO_PROCESSOS', CURRENT_TIMESTAMP)`, ['legacy-' + role, role]);
        }
      }
      await pool.query(await readFile(`prisma/migrations/${migration}/migration.sql`, 'utf8'));
    }
    for (const department of ['PCP', 'COMERCIAL'] as const) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: 'legacy-' + department } });
      expect(user).toMatchObject({ role: 'ADMIN', department, active: true, approvalStatus: 'APPROVED' });
    }
    await expect(pool.query(`UPDATE "User" SET "role" = 'PCP' WHERE "id" = 'legacy-PCP'`)).rejects.toThrow();
    for (const [role, department, cardNumber] of [['ADMIN', 'PCP', 'pcp'], ['ADMIN', 'AMOSTRA', 'sample'], ['ADMIN', 'FERRAMENTARIA', 'tool'], ['ADMIN', 'QUALIDADE', 'quality'], ['ADMIN', 'DESENVOLVIMENTO_PROCESSOS', 'engineering']] as const) {
      const user = await prisma.user.create({ data: { employeeId: cardNumber, name: cardNumber, cardNumber,
        unit: 'PEDERTRACTOR', role, department, passwordHash: 'test', mustChangePassword: false } });
      if (department === 'PCP') pcpUserId = user.id;
      else if (department === 'AMOSTRA') sampleUserId = user.id;
      else if (department === 'QUALIDADE') qualityUserId = user.id;
      else if (department === 'DESENVOLVIMENTO_PROCESSOS') engineeringUserId = user.id;
      else toolingUserId = user.id;
    }
  }, 60_000);
  afterAll(async () => { await prisma.$disconnect(); await pool.end(); });
  beforeEach(() => {
    vi.clearAllMocks();
    kairo.unavailable = false;
    kairo.cancelActivity.mockReset().mockResolvedValue({});
    kairo.cancelProject.mockReset().mockResolvedValue({});
    kairo.createActivity.mockResolvedValue({ activity: { id: 'pcp-card' } });
    kairo.getActivity.mockResolvedValue({ activity: { id: 'pcp-card', status: 'DONE', deletedAt: null, updatedAt: '2026-10-23T12:00:00Z' } });
  });

  async function create(tooling = true, completeQuality = true, legacyFlow = true) {
    const id = randomUUID();
    const initialStages = service.buildStagesForCreate({ requester: 'Comercial', process: 'Engenharia',
      type: 'Desenvolvimento Amostra', deliveryDateIso: '2026-11-10', requiresTooling: tooling });
    // Existing tests also cover worked workflows that retain the old PCP gate.
    if (tooling && legacyFlow) {
      const toolingStage = initialStages.find((stage) => stage.stage === 'FERRAMENTARIA')!;
      toolingStage.status = 'PENDING';
      toolingStage.order = 2;
      const pcp = initialStages.find((stage) => stage.stage === 'PCP_FERRAMENTARIA')!;
      pcp.status = 'READY';
      pcp.order = 1;
    }
    const created = await prisma.solicitation.create({ data: { id, trackingCode: id, employeeId: 'test', requesterName: 'Test',
      cardNumber: '123', unit: 'PEDERTRACTOR', costCenter: '1', sectorId: '1', sectorName: 'Test',
      pillarOrLocation: 'Test', title: 'Test', description: 'Test', department: 'DESENVOLVIMENTO_PROCESSOS',
      processInstructionRequester: 'Comercial', requiresTooling: tooling, status: 'APPROVED',
      workflowStages: { create: initialStages } }, include: { workflowStages: true } });
    if (completeQuality) await finishQuality(id);
    return created;
  }
  async function finishQuality(id: string) {
    await service.updateQualityStage(id, 'start', qualityUserId);
    await service.updateQualityStage(id, 'finish', qualityUserId);
  }
  const stages = (id: string) => repo.findBySolicitationId(id);
  async function status(id: string, stage: string) { return (await stages(id)).find((item) => item.stage === stage)?.status; }
  async function finishPcp(id: string, stage: 'PCP_FERRAMENTARIA' | 'PCP_AMOSTRA') {
    await service.updatePcpStage(id, stage, 'start', pcpUserId);
    await service.updatePcpStage(id, stage, 'finish', pcpUserId);
  }

  it('starts tooling immediately and releases the two PCP registrations in sequence', async () => {
    const item = await create(true, false, false);
    expect(await status(item.id, 'PCP_FERRAMENTARIA')).toBe('PENDING');
    expect(await status(item.id, 'FERRAMENTARIA')).toBe('READY');
    await expect(service.updatePcpStage(item.id, 'PCP_FERRAMENTARIA', 'start', pcpUserId)).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.updatePcpStage(item.id, 'PCP_AMOSTRA', 'start', pcpUserId)).rejects.toMatchObject({ statusCode: 400 });
    await service.sendToolingToKairo(item.id, { teamId: 'team' }, toolingUserId);
    await service.syncToolingFromKairo(item.id, toolingUserId);
    expect(await status(item.id, 'FERRAMENTARIA')).toBe('DONE');
    expect(await status(item.id, 'PCP_FERRAMENTARIA')).toBe('READY');
    expect(await status(item.id, 'PCP_AMOSTRA')).toBe('PENDING');
    expect(await status(item.id, 'ENGENHARIA')).toBe('PENDING');
    await expect(service.updatePcpStage(item.id, 'PCP_AMOSTRA', 'start', pcpUserId)).rejects.toMatchObject({ statusCode: 400 });
    await finishPcp(item.id, 'PCP_FERRAMENTARIA');
    expect(await status(item.id, 'PCP_AMOSTRA')).toBe('READY');
    await finishPcp(item.id, 'PCP_AMOSTRA');
    expect(await status(item.id, 'AMOSTRA')).toBe('PENDING');
    await repo.markEngineeringFinished(item.id, new Date());
    expect(await status(item.id, 'AMOSTRA')).toBe('PENDING');
    await finishQuality(item.id);
    expect(await status(item.id, 'AMOSTRA')).toBe('READY');
    await service.syncToolingFromKairo(item.id, toolingUserId);
    expect((await stages(item.id)).filter((stage) => stage.stage.startsWith('PCP_'))).toHaveLength(2);
  });

  async function createDirect() {
    const id = randomUUID();
    return prisma.solicitation.create({ data: {
      trackingCode: id.toUpperCase(), employeeId: 'test', requesterName: 'Test', cardNumber: '123',
      unit: 'PEDERTRACTOR', executionUnit: 'TRACTOR', directTooling: true, requiresTooling: true,
      costCenter: '1', sectorId: '1', sectorName: 'Test', pillarOrLocation: 'Test',
      title: 'Direct tooling', description: 'Test', department: 'DESENVOLVIMENTO_PROCESSOS',
      processInstructionRequester: 'Comercial',
      workflowStages: { create: service.buildStagesForCreate({ requester: 'Comercial', process: 'Engenharia',
        type: 'Desenvolvimento Amostra', deliveryDateIso: null, requiresTooling: true, directTooling: true }) },
    }, include: { workflowStages: true } });
  }

  it('restores the removed registration without resetting downstream work and is repeatable', async () => {
    const item = await create(true, false, false);
    await prisma.solicitationWorkflowStage.delete({ where: { solicitationId_stage: {
      solicitationId: item.id, stage: 'PCP_FERRAMENTARIA',
    } } });
    await repo.markToolingFinished(item.id, new Date());
    await service.updatePcpStage(item.id, 'PCP_AMOSTRA', 'start', pcpUserId);
    const before = (await stages(item.id)).find((stage) => stage.stage === 'PCP_AMOSTRA')!;
    const sql = await readFile('prisma/migrations/20261109110000_restore_two_pcp_registrations/migration.sql', 'utf8');
    await pool.query(sql);
    await pool.query(sql);
    expect(await status(item.id, 'PCP_FERRAMENTARIA')).toBe('DONE');
    const after = (await stages(item.id)).find((stage) => stage.stage === 'PCP_AMOSTRA')!;
    expect(after.status).toBe('IN_PROGRESS');
    expect(after.actualStartAt).toEqual(before.actualStartAt);
    expect((await stages(item.id)).filter((stage) => stage.stage.startsWith('PCP_'))).toHaveLength(2);
  });

  async function createSimulation() {
    const item = await create(false, false);
    await prisma.solicitationWorkflowStage.deleteMany({ where: { solicitationId: item.id, stage: { not: 'ENGENHARIA' } } });
    return prisma.solicitation.update({ where: { id: item.id }, data: {
      trackingCode: item.trackingCode.toUpperCase(), processInstructionProcess: 'Corte', processInstructionType: 'Simulação Comercial',
    }, include: { workflowStages: true } });
  }

  async function createCommercialTooling() {
    const id = randomUUID();
    return prisma.solicitation.create({ data: {
      id, trackingCode: id.toUpperCase(), employeeId: 'test', requesterName: 'Test', cardNumber: '123',
      unit: 'PEDERTRACTOR', executionUnit: 'TRACTOR', directTooling: true, requiresTooling: true,
      costCenter: '1', sectorId: '1', sectorName: 'Test', pillarOrLocation: 'Test',
      title: 'Simulação Comercial — Ferramentaria', description: 'Test', department: 'FERRAMENTARIA',
      processInstructionRequester: 'Comercial', processInstructionType: 'Simulação Comercial',
      workflowStages: { create: service.buildStagesForCreate({ department: 'FERRAMENTARIA', requester: 'Comercial',
        process: '', type: 'Simulação Comercial', deliveryDateIso: null, requiresTooling: true }) },
    }, include: { workflowStages: true } });
  }

  it('sends the new single tooling stage to Kairo immediately and closes after synchronization', async () => {
    const item = await createCommercialTooling();
    expect(item.workflowStages).toHaveLength(1);
    expect(await status(item.id, 'FERRAMENTARIA')).toBe('READY');
    await service.sendToolingToKairo(item.id, { teamId: 'team' }, toolingUserId);
    expect(kairo.createActivity).toHaveBeenCalledTimes(1);
    await service.syncToolingFromKairo(item.id, toolingUserId);
    expect(await status(item.id, 'FERRAMENTARIA')).toBe('DONE');
    expect((await prisma.solicitation.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('COMPLETED');
    expect(mail.completed).toHaveBeenCalledTimes(1);
    await expect(service.addTooling(item.id, engineeringUserId)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('closes the new direct workflow when tooling declines and denies unrelated departments', async () => {
    const item = await createCommercialTooling();
    for (const user of [pcpUserId, sampleUserId, qualityUserId]) {
      await expect(service.sendToolingToKairo(item.id, { teamId: 'team' }, user)).rejects.toMatchObject({ statusCode: 403 });
    }
    await service.declineStage(item.id, 'FERRAMENTARIA', 'Sem necessidade', toolingUserId);
    expect(await status(item.id, 'FERRAMENTARIA')).toBe('REJECTED');
    expect((await prisma.solicitation.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('COMPLETED');
    expect(mail.completed).toHaveBeenCalledTimes(1);
  });

  it('adds simulation tooling idempotently in parallel and reuses Kairo until both fronts finish', async () => {
    const item = await createSimulation();
    await repo.markEngineeringStarted(item.id, new Date());
    const results = await Promise.all([service.addTooling(item.id, engineeringUserId), service.addTooling(item.id, engineeringUserId)]);
    expect(results.every((result) => result.requiresTooling)).toBe(true);
    expect((await stages(item.id)).map((stage) => stage.stage)).toEqual(['ENGENHARIA', 'FERRAMENTARIA']);
    expect(await status(item.id, 'FERRAMENTARIA')).toBe('READY');
    expect(kairo.createActivity).not.toHaveBeenCalled();
    await service.sendToolingToKairo(item.id, { teamId: 'team' }, toolingUserId);
    await service.syncToolingFromKairo(item.id, toolingUserId);
    expect(await status(item.id, 'FERRAMENTARIA')).toBe('DONE');
    expect((await prisma.solicitation.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('APPROVED');
    await repo.markEngineeringFinished(item.id, new Date());
    expect((await prisma.solicitation.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('COMPLETED');
    expect(mail.completed).toHaveBeenCalledTimes(1);
    await expect(service.addTooling(item.id, engineeringUserId)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('finishes simulations without tooling and serializes addition against engineering completion', async () => {
    const single = await createSimulation();
    await repo.markEngineeringFinished(single.id, new Date());
    expect((await prisma.solicitation.findUniqueOrThrow({ where: { id: single.id } })).status).toBe('COMPLETED');
    for (let index = 0; index < 4; index++) {
      const item = await createSimulation();
      const [addition] = await Promise.allSettled([repo.addSimulationTooling(item.id), repo.markEngineeringFinished(item.id, new Date())]);
      const parent = await prisma.solicitation.findUniqueOrThrow({ where: { id: item.id }, include: { workflowStages: true } });
      if (addition.status === 'fulfilled') {
        expect(parent.status).toBe('APPROVED');
        expect(parent.requiresTooling).toBe(true);
        expect(parent.workflowStages).toHaveLength(2);
        await repo.markToolingFinished(item.id, new Date());
      } else {
        expect(parent.status).toBe('COMPLETED');
        expect(parent.requiresTooling).toBe(false);
        expect(parent.workflowStages).toHaveLength(1);
      }
    }
  });

  it('denies inclusion outside engineering management and in legacy modes', async () => {
    const item = await createSimulation();
    for (const user of [pcpUserId, toolingUserId, sampleUserId, qualityUserId]) {
      await expect(service.addTooling(item.id, user)).rejects.toMatchObject({ statusCode: 403 });
    }
    const standard = await create();
    await expect(service.addTooling(standard.id, engineeringUserId)).rejects.toMatchObject({ statusCode: 400 });
    expect(await stages(item.id)).toHaveLength(1);
  });

  it('waits for tooling after engineering finishes and accepts tooling rejection', async () => {
    const item = await createSimulation();
    await service.addTooling(item.id, engineeringUserId);
    await repo.markEngineeringFinished(item.id, new Date());
    expect((await prisma.solicitation.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('APPROVED');
    await service.declineStage(item.id, 'FERRAMENTARIA', 'Sem necessidade', toolingUserId);
    expect((await prisma.solicitation.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('COMPLETED');
  });

  it('converts only untouched simulations, preserves engineering and does not remove tooling on rerun', async () => {
    const item = await create(true, false);
    await prisma.solicitation.update({ where: { id: item.id }, data: { processInstructionType: 'Simulação Comercial' } });
    await repo.markEngineeringStarted(item.id, new Date());
    const before = (await stages(item.id)).find((stage) => stage.stage === 'ENGENHARIA');
    expect((await repo.convertCommercialSimulation(item.id)).eligible).toBe(true);
    const converted = await prisma.solicitation.findUniqueOrThrow({ where: { id: item.id }, include: { workflowStages: true } });
    expect(converted).toMatchObject({ requiresTooling: false, directTooling: false });
    expect(converted.workflowStages).toEqual([before]);
    await service.addTooling(item.id, engineeringUserId);
    expect((await repo.convertCommercialSimulation(item.id)).eligible).toBe(false);
    expect(await stages(item.id)).toHaveLength(2);
    const worked = await create(true, false);
    await prisma.solicitation.update({ where: { id: worked.id }, data: { processInstructionType: 'Simulação Comercial' } });
    await finishPcp(worked.id, 'PCP_FERRAMENTARIA');
    const untouched = await stages(worked.id);
    expect((await repo.convertCommercialSimulation(worked.id)).eligible).toBe(false);
    expect(await stages(worked.id)).toEqual(untouched);
  });

  it('resolves converted finished engineering once and revalidates conversion under lock', async () => {
    const item = await create(false, false);
    await prisma.solicitation.update({ where: { id: item.id }, data: { processInstructionType: 'Simulação Comercial' } });
    await repo.markEngineeringFinished(item.id, new Date());
    expect((await repo.convertCommercialSimulation(item.id)).eligible).toBe(true);
    expect((await prisma.solicitation.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('COMPLETED');
    expect((await repo.convertCommercialSimulation(item.id)).eligible).toBe(false);
    expect(mail.completed).toHaveBeenCalledTimes(1);
    const racing = await create(false, false);
    await prisma.solicitation.update({ where: { id: racing.id }, data: { processInstructionType: 'Simulação Comercial' } });
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Solicitation" WHERE "id" = ${racing.id} FOR UPDATE`;
      await tx.solicitationWorkflowStage.update({ where: { solicitationId_stage: { solicitationId: racing.id, stage: 'QUALIDADE' } },
        data: { kairoTeamId: 'team', kairoCardIds: 'card' } });
    });
    expect((await repo.convertCommercialSimulation(racing.id)).eligible).toBe(false);
    expect(await stages(racing.id)).toHaveLength(4);
  });

  it('runs direct tooling through PCP and Kairo, completing without Engineering or Amostra', async () => {
    const item = await createDirect();
    expect(item).toMatchObject({ unit: 'PEDERTRACTOR', executionUnit: 'TRACTOR', directTooling: true });
    expect(item.workflowStages).toHaveLength(2);
    await prisma.solicitation.update({ where: { id: item.id }, data: { status: 'APPROVED' } });
    await expect(new SolicitationService().sendToKairo(item.id, { teamId: 'team', kind: 'ATIVIDADE', title: 'Test', description: 'Test' }, engineeringUserId))
      .rejects.toThrow('Fluxo direto para Ferramentaria não possui etapa de Engenharia');
    await expect(service.sendToolingToKairo(item.id, { teamId: 'team' }, toolingUserId)).rejects.toMatchObject({ statusCode: 400 });
    expect(kairo.createActivity).not.toHaveBeenCalled();
    await finishPcp(item.id, 'PCP_FERRAMENTARIA');
    expect(await status(item.id, 'FERRAMENTARIA')).toBe('READY');
    expect((await prisma.solicitation.findUniqueOrThrow({ where: { id: item.id } })).status).not.toBe('COMPLETED');
    await service.sendToolingToKairo(item.id, { teamId: 'team' }, toolingUserId);
    expect(kairo.createActivity).toHaveBeenCalledTimes(1);
    await service.syncToolingFromKairo(item.id, toolingUserId);
    expect(await status(item.id, 'FERRAMENTARIA')).toBe('DONE');
    expect((await prisma.solicitation.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('COMPLETED');
    expect(mail.completed).toHaveBeenCalledTimes(1);
    await service.syncToolingFromKairo(item.id, toolingUserId);
    expect(mail.completed).toHaveBeenCalledTimes(1);
  });

  it('preserves the direct route after PCP rejection and completes on tooling rejection', async () => {
    const item = await createDirect();
    await service.declineStage(item.id, 'PCP_FERRAMENTARIA', 'Sem planejamento necessário', pcpUserId);
    expect(await status(item.id, 'FERRAMENTARIA')).toBe('READY');
    await service.declineStage(item.id, 'FERRAMENTARIA', 'Sem execução necessária', toolingUserId);
    expect((await prisma.solicitation.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('COMPLETED');
    expect(await stages(item.id)).toHaveLength(2);
  });

  it('backfills gates and preserves existing work and closed history', async () => {
    expect(await prisma.solicitation.findUniqueOrThrow({ where: { id: legacy.get('new-tool')! } }))
      .toMatchObject({ executionUnit: null, directTooling: false });
    expect(await status(legacy.get('new-tool')!, 'PCP_FERRAMENTARIA')).toBe('PENDING');
    expect(await status(legacy.get('new-tool')!, 'FERRAMENTARIA')).toBe('READY');
    expect(await status(legacy.get('working-tool')!, 'PCP_FERRAMENTARIA')).toBe('DONE');
    const working = (await stages(legacy.get('working-tool')!)).find((stage) => stage.stage === 'FERRAMENTARIA')!;
    expect(working.status).toBe('IN_PROGRESS');
    expect(working.kairoCardIds).toBe('working-tool-FERRAMENTARIA');
    expect(working.actualStartAt?.toISOString()).toBe('2026-10-20T12:00:00.000Z');
    expect(await status(legacy.get('tool-done')!, 'PCP_AMOSTRA')).toBe('READY');
    expect(await status(legacy.get('tool-done')!, 'AMOSTRA')).toBe('PENDING');
    expect(await status(legacy.get('sample-working')!, 'PCP_AMOSTRA')).toBe('DONE');
    expect(await status(legacy.get('sample-working')!, 'AMOSTRA')).toBe('IN_PROGRESS');
    expect(await status(legacy.get('no-tool-open')!, 'PCP_AMOSTRA')).toBe('PENDING');
    expect(await status(legacy.get('no-tool-done')!, 'PCP_AMOSTRA')).toBe('READY');
    expect(await status(legacy.get('no-tool-done')!, 'AMOSTRA')).toBe('PENDING');
    for (const name of ['closed', 'cancelled', 'deleted']) {
      expect((await stages(legacy.get(name)!)).some((stage) => stage.stage.startsWith('PCP_'))).toBe(false);
    }
  });

  it('backfills only sample work without a start or Kairo handoff and is repeatable', async () => {
    for (const name of ['new-tool', 'working-tool', 'tool-done', 'no-tool-open', 'no-tool-done']) {
      const rows = await stages(legacy.get(name)!);
      const quality = rows.find((stage) => stage.stage === 'QUALIDADE')!;
      const sample = rows.find((stage) => stage.stage === 'AMOSTRA')!;
      expect(quality.status).toBe('READY');
      expect(quality.actualStartAt).toBeNull();
      expect(quality.completedByUserId).toBeNull();
      expect(sample.order).toBe(quality.order + 1);
      expect(sample.status).toBe('PENDING');
    }
    for (const name of ['sample-working', 'sample-linked', 'sample-start-date', 'closed', 'cancelled', 'deleted']) {
      expect((await stages(legacy.get(name)!)).some((stage) => stage.stage === 'QUALIDADE')).toBe(false);
    }
    const before = await stages(legacy.get('no-tool-done')!);
    await pool.query(await readFile('prisma/migrations/20261026120100_quality_active_workflows/migration.sql', 'utf8'));
    expect(await stages(legacy.get('no-tool-done')!)).toEqual(before);
  });

  it.each([false, true])('keeps PPAP independent and waits when PPAP finishes first (tooling=%s)', async (tooling) => {
    const item = await create(tooling, false);
    expect(await status(item.id, 'QUALIDADE')).toBe('READY');
    await finishQuality(item.id);
    const quality = (await stages(item.id)).find((stage) => stage.stage === 'QUALIDADE')!;
    expect(quality.actualStartAt).toBeInstanceOf(Date);
    expect(quality.actualEndAt).toBeInstanceOf(Date);
    expect(quality.completedByUserId).toBe(qualityUserId);
    expect(await status(item.id, 'ENGENHARIA')).toBe('PENDING');
    expect(await status(item.id, 'AMOSTRA')).toBe('PENDING');
    await repo.markSampleStarted(item.id, new Date());
    expect(await status(item.id, 'AMOSTRA')).toBe('PENDING');
  });

  it.each([false, true])('allows other sectors to finish but waits for PPAP last (tooling=%s)', async (tooling) => {
    const item = await create(tooling, false);
    await repo.markEngineeringFinished(item.id, new Date());
    if (tooling) {
      await finishPcp(item.id, 'PCP_FERRAMENTARIA');
      await repo.markToolingFinished(item.id, new Date());
    }
    await finishPcp(item.id, 'PCP_AMOSTRA');
    await expect(service.sendSampleToKairo(item.id, { teamId: 'team' }, sampleUserId)).rejects.toMatchObject({ statusCode: 400 });
    expect(await status(item.id, 'AMOSTRA')).toBe('PENDING');
    await finishQuality(item.id);
    expect(await status(item.id, 'AMOSTRA')).toBe('READY');
  });

  it('joins simultaneous Quality, Engineering and PCP completions', async () => {
    const item = await create(true, false);
    await finishPcp(item.id, 'PCP_FERRAMENTARIA');
    await repo.markToolingFinished(item.id, new Date());
    await service.updatePcpStage(item.id, 'PCP_AMOSTRA', 'start', pcpUserId);
    await service.updateQualityStage(item.id, 'start', qualityUserId);
    await Promise.all([
      repo.markEngineeringFinished(item.id, new Date()),
      service.updatePcpStage(item.id, 'PCP_AMOSTRA', 'finish', pcpUserId),
      service.updateQualityStage(item.id, 'finish', qualityUserId),
    ]);
    expect(await status(item.id, 'AMOSTRA')).toBe('READY');
  });

  it('rejects unauthorized, unstarted, repeated and closed Quality actions', async () => {
    const item = await create(false, false);
    await expect(service.updateQualityStage(item.id, 'start', sampleUserId)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.updateQualityStage(item.id, 'finish', qualityUserId)).rejects.toMatchObject({ statusCode: 400 });
    await finishQuality(item.id);
    await expect(service.updateQualityStage(item.id, 'start', qualityUserId)).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.sendQualityToKairo(item.id, { teamId: 'team' }, qualityUserId)).rejects.toMatchObject({ statusCode: 400 });
    const closed = await create(false, false);
    await prisma.solicitation.update({ where: { id: closed.id }, data: { status: 'CANCELLED' } });
    await expect(service.updateQualityStage(closed.id, 'start', qualityUserId)).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.syncQualityFromKairo(closed.id, qualityUserId)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('synchronizes PPAP with Kairo and preserves completed manual work', async () => {
    const item = await create(false, false);
    await service.sendQualityToKairo(item.id, { teamId: 'team' }, qualityUserId);
    expect(kairo.createActivity).toHaveBeenCalledWith('team', expect.objectContaining({ title: item.trackingCode + ' — Qualidade · PPAP', integrationSource: 'solicitacao-eng-mecanica' }));
    await expect(service.sendQualityToKairo(item.id, { teamId: 'team' }, qualityUserId)).rejects.toMatchObject({ statusCode: 400 });
    expect(kairo.createActivity).toHaveBeenCalledTimes(1);
    kairo.getActivity.mockResolvedValueOnce({ activity: { status: 'PAUSED', updatedAt: '2026-10-23T12:00:00Z' } });
    await service.syncQualityFromKairo(item.id, qualityUserId);
    expect(await status(item.id, 'QUALIDADE')).toBe('IN_PROGRESS');
    await service.syncQualityFromKairo(item.id, qualityUserId);
    expect(await status(item.id, 'QUALIDADE')).toBe('DONE');
    expect((await stages(item.id)).find((stage) => stage.stage === 'QUALIDADE')!.completedByUserId).toBe(qualityUserId);
    kairo.getActivity.mockResolvedValue({ activity: { deletedAt: '2026-10-23T13:00:00Z' } });
    await service.syncQualityFromKairo(item.id, qualityUserId);
    expect(await status(item.id, 'QUALIDADE')).toBe('DONE');
    const manual = await create(false, false);
    await service.sendQualityToKairo(manual.id, { teamId: 'team' }, qualityUserId);
    await finishQuality(manual.id);
    await service.syncQualityFromKairo(manual.id, qualityUserId);
    expect(await status(manual.id, 'QUALIDADE')).toBe('DONE');
  });

  it('serializes simultaneous PPAP sends so only one activity is created', async () => {
    const item = await create(false, false);
    const results = await Promise.allSettled([
      service.sendQualityToKairo(item.id, { teamId: 'team' }, qualityUserId),
      service.sendQualityToKairo(item.id, { teamId: 'team' }, qualityUserId),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(kairo.createActivity).toHaveBeenCalledTimes(1);
  });

  it('clears deleted unfinished PPAP activities and does not release Amostra', async () => {
    const item = await create(false, false);
    await service.sendQualityToKairo(item.id, { teamId: 'team' }, qualityUserId);
    await service.updateQualityStage(item.id, 'start', qualityUserId);
    kairo.getActivity.mockResolvedValue({ activity: { deletedAt: '2026-10-23T13:00:00Z' } });
    await service.syncQualityFromKairo(item.id, qualityUserId);
    expect((await stages(item.id)).find((stage) => stage.stage === 'QUALIDADE')).toMatchObject({ status: 'READY', kairoCardIds: null, actualStartAt: null });
    expect(await status(item.id, 'AMOSTRA')).toBe('PENDING');
  });

  it('keeps sample synchronization blocked by PPAP even if a linked card is already done', async () => {
    const item = await create(false, false);
    await repo.markEngineeringFinished(item.id, new Date());
    await finishPcp(item.id, 'PCP_AMOSTRA');
    await repo.setSampleKairo(item.id, { kairoTeamId: 'team', kairoCardIds: 'sample', kairoSyncedByUserId: sampleUserId });
    await service.syncSampleFromKairo(item.id, sampleUserId);
    expect(kairo.getActivity).not.toHaveBeenCalled();
    expect(await status(item.id, 'AMOSTRA')).toBe('PENDING');
    await finishQuality(item.id);
    await service.syncSampleFromKairo(item.id, sampleUserId);
    expect(await status(item.id, 'AMOSTRA')).toBe('DONE');
  });

  it('keeps tooling blocked after engineering finishes until its PCP handoff', async () => {
    const item = await create();
    await repo.markEngineeringFinished(item.id, new Date());
    expect(await status(item.id, 'FERRAMENTARIA')).toBe('PENDING');
    await expect(service.sendToolingToKairo(item.id, { teamId: 'team' }, toolingUserId)).rejects.toMatchObject({ statusCode: 400 });
    expect(kairo.createActivity).not.toHaveBeenCalled();
  });

  it('allows tooling in parallel and waits for engineering at the final join', async () => {
    const item = await create();
    await finishPcp(item.id, 'PCP_FERRAMENTARIA');
    expect(await status(item.id, 'ENGENHARIA')).toBe('PENDING');
    await service.sendToolingToKairo(item.id, { teamId: 'team' }, toolingUserId);
    await repo.markToolingFinished(item.id, new Date());
    await finishPcp(item.id, 'PCP_AMOSTRA');
    expect(await status(item.id, 'AMOSTRA')).toBe('PENDING');
    await expect(service.sendSampleToKairo(item.id, { teamId: 'team' }, sampleUserId)).rejects.toMatchObject({ statusCode: 400 });
    await repo.markEngineeringFinished(item.id, new Date());
    expect(await status(item.id, 'AMOSTRA')).toBe('READY');
    await service.sendSampleToKairo(item.id, { teamId: 'team' }, sampleUserId);
    expect((await stages(item.id)).find((stage) => stage.stage === 'PCP_AMOSTRA')?.completedByUserId).toBe(pcpUserId);
  });

  it('releases Amostra when independent branch completions arrive concurrently', async () => {
    const item = await create();
    await finishPcp(item.id, 'PCP_FERRAMENTARIA');
    await repo.markToolingFinished(item.id, new Date());
    await service.updatePcpStage(item.id, 'PCP_AMOSTRA', 'start', pcpUserId);
    await Promise.all([repo.markEngineeringFinished(item.id, new Date()), service.updatePcpStage(item.id, 'PCP_AMOSTRA', 'finish', pcpUserId)]);
    expect(await status(item.id, 'AMOSTRA')).toBe('READY');
  });

  it('runs Engenharia → PCP → Amostra without tooling and records manual audit dates', async () => {
    const item = await create(false);
    await expect(service.updatePcpStage(item.id, 'PCP_AMOSTRA', 'start', pcpUserId)).rejects.toMatchObject({ statusCode: 400 });
    await repo.markEngineeringFinished(item.id, new Date());
    expect(await status(item.id, 'PCP_AMOSTRA')).toBe('READY');
    expect(await status(item.id, 'AMOSTRA')).toBe('PENDING');
    await finishPcp(item.id, 'PCP_AMOSTRA');
    const pcp = (await stages(item.id)).find((stage) => stage.stage === 'PCP_AMOSTRA')!;
    expect(pcp.actualStartAt).toBeInstanceOf(Date);
    expect(pcp.actualEndAt).toBeInstanceOf(Date);
    expect(pcp.completedByUserId).toBe(pcpUserId);
    expect(await status(item.id, 'AMOSTRA')).toBe('READY');
  });

  it('rejects unauthorized, unstarted, out-of-order and closed PCP actions', async () => {
    const item = await create();
    await expect(service.updatePcpStage(item.id, 'PCP_FERRAMENTARIA', 'start', sampleUserId)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.updatePcpStage(item.id, 'PCP_FERRAMENTARIA', 'finish', pcpUserId)).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.sendPcpToKairo(item.id, 'PCP_AMOSTRA', { teamId: 'team' }, pcpUserId)).rejects.toMatchObject({ statusCode: 400 });
    await prisma.solicitation.update({ where: { id: item.id }, data: { status: 'CANCELLED' } });
    await expect(service.updatePcpStage(item.id, 'PCP_FERRAMENTARIA', 'start', pcpUserId)).rejects.toMatchObject({ statusCode: 400 });
    await repo.markEngineeringFinished(item.id, new Date());
    expect(await status(item.id, 'ENGENHARIA')).toBe('PENDING');
  });

  it('tracks PCP with Kairo and does not reopen manual completion after card deletion', async () => {
    const item = await create();
    await service.sendPcpToKairo(item.id, 'PCP_FERRAMENTARIA', { teamId: 'team' }, pcpUserId);
    kairo.getActivity.mockResolvedValueOnce({ activity: { status: 'IN_PROGRESS', deletedAt: null, updatedAt: '2026-10-23T12:00:00Z' } });
    await service.syncPcpFromKairo(item.id, 'PCP_FERRAMENTARIA', pcpUserId);
    expect(await status(item.id, 'PCP_FERRAMENTARIA')).toBe('IN_PROGRESS');
    await service.syncPcpFromKairo(item.id, 'PCP_FERRAMENTARIA', pcpUserId);
    expect(await status(item.id, 'PCP_FERRAMENTARIA')).toBe('DONE');
    expect(await status(item.id, 'FERRAMENTARIA')).toBe('READY');
    kairo.getActivity.mockResolvedValue({ activity: { deletedAt: '2026-10-23T13:00:00Z' } });
    await service.syncPcpFromKairo(item.id, 'PCP_FERRAMENTARIA', pcpUserId);
    expect(await status(item.id, 'PCP_FERRAMENTARIA')).toBe('DONE');
  });

  it('completes the sample and its parent atomically, with one notification', async () => {
    const item = await create(false);
    await repo.markEngineeringFinished(item.id, new Date());
    await finishPcp(item.id, 'PCP_AMOSTRA');
    await service.sendSampleToKairo(item.id, { teamId: 'team' }, sampleUserId);
    await Promise.all([service.syncSampleFromKairo(item.id, sampleUserId), service.syncSampleFromKairo(item.id, sampleUserId)]);
    expect(await status(item.id, 'AMOSTRA')).toBe('DONE');
    expect((await prisma.solicitation.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('COMPLETED');
    expect(mail.completed).toHaveBeenCalledTimes(1);
  });

  it('declines a waiting stage only, preserving audit data and unrelated gates', async () => {
    const item = await create(true, false);
    const result = await service.declineStage(item.id, 'FERRAMENTARIA', '  Sem necessidade  ', toolingUserId);
    const declined = result.solicitation.workflowStages.find((stage) => stage.stage === 'FERRAMENTARIA')!;
    expect(declined).toMatchObject({ status: 'REJECTED', rejectionReason: 'Sem necessidade', rejectedByUserId: toolingUserId, rejectedByName: 'tool', actualStartAt: null, actualEndAt: null });
    expect(declined.rejectedAt).toBeInstanceOf(Date);
    expect(await status(item.id, 'PCP_FERRAMENTARIA')).toBe('READY');
    expect(await status(item.id, 'PCP_AMOSTRA')).toBe('READY');
    expect(await status(item.id, 'AMOSTRA')).toBe('PENDING');
    await repo.clearToolingKairo(item.id);
    await repo.markToolingFinished(item.id, new Date());
    expect(await status(item.id, 'FERRAMENTARIA')).toBe('REJECTED');
    expect(mail.completed).not.toHaveBeenCalled();
  });

  it('keeps the second PCP stage independent and refuses invalid declines', async () => {
    const item = await create();
    await service.declineStage(item.id, 'PCP_FERRAMENTARIA', 'Nao necessario', pcpUserId);
    expect(await status(item.id, 'FERRAMENTARIA')).toBe('READY');
    expect(await status(item.id, 'PCP_AMOSTRA')).toBe('PENDING');
    await expect(service.declineStage(item.id, 'PCP_AMOSTRA', '  ', pcpUserId)).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.declineStage(item.id, 'QUALIDADE', 'Wrong owner', pcpUserId)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.declineStage(item.id, 'PCP_FERRAMENTARIA', 'Again', pcpUserId)).rejects.toMatchObject({ statusCode: 400 });
    const noTooling = await create(false);
    await expect(service.declineStage(noTooling.id, 'FERRAMENTARIA', 'Missing', toolingUserId)).rejects.toBeDefined();
  });

  it.each(['PENDING', 'READY', 'IN_PROGRESS'] as const)('allows decline from %s', async (stageStatus) => {
    const item = await create(false, false);
    await prisma.solicitationWorkflowStage.update({ where: { solicitationId_stage: { solicitationId: item.id, stage: 'QUALIDADE' } }, data: { status: stageStatus } });
    await service.declineStage(item.id, 'QUALIDADE', 'Reason', qualityUserId);
    expect(await status(item.id, 'QUALIDADE')).toBe('REJECTED');
  });

  it.each(['COMPLETED', 'CANCELLED', 'DELETED'] as const)('refuses decline on a %s solicitation', async (parentStatus) => {
    const item = await create(false, false);
    await prisma.solicitation.update({ where: { id: item.id }, data: { status: parentStatus } });
    await expect(service.declineStage(item.id, 'QUALIDADE', 'Reason', qualityUserId)).rejects.toMatchObject({ statusCode: 400 });
    expect(await status(item.id, 'QUALIDADE')).toBe('READY');
  });

  it('completes when Amostra was declined and the last remaining stage finishes', async () => {
    const item = await create(false, false);
    await service.declineStage(item.id, 'AMOSTRA', 'Sem amostra', sampleUserId);
    await repo.markEngineeringFinished(item.id, new Date());
    await finishPcp(item.id, 'PCP_AMOSTRA');
    expect((await prisma.solicitation.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('APPROVED');
    await finishQuality(item.id);
    expect((await prisma.solicitation.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('COMPLETED');
    await repo.transitionQualityStage(item.id, 'DONE', new Date());
    expect(mail.completed).toHaveBeenCalledTimes(1);
  });

  it('completes an entirely declined workflow and serializes competing finish/decline requests', async () => {
    const item = await create(false, false);
    for (const stage of item.workflowStages.filter((stage) => stage.stage !== 'QUALIDADE')) {
      await repo.declineStage(item.id, stage.stage, 'Reason', qualityUserId, 'Test');
    }
    await service.updateQualityStage(item.id, 'start', qualityUserId);
    await Promise.allSettled([
      service.declineStage(item.id, 'QUALIDADE', 'Reason', qualityUserId),
      service.updateQualityStage(item.id, 'finish', qualityUserId),
    ]);
    expect(['DONE', 'REJECTED']).toContain(await status(item.id, 'QUALIDADE'));
    expect((await prisma.solicitation.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('COMPLETED');
    expect(mail.completed).toHaveBeenCalledTimes(1);
    const all = await create(false, false);
    for (const stage of all.workflowStages) await repo.declineStage(all.id, stage.stage, 'Reason', qualityUserId, 'Test');
    expect((await stages(all.id)).every((stage) => stage.status === 'REJECTED')).toBe(true);
    expect((await prisma.solicitation.findUniqueOrThrow({ where: { id: all.id } })).status).toBe('COMPLETED');
    expect(mail.completed).toHaveBeenCalledTimes(2);
  });

  it('cancels only selected-stage Kairo cards and reports partial failure without rollback', async () => {
    const item = await create();
    await repo.setToolingKairo(item.id, { kairoTeamId: 'team', kairoCardIds: 'first, second', kairoSyncedByUserId: toolingUserId });
    kairo.cancelActivity.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Open timer'));
    const result = await service.declineStage(item.id, 'FERRAMENTARIA', 'Reason', toolingUserId);
    expect(kairo.cancelActivity.mock.calls).toEqual([['team', 'first'], ['team', 'second']]);
    expect(kairo.cancelProject).not.toHaveBeenCalled();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('second');
    expect(await status(item.id, 'FERRAMENTARIA')).toBe('REJECTED');
    expect(result.solicitation.workflowStages.find((stage) => stage.stage === 'FERRAMENTARIA')!.kairoCardIds).toBe('first, second');
    kairo.getActivity.mockClear();
    await service.syncToolingFromKairo(item.id);
    expect(kairo.getActivity).not.toHaveBeenCalled();
  });

  it('persists a decline without changing Kairo when credentials are unavailable', async () => {
    const item = await create(false, false);
    await repo.setQualityKairo(item.id, { kairoTeamId: 'team', kairoCardIds: 'quality-card', kairoSyncedByUserId: qualityUserId });
    kairo.unavailable = true;
    const result = await service.declineStage(item.id, 'QUALIDADE', 'Reason', qualityUserId);
    expect(result.warnings).toHaveLength(1);
    expect(kairo.cancelActivity).not.toHaveBeenCalled();
    expect(await status(item.id, 'QUALIDADE')).toBe('REJECTED');
    await repo.clearQualityKairo(item.id);
    expect((await stages(item.id)).find((stage) => stage.stage === 'QUALIDADE')!.kairoCardIds).toBe('quality-card');
  });

  it('cancels engineering projects and ignores late engineering deletions', async () => {
    const item = await create(false, false);
    await prisma.solicitation.update({ where: { id: item.id }, data: { kind: 'PROJETO', kairoTeamId: 'team', kairoCardId: 'project', kairoCardIds: 'project', kairoSyncedByUserId: engineeringUserId } });
    const result = await service.declineStage(item.id, 'ENGENHARIA', 'Reason', engineeringUserId);
    expect(result.warnings).toEqual([]);
    expect(kairo.cancelProject).toHaveBeenCalledWith('team', 'project');
    expect(kairo.cancelActivity).not.toHaveBeenCalled();
    const { SolicitationService } = await import('./solicitation-service.js');
    kairo.getActivity.mockRejectedValue(new Error('Must not read a rejected branch'));
    const synced = await new SolicitationService().syncFromKairo(item.id);
    expect(synced.status).toBe('APPROVED');
    expect(await status(item.id, 'ENGENHARIA')).toBe('REJECTED');
    expect(await status(item.id, 'PCP_AMOSTRA')).toBe('READY');
    expect(kairo.getActivity).not.toHaveBeenCalled();
    await expect(service.sendPcpToKairo(item.id, 'PCP_AMOSTRA', { teamId: 'team' }, pcpUserId)).resolves.toBeDefined();
  });

  it('serializes a Kairo handoff with decline and cancels the newly linked card', async () => {
    const item = await create();
    let signalStarted!: () => void;
    let releaseCreate!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const released = new Promise<void>((resolve) => { releaseCreate = resolve; });
    kairo.createActivity.mockImplementationOnce(async () => { signalStarted(); await released; return { activity: { id: 'new-card' } }; });
    const send = service.sendPcpToKairo(item.id, 'PCP_FERRAMENTARIA', { teamId: 'team' }, pcpUserId);
    await started;
    const decline = service.declineStage(item.id, 'PCP_FERRAMENTARIA', 'Reason', pcpUserId);
    releaseCreate();
    await Promise.all([send, decline]);
    expect(await status(item.id, 'PCP_FERRAMENTARIA')).toBe('REJECTED');
    expect(kairo.cancelActivity).toHaveBeenCalledWith('team', 'new-card');
    await expect(service.sendPcpToKairo(item.id, 'PCP_FERRAMENTARIA', { teamId: 'team' }, pcpUserId)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('exposes manual and Kairo PCP actions through authenticated API routes', async () => {
    const { app } = await import('../app.js');
    await app.ready();
    try {
      const simulation = await createSimulation();
      const addUrl = `/api/solicitations/${simulation.id}/workflow/tooling`;
      expect((await app.inject({ method: 'POST', url: addUrl })).statusCode).toBe(401);
      expect((await app.inject({ method: 'POST', url: addUrl,
        headers: { authorization: 'Bearer ' + app.jwt.sign({ sub: toolingUserId }) } })).statusCode).toBe(403);
      const added = await app.inject({ method: 'POST', url: addUrl,
        headers: { authorization: 'Bearer ' + app.jwt.sign({ sub: engineeringUserId }) } });
      expect(added.statusCode, added.body).toBe(200);
      expect(added.json().solicitation.workflow).toMatchObject({ kind: 'COMMERCIAL_SIMULATION', requiresTooling: true });
      expect(added.json().solicitation.workflow.stages.map((stage: { stage: string }) => stage.stage)).toEqual(['ENGENHARIA', 'FERRAMENTARIA']);
      const publicSimulation = await app.inject({ method: 'GET', url: `/api/solicitations/track/${simulation.trackingCode}` });
      expect(publicSimulation.json().solicitation.workflow.kind).toBe('COMMERCIAL_SIMULATION');
      const direct = await createDirect();
      const publicDirect = await app.inject({ method: 'GET', url: `/api/solicitations/track/${direct.trackingCode}` });
      expect(publicDirect.statusCode, publicDirect.body).toBe(200);
      expect(publicDirect.json().solicitation).toMatchObject({ unit: 'PEDERTRACTOR', executionUnit: 'TRACTOR', directTooling: true });
      const internalDirect = await app.inject({ method: 'GET', url: `/api/solicitations/${direct.id}`,
        headers: { authorization: 'Bearer ' + app.jwt.sign({ sub: pcpUserId }) } });
      expect(internalDirect.statusCode, internalDirect.body).toBe(200);
      expect(internalDirect.json().solicitation).toMatchObject({ unit: 'PEDERTRACTOR', executionUnit: 'TRACTOR', directTooling: true });
      const declineItem = await create(false, false);
      const declineUrl = `/api/solicitations/${declineItem.id}/workflow/QUALIDADE/decline`;
      const declineHeaders = { authorization: 'Bearer ' + app.jwt.sign({ sub: qualityUserId }) };
      const superAdmin = await prisma.user.create({ data: { employeeId: randomUUID(), name: 'Super Admin', cardNumber: randomUUID(),
        unit: 'PEDERTRACTOR', role: 'SUPER_ADMIN', department: null, passwordHash: 'test', mustChangePassword: false } });
      const superHeaders = { authorization: 'Bearer ' + app.jwt.sign({ sub: superAdmin.id }) };
      const superSimulation = await createSimulation();
      const superAdded = await app.inject({ method: 'POST', url: `/api/solicitations/${superSimulation.id}/workflow/tooling`, headers: superHeaders });
      expect(superAdded.statusCode, superAdded.body).toBe(200);
      expect(superAdded.json().solicitation.workflow.kind).toBe('COMMERCIAL_SIMULATION');
      for (const stage of ['ENGENHARIA', 'PCP_FERRAMENTARIA', 'FERRAMENTARIA', 'PCP_AMOSTRA', 'QUALIDADE', 'AMOSTRA']) {
        const denied = await app.inject({ method: 'POST', url: `/api/solicitations/${declineItem.id}/workflow/${stage}/decline`, headers: superHeaders, payload: { reason: 'Reason' } });
        expect(denied.statusCode, denied.body).toBe(403);
      }
      expect(await status(declineItem.id, 'QUALIDADE')).toBe('READY');
      const wrongArea = await app.inject({ method: 'POST', url: declineUrl,
        headers: { authorization: 'Bearer ' + app.jwt.sign({ sub: sampleUserId }) }, payload: { reason: 'Reason' } });
      expect(wrongArea.statusCode, wrongArea.body).toBe(403);

      expect((await app.inject({ method: 'POST', url: declineUrl, payload: { reason: 'Reason' } })).statusCode).toBe(401);
      expect((await app.inject({ method: 'POST', url: declineUrl, headers: declineHeaders, payload: { reason: '  ' } })).statusCode).toBe(400);
      const decline = await app.inject({ method: 'POST', url: declineUrl, headers: declineHeaders, payload: { reason: '  Reason  ' } });
      expect(decline.statusCode, decline.body).toBe(200);
      expect(decline.json().solicitation.workflow.stages.find((stage: { stage: string }) => stage.stage === 'QUALIDADE')).toMatchObject({ status: 'REJECTED', rejectionReason: 'Reason', rejectedByName: 'quality' });
      expect(decline.json().warnings).toEqual([]);
      const qualityItem = await create(false, false);
      const qualityHeaders = { authorization: 'Bearer ' + app.jwt.sign({ sub: qualityUserId }) };
      const qualityUrl = '/api/solicitations/' + qualityItem.id + '/workflow/quality';
      expect((await app.inject({ method: 'POST', url: qualityUrl + '/start' })).statusCode).toBe(401);
      const qualityStart = await app.inject({ method: 'POST', url: qualityUrl + '/start', headers: qualityHeaders });
      expect(qualityStart.statusCode, qualityStart.body).toBe(200);
      expect(qualityStart.json().solicitation.workflow.stages.find((stage: { stage: string }) => stage.stage === 'QUALIDADE').status).toBe('IN_PROGRESS');
      expect((await app.inject({ method: 'POST', url: qualityUrl + '/finish', headers: qualityHeaders })).statusCode).toBe(200);
      const qualityNext = await create(false, false);
      const qualityKairoUrl = '/api/solicitations/' + qualityNext.id + '/workflow/quality';
      expect((await app.inject({ method: 'POST', url: qualityKairoUrl + '/send-to-kairo', headers: qualityHeaders, payload: {} })).statusCode).toBe(400);
      expect((await app.inject({ method: 'POST', url: qualityKairoUrl + '/send-to-kairo', headers: qualityHeaders, payload: { teamId: 'team' } })).statusCode).toBe(200);
      expect((await app.inject({ method: 'POST', url: qualityKairoUrl + '/sync-kairo', headers: qualityHeaders })).statusCode).toBe(200);
      const item = await create();
      const token = app.jwt.sign({ sub: pcpUserId });
      const headers = { authorization: `Bearer ${token}` };
      const url = `/api/solicitations/${item.id}/workflow/pcp/PCP_FERRAMENTARIA`;
      const start = await app.inject({ method: 'POST', url: `${url}/start`, headers });
      expect(start.statusCode, start.body).toBe(200);
      expect(start.json().solicitation.workflow.stages.find((stage: { stage: string }) => stage.stage === 'PCP_FERRAMENTARIA').status).toBe('IN_PROGRESS');
      const finish = await app.inject({ method: 'POST', url: `${url}/finish`, headers });
      expect(finish.statusCode, finish.body).toBe(200);
      const unauthorized = await app.inject({ method: 'POST', url: `${url}/start`,
        headers: { authorization: `Bearer ${app.jwt.sign({ sub: sampleUserId })}` } });
      expect(unauthorized.statusCode).toBe(403);
      const next = await create();
      const kairoUrl = `/api/solicitations/${next.id}/workflow/pcp/PCP_FERRAMENTARIA`;
      expect((await app.inject({ method: 'POST', url: `${kairoUrl}/send-to-kairo`, headers, payload: {} })).statusCode).toBe(400);
      const sent = await app.inject({ method: 'POST', url: `${kairoUrl}/send-to-kairo`, headers, payload: { teamId: 'team' } });
      expect(sent.statusCode, sent.body).toBe(200);
      const synced = await app.inject({ method: 'POST', url: `${kairoUrl}/sync-kairo`, headers });
      expect(synced.statusCode, synced.body).toBe(200);
    } finally { await app.close(); }
  }, 30_000);
});
