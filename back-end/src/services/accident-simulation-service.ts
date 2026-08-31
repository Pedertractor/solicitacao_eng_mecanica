import { $Enums } from '../generated/prisma/client.js';
import { HttpError } from '../https/errors/index.js';
import { cycleStatusLabel } from '../lib/status-labels.js';
import { normalizeCardNumber } from '../lib/card-number.js';
import { prisma } from '../lib/prisma.js';
import { EmployeePrismaRepository } from '../repositories/prisma/employee-repository.js';
import { SafetyAccidentPrismaRepository } from '../repositories/prisma/safety-repository.js';
import { SectorPrismaRepository } from '../repositories/prisma/sector-repository.js';
import { CipaInboundService } from './cipa-inbound-service.js';

const EDITABLE_CYCLE_STATUSES: $Enums.CycleStatus[] = [
  $Enums.CycleStatus.OPEN,
  $Enums.CycleStatus.CALCULATED,
];

export type SimulateAccidentInput = {
  accidentType: 'WITH_LEAVE' | 'WITHOUT_LEAVE';
  daysAway?: number | null;
  costCenter?: string;
  cardNumber: string;
  unit: 'PEDERTRACTOR' | 'TRACTOR';
};

export type CancelSimulatedAccidentInput = {
  accidentId: string;
  actorUserId: string;
};

/** Variantes de cartão usadas para bater colaborador (exato, normalizado e com 4 dígitos). */
export function cardNumberMatchCandidates(cardNumber: string): string[] {
  const trimmed = cardNumber.trim();
  if (!trimmed) return [];
  const normalized = normalizeCardNumber(trimmed);
  const padded = normalized.padStart(4, '0');
  return [...new Set([trimmed, normalized, padded])];
}

function isSimulatedExternalId(externalId: string | null | undefined) {
  return Boolean(externalId?.startsWith('sim-'));
}

