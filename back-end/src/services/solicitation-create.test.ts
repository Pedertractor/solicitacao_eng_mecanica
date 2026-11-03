import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { SolicitationWithWorkflow } from '../repositories/prisma/solicitation-repository.js';
import { SolicitationPrismaRepository } from '../repositories/prisma/solicitation-repository.js';
import { WorkflowStagePrismaRepository } from '../repositories/prisma/workflow-stage-repository.js';
import { SolicitationService } from './solicitation-service.js';
import { UserService } from './user-service.js';
import Fastify from 'fastify';
import { solicitationRoutes } from '../https/routes/solicitation-route.js';
import { apiErrorHandler } from '../https/errors/error-handler.js';

vi.mock('../lib/prisma.js', () => ({ prisma: {
  $transaction: async (callback: (tx: object) => Promise<unknown>) => callback({}),
} }));

describe('Comercial solicitation creation', () => {
  const service = new SolicitationService();
  const base = {
    cardNumber: '123', unit: 'PEDERTRACTOR' as const, costCenter: '1000',
    pillarOrLocation: 'Linha 1', requesterEmail: 'test@example.com',
  };
  const commercial = {
    ...base, department: 'DESENVOLVIMENTO_PROCESSOS' as const,
    processInstructionRequester: 'Comercial', processInstructionProcess: 'Corte',
    processInstructionType: 'Simulação Comercial', client: 'PEDERTRACTOR' as const,
  };
  let stored: SolicitationWithWorkflow;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(service, 'validateRequester').mockResolvedValue({ employeeId: '1', name: 'Test', status: true,
      cardNumber: '123', unit: 'PEDERTRACTOR', email: null });
    vi.spyOn(service, 'getSectorByCostCenter').mockResolvedValue({
      id: '1', name: 'Test', costCenter: '1000', normalizedName: 'TEST', status: true,
    });
    vi.spyOn(UserService.prototype, 'listAreaAdminsWithNotificationEmail').mockResolvedValue([]);
    vi.spyOn(SolicitationPrismaRepository.prototype, 'create').mockImplementation(async (data) => {
      stored = {
        id: 'test', trackingCode: 'TEST', status: 'PENDING', statusUpdatedAt: null,
        deliveryDate: null, createdAt: new Date(), updatedAt: new Date(), workflowStages: [],
        ...data,
      } as SolicitationWithWorkflow;
      return stored;
    });
    vi.spyOn(WorkflowStagePrismaRepository.prototype, 'createStages').mockImplementation(async (_id, stages) =>
      stages.map((stage) => ({ ...stage, id: randomUUID() })) as SolicitationWithWorkflow['workflowStages']);
  });

  it.each(['PEDERTRACTOR', 'TRACTOR'] as const)('stores and returns the independent %s execution unit', async (executionUnit) => {
    const result = await service.create({ ...commercial, processInstructionProcess: 'Engenharia', processInstructionType: 'Desenvolvimento Amostra', deliveryDate: '2026-12-01', executionUnit, directTooling: true, requiresTooling: false });
    expect(service.validateRequester).toHaveBeenCalledWith('123', 'PEDERTRACTOR');
    expect(stored).toMatchObject({ unit: 'PEDERTRACTOR', executionUnit, directTooling: true, requiresTooling: true });
    expect(result).toMatchObject({ unit: 'PEDERTRACTOR', executionUnit, directTooling: true, requiresTooling: true });
    expect(result.workflow!.stages.map((stage) => stage.stage)).toEqual(['PCP_FERRAMENTARIA', 'FERRAMENTARIA']);
    vi.spyOn(SolicitationPrismaRepository.prototype, 'findByTrackingCode').mockResolvedValue(stored);
    expect(await service.getByTrackingCode('TEST')).toMatchObject({ unit: 'PEDERTRACTOR', executionUnit, directTooling: true });
  });

  it.each(['Corte', 'Dobra', 'Solda Robotizada', 'Usinagem'])('creates engineering only for %s simulations and normalizes old routing flags', async (process) => {
    const result = await service.create({ ...commercial, processInstructionProcess: process,
      executionUnit: 'TRACTOR', requiresTooling: true, directTooling: true });
    expect(stored).toMatchObject({ requiresTooling: false, directTooling: false });
    expect(result.workflow).toMatchObject({ kind: 'COMMERCIAL_SIMULATION', requiresTooling: false });
    expect(result.workflow!.stages.map((stage) => stage.stage)).toEqual(['ENGENHARIA']);
  });

  it('requires the unit for all new Comercial requests before external lookups', async () => {
    await expect(service.create(commercial)).rejects.toMatchObject({ statusCode: 400 });
    expect(service.validateRequester).not.toHaveBeenCalled();
  });

  it('creates direct commercial tooling without a process and notifies tooling admins', async () => {
    const result = await service.create({ ...base, department: 'FERRAMENTARIA',
      processInstructionRequester: 'Comercial', processInstructionType: 'Simulação Comercial',
      executionUnit: 'TRACTOR', client: 'PEDERTRACTOR', partNumbers: 'NEW, new', comments: 'Simular ferramenta' });
    expect(stored).toMatchObject({ department: 'FERRAMENTARIA', processInstructionProcess: null,
      processInstructionRequester: 'Comercial', processInstructionType: 'Simulação Comercial',
      processInstructionDeadlineLabel: '10 dias úteis', directTooling: true, requiresTooling: true,
      executionUnit: 'TRACTOR', partNumbers: 'NEW', description: 'Simular ferramenta' });
    expect(result.workflow).toMatchObject({ kind: 'COMMERCIAL_DIRECT_TOOLING',
      stages: [{ stage: 'FERRAMENTARIA', status: 'READY', order: 0, plannedDurationPercentage: null }] });
    expect(result.workflow!.stages).toHaveLength(1);
    expect(result.workflow!.stages[0]!.plannedEndAt).toBeTruthy();
    expect(UserService.prototype.listAreaAdminsWithNotificationEmail).toHaveBeenCalledWith('FERRAMENTARIA');
  });

  it('validates the fixed fields and execution unit for the new destination before external lookups', async () => {
    const tooling = { ...base, department: 'FERRAMENTARIA' as const,
      processInstructionRequester: 'Comercial', processInstructionType: 'Simulação Comercial', client: 'PEDERTRACTOR' as const };
    for (const input of [tooling, { ...tooling, executionUnit: 'TRACTOR' as const, processInstructionRequester: 'Engenharia' },
      { ...tooling, executionUnit: 'TRACTOR' as const, processInstructionType: 'Desenvolvimento Amostra' }]) {
      await expect(service.create(input)).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(service.validateRequester).not.toHaveBeenCalled();
  });

  it('accepts the public API payload without process and serializes the new workflow on creation and tracking', async () => {
    vi.spyOn(SolicitationService.prototype, 'validateRequester').mockImplementation(service.validateRequester);
    vi.spyOn(SolicitationService.prototype, 'getSectorByCostCenter').mockImplementation(service.getSectorByCostCenter);
    const app = Fastify();
    app.setErrorHandler(apiErrorHandler);
    app.register(solicitationRoutes, { prefix: '/api/solicitations' });
    const payload = { ...base, department: 'FERRAMENTARIA', executionUnit: 'TRACTOR', client: 'PEDERTRACTOR',
      processInstructionRequester: 'Comercial', processInstructionType: 'Simulação Comercial' };
    try {
      const response = await app.inject({ method: 'POST', url: '/api/solicitations/', payload });
      expect(response.statusCode).toBe(201);
      expect(response.json().solicitation).toMatchObject({ department: 'FERRAMENTARIA',
        processInstructionProcess: null, workflow: { kind: 'COMMERCIAL_DIRECT_TOOLING', stages: [{ stage: 'FERRAMENTARIA', status: 'READY' }] } });
      const createdStages = vi.mocked(WorkflowStagePrismaRepository.prototype.createStages).mock.results[0]!;
      vi.spyOn(SolicitationPrismaRepository.prototype, 'findByTrackingCode').mockResolvedValue({ ...stored, workflowStages: await createdStages.value });
      const tracked = await app.inject({ method: 'GET', url: '/api/solicitations/track/TEST' });
      expect(tracked.statusCode).toBe(200);
      expect(tracked.json().solicitation).toMatchObject({ department: 'FERRAMENTARIA', workflow: { kind: 'COMMERCIAL_DIRECT_TOOLING' } });
      vi.mocked(service.validateRequester).mockClear();
      for (const invalid of [
        { ...payload, processInstructionRequester: 'Engenharia' },
        { ...payload, processInstructionType: 'Desenvolvimento Amostra' },
        { ...payload, processInstructionProcess: 'Corte' },
        { ...payload, executionUnit: undefined },
      ]) {
        expect((await app.inject({ method: 'POST', url: '/api/solicitations/', payload: invalid })).statusCode).toBe(400);
      }
      expect(service.validateRequester).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('rejects execution units and direct routing for other requesters and departments', async () => {
    for (const input of [
      { ...commercial, processInstructionRequester: 'Engenharia', directTooling: true },
      { ...commercial, processInstructionRequester: 'Engenharia', executionUnit: 'TRACTOR' as const },
      { ...base, department: 'ENG_MECANICA' as const, title: 'Test', description: 'Test', directTooling: true },
    ]) {
      await expect(service.create(input)).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(service.validateRequester).not.toHaveBeenCalled();
  });

  it('keeps the standard Comercial workflow when direct routing is omitted', async () => {
    const result = await service.create({ ...commercial, processInstructionProcess: 'Engenharia', processInstructionType: 'Desenvolvimento Amostra', deliveryDate: '2026-12-01', executionUnit: 'TRACTOR' });
    expect(result.directTooling).toBe(false);
    expect(result.workflow!.stages.map((stage) => stage.stage)).toEqual(['ENGENHARIA', 'PCP_AMOSTRA', 'QUALIDADE', 'AMOSTRA']);
  });

  it('creates a request with unregistered part numbers without consulting the base API', async () => {
    const lookup = vi.spyOn(service, 'lookupPartByNumber').mockRejectedValue(new Error('Base API unavailable'));
    const result = await service.create({
      ...commercial, executionUnit: 'TRACTOR',
      partNumbers: ' NEW-PN-001, new-pn-001, , Custom-002 ',
    });
    expect(stored.partNumbers).toBe('NEW-PN-001, Custom-002');
    expect(result.partNumbers).toBe('NEW-PN-001, Custom-002');
    expect(lookup).not.toHaveBeenCalled();
  });

  it.each([undefined, '', ' ,  , '])('stores empty part numbers as null (%s)', async (partNumbers) => {
    expect(await service.resolvePartNumbers(partNumbers)).toBeNull();
  });

  it('keeps mechanical requests without Comercial metadata or workflow', async () => {
    const result = await service.create({ ...base, department: 'ENG_MECANICA', title: 'Test', description: 'Test' });
    expect(result).toMatchObject({ executionUnit: null, directTooling: false, workflow: null });
  });

  it('stores the requesting department on a mechanical request without creating a production workflow', async () => {
    const result = await service.create({ ...base, department: 'ENG_MECANICA', processInstructionRequester: 'Produção', title: 'Test', description: 'Test' });
    expect(stored.processInstructionRequester).toBe('Produção');
    expect(result).toMatchObject({ processInstructionRequester: 'Produção', workflow: null, executionUnit: null });
  });

  it('rejects an unknown requesting department before external lookups', async () => {
    await expect(service.create({ ...base, department: 'ENG_MECANICA', processInstructionRequester: 'Desconhecido', title: 'Test', description: 'Test' })).rejects.toMatchObject({ statusCode: 400 });
    expect(service.validateRequester).not.toHaveBeenCalled();
  });

  it('maps historical requests with null execution units', async () => {
    await service.create({ ...commercial, executionUnit: 'TRACTOR' });
    vi.spyOn(SolicitationPrismaRepository.prototype, 'findByTrackingCode').mockResolvedValue({
      ...stored, executionUnit: null, directTooling: false,
    });
    expect(await service.getByTrackingCode('TEST')).toMatchObject({ executionUnit: null, directTooling: false });
  });
});
