import { afterEach, describe, expect, it, vi } from 'vitest';
import { $Enums } from '../generated/prisma/client.js';
import { EmployeePrismaRepository } from '../repositories/prisma/employee-repository.js';
import { SafetyAccidentPrismaRepository } from '../repositories/prisma/safety-repository.js';
import { SectorPrismaRepository } from '../repositories/prisma/sector-repository.js';
import { CipaInboundService } from './cipa-inbound-service.js';
import {
  AccidentSimulationService,
  cardNumberMatchCandidates,
} from './accident-simulation-service.js';

const monthlyCycleFindFirst = vi.fn();
const userFindUnique = vi.fn();
const employeeCreate = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    monthlyCycle: {
      findFirst: (...args: unknown[]) => monthlyCycleFindFirst(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
    employee: {
      create: (...args: unknown[]) => employeeCreate(...args),
    },
  },
}));

const cycle = {
  id: '11111111-1111-4111-8111-111111111111',
  month: 8,
  year: 2026,
  status: $Enums.CycleStatus.OPEN,
};

const employee = {
  id: '22222222-2222-4222-8222-222222222222',
  externalId: 'emp-5485',
  employeeId: '5485',
  name: 'ANA SILVA',
  unit: $Enums.Unit.PEDERTRACTOR,
  active: true,
  currentSectorId: '33333333-3333-4333-8333-333333333333',
  userId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const sector = {
  id: employee.currentSectorId,
  externalId: 'sec-7051',
  code: '7051',
  name: 'Usinagem',
  unit: $Enums.Unit.PEDERTRACTOR,
  active: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('cardNumberMatchCandidates', () => {
  it('gera variantes sem duplicar o valor já normalizado', () => {
    expect(cardNumberMatchCandidates('5485')).toEqual(['5485']);
  });

  it('inclui cartão com zeros à esquerda e o valor normalizado', () => {
    expect(cardNumberMatchCandidates('05485')).toEqual(['05485', '5485']);
  });
});

describe('AccidentSimulationService.simulate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    monthlyCycleFindFirst.mockReset();
    employeeCreate.mockReset();
  });

  it('bate cartão e unidade e envia o cartão armazenado para a CIPA', async () => {
    monthlyCycleFindFirst.mockResolvedValue(cycle);
    vi.spyOn(EmployeePrismaRepository.prototype, 'findByUnitAndCardNumber')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(employee);
    vi.spyOn(SectorPrismaRepository.prototype, 'findById').mockResolvedValue(
      sector,
    );
    const ingest = vi.spyOn(CipaInboundService.prototype, 'ingestAccident').mockResolvedValue({
      created: true,
      operation: 'CREATED',
      recalculated: true,
    } as never);

    const result = await new AccidentSimulationService().simulate({
      accidentType: 'WITH_LEAVE',
      cardNumber: '05485',
      unit: 'PEDERTRACTOR',
    });

    expect(ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        cardNumber: '5485',
        unit: 'PEDERTRACTOR',
        costCenter: '7051',
        accidentType: 'WITH_LEAVE',
        daysAway: 3,
        cycleYear: 2026,
        cycleMonth: 8,
      }),
    );
    expect(employeeCreate).not.toHaveBeenCalled();
    expect(result.simulation.employeeName).toBe('ANA SILVA');
  });

  it('simula sem afastamento com daysAway nulo', async () => {
    monthlyCycleFindFirst.mockResolvedValue(cycle);
    vi.spyOn(
      EmployeePrismaRepository.prototype,
      'findByUnitAndCardNumber',
    ).mockResolvedValue(employee);
    vi.spyOn(SectorPrismaRepository.prototype, 'findById').mockResolvedValue(
      sector,
    );
    const ingest = vi
      .spyOn(CipaInboundService.prototype, 'ingestAccident')
      .mockResolvedValue({ created: true } as never);

    await new AccidentSimulationService().simulate({
      accidentType: 'WITHOUT_LEAVE',
      cardNumber: '5485',
      unit: 'PEDERTRACTOR',
    });

    expect(ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        accidentType: 'WITHOUT_LEAVE',
        daysAway: null,
      }),
    );
  });

  it('rejeita colaborador inexistente na unidade', async () => {
    monthlyCycleFindFirst.mockResolvedValue(cycle);
    vi.spyOn(
      EmployeePrismaRepository.prototype,
      'findByUnitAndCardNumber',
    ).mockResolvedValue(null);

    await expect(
      new AccidentSimulationService().simulate({
        accidentType: 'WITH_LEAVE',
        cardNumber: '9999',
        unit: 'TRACTOR',
      }),
    ).rejects.toMatchObject({
      message: 'Colaborador não encontrado: cartão 9999 / TRACTOR',
      statusCode: 404,
    });
    expect(employeeCreate).not.toHaveBeenCalled();
  });

  it('rejeita colaborador sem setor', async () => {
    monthlyCycleFindFirst.mockResolvedValue(cycle);
    vi.spyOn(
      EmployeePrismaRepository.prototype,
      'findByUnitAndCardNumber',
    ).mockResolvedValue({ ...employee, currentSectorId: null });

    await expect(
      new AccidentSimulationService().simulate({
        accidentType: 'WITHOUT_LEAVE',
        cardNumber: '5485',
        unit: 'PEDERTRACTOR',
      }),
    ).rejects.toMatchObject({
      message:
        'Colaborador ANA SILVA está sem setor. Sincronize setores/colaboradores antes de simular.',
      statusCode: 404,
    });
  });
});