async function findWorkingCycle() {
  return prisma.monthlyCycle.findFirst({
    where: { status: { in: EDITABLE_CYCLE_STATUSES } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
}

async function findEmployeeByCardAndUnit(
  unit: $Enums.Unit,
  cardNumber: string,
) {
  const employeeRepo = new EmployeePrismaRepository(prisma);
  for (const candidate of cardNumberMatchCandidates(cardNumber)) {
    const employee = await employeeRepo.findByUnitAndCardNumber(
      unit,
      candidate,
    );
    if (employee) return employee;
  }
  return null;
}

function assertCycleEditable(status: $Enums.CycleStatus) {
  if (
    status === $Enums.CycleStatus.HOMOLOGATED ||
    status === $Enums.CycleStatus.LOCKED
  ) {
    throw new HttpError(
      'Não é possível alterar ocorrências de um ciclo homologado ou bloqueado',
      409,
    );
  }
}

export class AccidentSimulationService {
  async simulate(input: SimulateAccidentInput) {
    const cardNumber = input.cardNumber.trim();
    const unit = input.unit;
    const accidentType = input.accidentType;
    const daysAway =
      input.daysAway !== undefined
        ? input.daysAway
        : accidentType === 'WITH_LEAVE'
          ? 3
          : null;

    if (!cardNumber) {
      throw new HttpError('Informe o número do cartão do colaborador', 400);
    }

    const cycle = await findWorkingCycle();
    if (!cycle) {
      throw new HttpError(
        'Nenhum ciclo em trabalho (Aberto/Calculado). Abra um ciclo no P5 antes de simular.',
        400,
      );
    }

    const employee = await findEmployeeByCardAndUnit(unit, cardNumber);
    if (!employee) {
      throw new HttpError(
        `Colaborador não encontrado: cartão ${cardNumber} / ${unit}`,
        404,
      );
    }

    const sectorRepo = new SectorPrismaRepository(prisma);
    const costCenterOverride = input.costCenter?.trim();
    const sector = costCenterOverride
      ? await sectorRepo.findByCode(costCenterOverride)
      : employee.currentSectorId
        ? await sectorRepo.findById(employee.currentSectorId)
        : null;

    if (!sector?.code?.trim()) {
      throw new HttpError(
        costCenterOverride
          ? `Setor ${costCenterOverride} não encontrado. Sincronize setores/colaboradores antes de simular.`
          : `Colaborador ${employee.name} está sem setor. Sincronize setores/colaboradores antes de simular.`,
        404,
      );
    }

    const costCenter = sector.code.trim();
    const now = new Date();
    const externalId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const occurredAt = now.toISOString();

    const result = await new CipaInboundService().ingestAccident({
      externalId,
      costCenter,
      unit,
      cardNumber: employee.employeeId,
      accidentType,
      occurredAt,
      daysAway,
      description: `Simulação local (${accidentType}) — ${employee.name}`,
      cycleYear: cycle.year,
      cycleMonth: cycle.month,
    });

    return {
      ...result,
      simulation: {
        costCenter,
        cardNumber: employee.employeeId,
        unit,
        accidentType,
        employeeName: employee.name,
        sectorName: sector.name,
        cycleId: cycle.id,
        cycleLabel: `${cycle.month}/${cycle.year}`,
      },
    };
  }

  async listWorkingCycleAccidents() {
    const cycle = await findWorkingCycle();
    if (!cycle) {
      return { cycle: null, accidents: [] };
    }

    const rows = await new SafetyAccidentPrismaRepository(prisma).findByCycleId(
      cycle.id,
    );

    return {
      cycle: {
        id: cycle.id,
        month: cycle.month,
        year: cycle.year,
        status: cycle.status,
        label: `${cycle.month}/${cycle.year}`,
        statusLabel: cycleStatusLabel(cycle.status),
        editable: EDITABLE_CYCLE_STATUSES.includes(cycle.status),
      },
      accidents: rows.map((row) => {
        const simulated = isSimulatedExternalId(row.externalId);
        const canRemove =
          row.accidentType !== $Enums.AccidentType.FREQUENCY &&
          row.sourceSystem === $Enums.SourceSystem.CIPA &&
          EDITABLE_CYCLE_STATUSES.includes(cycle.status);

        return {
          id: row.id,
          externalId: row.externalId,
          employeeName: row.employee?.name ?? null,
          cardNumber: row.employee?.employeeId ?? null,
          unit: row.employee?.unit ?? null,
          sectorName: row.sector.name,
          accidentType: row.accidentType,
          daysAway: row.daysAway,
          occurredAt: row.occurredAt.toISOString(),
          status: row.status,
          sourceSystem: row.sourceSystem,
          simulated,
          canRemove,
        };
      }),
    };
  }

  async cancel(input: CancelSimulatedAccidentInput) {
    const accident = await new SafetyAccidentPrismaRepository(prisma).findById(
      input.accidentId,
    );
    if (!accident) {
      throw new HttpError('Ocorrência não encontrada', 404);
    }

    if (accident.accidentType === $Enums.AccidentType.FREQUENCY) {
      throw new HttpError(
        'Reincidência é gerada automaticamente pelo P5 e não pode ser removida',
        400,
      );
    }

    if (accident.sourceSystem !== $Enums.SourceSystem.CIPA) {
      throw new HttpError(
        'Só é possível remover ocorrências da CIPA nesta simulação',
        400,
      );
    }

    if (accident.status === $Enums.AccidentStatus.CANCELLED) {
      throw new HttpError('Ocorrência já removida', 409);
    }

    assertCycleEditable(accident.cycle.status);

    const actorUser = await prisma.user.findUnique({
      where: { id: input.actorUserId },
      select: { id: true, name: true, cardNumber: true },
    });

    const result = await new CipaInboundService().cancelAccident(
      accident.externalId,
      {
        sourceChangedAt: new Date().toISOString(),
        reason: isSimulatedExternalId(accident.externalId)
          ? 'Remoção pela simulação P5'
          : 'Remoção manual pela simulação P5',
        actor: {
          externalId: input.actorUserId,
          name: actorUser?.name?.trim() || 'Administrador',
          identifier: actorUser?.cardNumber?.trim() || 'P5_SIMULATION',
        },
      },
    );

    return {
      ...result,
      simulation: {
        accidentId: accident.id,
        externalId: accident.externalId,
        cycleId: accident.cycleId,
        cycleLabel: `${accident.cycle.month}/${accident.cycle.year}`,
        employeeName: accident.employee?.name ?? null,
      },
    };
  }
}