describe('AccidentSimulationService.cancel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    userFindUnique.mockReset();
  });

  it('cancela ocorrência CIPA pelo id e recalcula', async () => {
    vi.spyOn(SafetyAccidentPrismaRepository.prototype, 'findById').mockResolvedValue({
      id: 'acc-1',
      externalId: 'sim-123',
      accidentType: $Enums.AccidentType.WITH_LEAVE,
      sourceSystem: $Enums.SourceSystem.CIPA,
      status: $Enums.AccidentStatus.VALIDATED,
      cycleId: cycle.id,
      cycle,
      employee,
    } as never);
    userFindUnique.mockResolvedValue({
      id: 'admin-1',
      name: 'Admin',
      cardNumber: '1',
    });
    const cancel = vi
      .spyOn(CipaInboundService.prototype, 'cancelAccident')
      .mockResolvedValue({ operation: 'CANCELLED', changed: true } as never);

    const result = await new AccidentSimulationService().cancel({
      accidentId: 'acc-1',
      actorUserId: 'admin-1',
    });

    expect(cancel).toHaveBeenCalledWith(
      'sim-123',
      expect.objectContaining({
        reason: 'Remoção pela simulação P5',
        actor: {
          externalId: 'admin-1',
          name: 'Admin',
          identifier: '1',
        },
      }),
    );
    expect(result.simulation.cycleLabel).toBe('8/2026');
  });

  it('não remove reincidência gerada pelo P5', async () => {
    vi.spyOn(SafetyAccidentPrismaRepository.prototype, 'findById').mockResolvedValue({
      id: 'acc-2',
      externalId: 'freq-1',
      accidentType: $Enums.AccidentType.FREQUENCY,
      sourceSystem: $Enums.SourceSystem.CIPA,
      status: $Enums.AccidentStatus.VALIDATED,
      cycle,
      employee,
    } as never);

    await expect(
      new AccidentSimulationService().cancel({
        accidentId: 'acc-2',
        actorUserId: 'admin-1',
      }),
    ).rejects.toMatchObject({
      message:
        'Reincidência é gerada automaticamente pelo P5 e não pode ser removida',
      statusCode: 400,
    });
  });

  it('retorna 404 quando a ocorrência não existe', async () => {
    vi.spyOn(
      SafetyAccidentPrismaRepository.prototype,
      'findById',
    ).mockResolvedValue(null);

    await expect(
      new AccidentSimulationService().cancel({
        accidentId: 'missing',
        actorUserId: 'admin-1',
      }),
    ).rejects.toMatchObject({
      message: 'Ocorrência não encontrada',
      statusCode: 404,
    });
  });
});

describe('AccidentSimulationService.listWorkingCycleAccidents', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    monthlyCycleFindFirst.mockReset();
  });

  it('marca simulações e impede remover reincidência', async () => {
    monthlyCycleFindFirst.mockResolvedValue(cycle);
    vi.spyOn(
      SafetyAccidentPrismaRepository.prototype,
      'findByCycleId',
    ).mockResolvedValue([
      {
        id: 'a1',
        externalId: 'sim-abc',
        employee: employee,
        sector,
        accidentType: $Enums.AccidentType.WITH_LEAVE,
        daysAway: 3,
        occurredAt: new Date('2026-08-01T12:00:00Z'),
        status: $Enums.AccidentStatus.VALIDATED,
        sourceSystem: $Enums.SourceSystem.CIPA,
      },
      {
        id: 'a2',
        externalId: 'freq-1',
        employee: employee,
        sector,
        accidentType: $Enums.AccidentType.FREQUENCY,
        daysAway: null,
        occurredAt: new Date('2026-08-01T12:00:00Z'),
        status: $Enums.AccidentStatus.VALIDATED,
        sourceSystem: $Enums.SourceSystem.CIPA,
      },
    ] as never);

    const result =
      await new AccidentSimulationService().listWorkingCycleAccidents();

    expect(result.cycle?.label).toBe('8/2026');
    expect(result.accidents[0]).toMatchObject({
      simulated: true,
      canRemove: true,
      cardNumber: '5485',
      unit: $Enums.Unit.PEDERTRACTOR,
    });
    expect(result.accidents[1]).toMatchObject({
      simulated: false,
      canRemove: false,
    });
  });
});
