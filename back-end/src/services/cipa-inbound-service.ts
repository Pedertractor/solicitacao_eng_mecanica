import { $Enums } from '../generated/prisma/client.js';
import { HttpError } from '../https/errors/index.js';
import { cycleStatusLabel } from '../lib/status-labels.js';
import { averageCents, centsToNumber, toCents } from '../lib/fixed-point.js';
import { prisma } from '../lib/prisma.js';
import { CycleParticipantPrismaRepository } from '../repositories/prisma/monthly-cycle-repository.js';
import { EmployeePrismaRepository } from '../repositories/prisma/employee-repository.js';
import { SectorPrismaRepository } from '../repositories/prisma/sector-repository.js';
import { SafetyAccidentPrismaRepository } from '../repositories/prisma/safety-repository.js';
import { P5AuditService } from './p5-audit-service.js';
import { SafetyCalculationService } from './safety-calculation-service.js';
import {
  auditActionForOperation,
  classifyActOperation,
  classifyConditionOperation,
  compareSourceChangedAt,
  diffAccidentStates,
  isVisibleSafetyOccurrence,
  normalizeActor,
  safetyScoreFieldsChanged,
  toComparableState,
  type ExternalActorSnapshot,
  type PreviousNature,
  type SafetyAccidentSnapshot,
  type SyncOperation,
} from './safety-accident-state.js';

export type CipaAccidentInboundPayload = {
  externalId: string;
  costCenter: string;
  unit: 'PEDERTRACTOR' | 'TRACTOR';
  cardNumber: string;
  accidentType: 'WITH_LEAVE' | 'WITHOUT_LEAVE';
  occurredAt: string;
  daysAway?: number | null;
  description?: string | null;
  cycleYear?: number;
  cycleMonth?: number;
};

export type CipaPutActPayload = {
  nature: 'ACT';
  previousNature: PreviousNature;
  costCenter: string;
  unit: 'PEDERTRACTOR' | 'TRACTOR';
  cardNumber: string;
  accidentType: 'WITH_LEAVE' | 'WITHOUT_LEAVE';
  occurredAt: string;
  daysAway?: number | null;
  description?: string | null;
  cycleYear?: number;
  cycleMonth?: number;
  sourceChangedAt: string;
  actor: ExternalActorSnapshot;
};

export type CipaPutConditionPayload = {
  nature: 'CONDITION';
  previousNature: PreviousNature;
  occurredAt: string;
  cycleYear?: number;
  cycleMonth?: number;
  sourceChangedAt: string;
  reason?: string | null;
  actor: ExternalActorSnapshot;
};

export type CipaPutPayload = CipaPutActPayload | CipaPutConditionPayload;

export type CipaDeletePayload = {
  sourceChangedAt: string;
  reason?: string | null;
  actor: ExternalActorSnapshot;
};

type CycleWithProgram = Awaited<ReturnType<typeof resolveTargetCycle>>;

function assertCycleEditable(status: $Enums.CycleStatus, message?: string) {
  if (
    status === $Enums.CycleStatus.HOMOLOGATED ||
    status === $Enums.CycleStatus.LOCKED
  ) {
    throw new HttpError(
      message ??
        'Não é possível alterar ocorrências de um ciclo homologado ou bloqueado',
      409,
    );
  }
}

async function resolveTargetCycle(input: {
  cycleYear?: number;
  cycleMonth?: number;
  occurredAt: Date;
}) {
  if (input.cycleYear !== undefined && input.cycleMonth !== undefined) {
    if (input.cycleMonth < 1 || input.cycleMonth > 12) {
      throw new HttpError('cycleMonth inválido', 400);
    }

    const pinned = await prisma.monthlyCycle.findFirst({
      where: { year: input.cycleYear, month: input.cycleMonth },
      include: { programYear: true },
    });

    if (!pinned) {
      throw new HttpError(
        `Ciclo ${input.cycleMonth}/${input.cycleYear} não encontrado no P5. Abra um ciclo antes de registrar acidentes.`,
        404,
      );
    }

    return pinned;
  }

  const working = await prisma.monthlyCycle.findFirst({
    where: {
      status: {
        in: [$Enums.CycleStatus.OPEN, $Enums.CycleStatus.CALCULATED],
      },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: { programYear: true },
  });

  if (working) {
    return working;
  }

  const cycleYear = input.occurredAt.getUTCFullYear();
  const cycleMonth = input.occurredAt.getUTCMonth() + 1;

  const cycle = await prisma.monthlyCycle.findFirst({
    where: { year: cycleYear, month: cycleMonth },
    include: { programYear: true },
  });

  if (!cycle) {
    throw new HttpError(
      `Ciclo ${cycleMonth}/${cycleYear} não encontrado no P5. Abra um ciclo antes de registrar acidentes.`,
      404,
    );
  }

  return cycle;
}

function buildSnapshot(
  row: {
    id: string;
    externalId: string;
    sourceSystem: $Enums.SourceSystem;
    cycleId: string;
    employeeId: string | null;
    sectorId: string;
    accidentType: $Enums.AccidentType;
    status: $Enums.AccidentStatus;
    occurredAt: Date;
    daysAway: number | null;
    description: string | null;
    sourceChangedAt: Date | null;
    cancelledAt: Date | null;
    employee?: { name: string; employeeId: string; unit: string } | null;
    sector?: { name: string; code: string | null } | null;
    cycle?: { year: number; month: number } | null;
  },
  extras?: { cardNumber?: string | null; unit?: string | null },
): SafetyAccidentSnapshot {
  return {
    id: row.id,
    externalId: row.externalId,
    sourceSystem: row.sourceSystem,
    cycleId: row.cycleId,
    cycleYear: row.cycle?.year ?? null,
    cycleMonth: row.cycle?.month ?? null,
    employeeId: row.employeeId,
    employeeName: row.employee?.name ?? null,
    cardNumber: extras?.cardNumber ?? row.employee?.employeeId ?? null,
    unit: extras?.unit ?? row.employee?.unit ?? null,
    sectorId: row.sectorId,
    sectorName: row.sector?.name ?? null,
    costCenter: row.sector?.code ?? null,
    accidentType: row.accidentType,
    status: row.status,
    occurredAt: row.occurredAt.toISOString(),
    daysAway: row.daysAway,
    description: row.description,
    sourceChangedAt: row.sourceChangedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  };
}

async function buildImpact(cycleId: string, employeeId: string, sectorId: string) {
  const [employee, sector, cycle, scores] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId } }),
    prisma.sector.findUnique({ where: { id: sectorId } }),
    prisma.monthlyCycle.findUnique({ where: { id: cycleId } }),
    prisma.employeePillarScore.findMany({
      where: {
        participant: { cycleId, activeInCycle: true },
        pillar: { code: $Enums.PillarCode.SAFETY },
      },
      select: {
        internalScore: true,
        weightedPoints: true,
        participant: { select: { employeeId: true, sectorId: true } },
      },
    }),
  ]);

  const employeeScore = scores.find(
    (row) => row.participant.employeeId === employeeId,
  );
  const sectorEmployees = scores.filter(
    (row) => row.participant.sectorId === sectorId,
  );
  const sectorAvg =
    sectorEmployees.length === 0
      ? null
      : centsToNumber(
          averageCents(sectorEmployees.map((row) => toCents(row.weightedPoints))),
        );
  const factoryAvg =
    scores.length === 0
      ? null
      : centsToNumber(
          averageCents(scores.map((row) => toCents(row.weightedPoints))),
        );

  return {
    employee: {
      employeeId,
      name: employee?.name ?? '',
      internalTotal: employeeScore
        ? centsToNumber(toCents(employeeScore.internalScore))
        : null,
      weightedP5: employeeScore
        ? centsToNumber(toCents(employeeScore.weightedPoints))
        : null,
    },
    sector: {
      sectorId,
      name: sector?.name ?? '',
      costCenter: sector?.code ?? null,
      participantsCount: sectorEmployees.length,
      weightedP5Avg: sectorAvg,
    },
    factory: {
      cycleId,
      cycleLabel: cycle ? `${cycle.month}/${cycle.year}` : '',
      participantsCount: scores.length,
      weightedP5Avg: factoryAvg,
    },
  };
}

function buildSyncResponse(input: {
  operation: SyncOperation;
  changed: boolean;
  accident: SafetyAccidentSnapshot | null;
  matched?: {
    employeeId: string;
    employeeName: string;
    sectorId: string;
    sectorName: string;
    cycleId: string;
    cycleMonth: number;
    cycleYear: number;
  } | null;
  recalculatedCycleIds: string[];
  historyId: string | null;
}) {
  return {
    operation: input.operation,
    changed: input.changed,
    visibleInP5:
      input.accident != null &&
      isVisibleSafetyOccurrence({ status: input.accident.status }),
    accident: input.accident
      ? {
          id: input.accident.id,
          externalId: input.accident.externalId,
          nature: 'ACT' as const,
          accidentType: input.accident.accidentType,
          status: input.accident.status,
          occurredAt: input.accident.occurredAt,
        }
      : null,
    matched: input.matched ?? null,
    recalculated: input.recalculatedCycleIds.length > 0,
    recalculatedCycleIds: input.recalculatedCycleIds,
    historyId: input.historyId,
    created:
      input.operation === 'CREATED' || input.operation === 'RECLASSIFIED_TO_ACT',
  };
}

export class CipaInboundService {
  private accidentRepo = new SafetyAccidentPrismaRepository(prisma);

  async ingestAccident(payload: CipaAccidentInboundPayload) {
    const now = new Date();
    return this.putAccident(payload.externalId, {
      nature: 'ACT',
      previousNature: null,
      costCenter: payload.costCenter,
      unit: payload.unit,
      cardNumber: payload.cardNumber,
      accidentType: payload.accidentType,
      occurredAt: payload.occurredAt,
      ...(payload.daysAway !== undefined ? { daysAway: payload.daysAway } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      ...(payload.cycleYear !== undefined ? { cycleYear: payload.cycleYear } : {}),
      ...(payload.cycleMonth !== undefined
        ? { cycleMonth: payload.cycleMonth }
        : {}),
      sourceChangedAt: now.toISOString(),
      actor: normalizeActor({
        externalId: 'legacy-cipa-api',
        name: 'Integração CIPA legada',
        identifier: 'API_KEY',
      }),
    });
  }

  async putAccident(externalId: string, payload: CipaPutPayload) {
    const normalizedExternalId = externalId.trim();
    if (!normalizedExternalId) {
      throw new HttpError('externalId inválido', 400);
    }

    const actor = normalizeActor(payload.actor);
    const sourceChangedAt = new Date(payload.sourceChangedAt);
    if (Number.isNaN(sourceChangedAt.getTime())) {
      throw new HttpError('sourceChangedAt inválido', 400);
    }

    const existing = await this.accidentRepo.findCipaByExternalId(
      normalizedExternalId,
    );
    const existingSnapshot = existing
      ? buildSnapshot(existing, {
          cardNumber: existing.employee?.employeeId ?? null,
          unit: existing.employee?.unit ?? null,
        })
      : null;

    if (payload.nature === 'CONDITION') {
      return this.handleConditionPut({
        externalId: normalizedExternalId,
        payload,
        actor,
        sourceChangedAt,
        existing,
        existingSnapshot,
      });
    }

    return this.handleActPut({
      externalId: normalizedExternalId,
      payload,
      actor,
      sourceChangedAt,
      existing,
      existingSnapshot,
    });
  }

  async cancelAccident(externalId: string, payload: CipaDeletePayload) {
    const normalizedExternalId = externalId.trim();
    if (!normalizedExternalId) {
      throw new HttpError('externalId inválido', 400);
    }

    const actor = normalizeActor(payload.actor);
    const sourceChangedAt = new Date(payload.sourceChangedAt);
    if (Number.isNaN(sourceChangedAt.getTime())) {
      throw new HttpError('sourceChangedAt inválido', 400);
    }

    const existing = await this.accidentRepo.findCipaByExternalId(
      normalizedExternalId,
    );
    if (!existing) {
      throw new HttpError('Ocorrência não encontrada', 404);
    }

    assertCycleEditable(existing.cycle.status);

    const ordering = compareSourceChangedAt(
      existing.sourceChangedAt,
      sourceChangedAt,
    );
    if (ordering === 'STALE') {
      await this.logRejected({
        externalId: normalizedExternalId,
        cycleId: existing.cycleId,
        actor,
        sourceChangedAt,
        reason: 'Evento mais antigo que o último estado recebido',
        payload,
      });
      throw new HttpError(
        'Evento mais antigo que o último estado recebido',
        409,
      );
    }

    const before = buildSnapshot(existing, {
      cardNumber: existing.employee?.employeeId ?? null,
      unit: existing.employee?.unit ?? null,
    });

    if (
      existing.status === $Enums.AccidentStatus.CANCELLED &&
      ordering === 'UNCHANGED'
    ) {
      return buildSyncResponse({
        operation: 'UNCHANGED',
        changed: false,
        accident: before,
        matched: this.buildMatched(existing),
        recalculatedCycleIds: [],
        historyId: null,
      });
    }

    const now = new Date();
    let historyId: string | null = null;

    const updated = await prisma.$transaction(async (tx) => {
      const repo = new SafetyAccidentPrismaRepository(tx);
      const audit = new P5AuditService(tx);
      const row = await repo.cancelById(existing.id, {
        sourceChangedAt,
        cancelledAt: now,
        lastSyncedAt: now,
      });
      const after = buildSnapshot(
        { ...row, employee: existing.employee, sector: existing.sector, cycle: existing.cycle },
        {
          cardNumber: existing.employee?.employeeId ?? null,
          unit: existing.employee?.unit ?? null,
        },
      );
      const log = await audit.logAccidentChange({
        action: 'CIPA_ACCIDENT_CANCEL',
        accidentId: row.id,
        externalId: normalizedExternalId,
        cycleId: row.cycleId,
        before,
        after,
        actor,
        sourceChangedAt,
        changedFields: diffAccidentStates(
          toComparableState(before),
          toComparableState(after),
        ),
        reason: payload.reason ?? null,
      });
      historyId = log.id;
      return after;
    });

    await this.recalculateAffected([
      { cycleId: existing.cycleId, employeeId: existing.employeeId },
    ]);

    return buildSyncResponse({
      operation: 'CANCELLED',
      changed: true,
      accident: updated,
      matched: this.buildMatched(existing),
      recalculatedCycleIds: [existing.cycleId],
      historyId,
    });
  }

  private async handleConditionPut(input: {
    externalId: string;
    payload: CipaPutConditionPayload;
    actor: ExternalActorSnapshot;
    sourceChangedAt: Date;
    existing: Awaited<ReturnType<SafetyAccidentPrismaRepository['findCipaByExternalId']>>;
    existingSnapshot: SafetyAccidentSnapshot | null;
  }) {
    const operation = classifyConditionOperation({
      existing: input.existingSnapshot,
      previousNature: input.payload.previousNature,
    });

    if (operation === 'IGNORED_CONDITION') {
      return buildSyncResponse({
        operation,
        changed: false,
        accident: null,
        recalculatedCycleIds: [],
        historyId: null,
      });
    }

    if (!input.existing || !input.existingSnapshot) {
      const occurredAt = new Date(input.payload.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) {
        throw new HttpError('occurredAt inválido', 400);
      }
      const cycle = await resolveTargetCycle({
        occurredAt,
        ...(input.payload.cycleYear !== undefined
          ? { cycleYear: input.payload.cycleYear }
          : {}),
        ...(input.payload.cycleMonth !== undefined
          ? { cycleMonth: input.payload.cycleMonth }
          : {}),
      });

      const log = await new P5AuditService().logAccidentChange({
        action: 'CIPA_ACCIDENT_CHANGE_REJECTED',
        externalId: input.externalId,
        cycleId: cycle.id,
        actor: input.actor,
        sourceChangedAt: input.sourceChangedAt,
        previousNature: input.payload.previousNature,
        nature: 'CONDITION',
        reason:
          input.payload.reason ??
          'Transição ato → condição recebida sem acidente correspondente no P5',
      });

      return buildSyncResponse({
        operation: 'RECLASSIFIED_TO_CONDITION',
        changed: false,
        accident: null,
        matched: {
          employeeId: '',
          employeeName: '',
          sectorId: '',
          sectorName: '',
          cycleId: cycle.id,
          cycleMonth: cycle.month,
          cycleYear: cycle.year,
        },
        recalculatedCycleIds: [],
        historyId: log.id,
      });
    }

    assertCycleEditable(input.existing.cycle.status);

    const ordering = compareSourceChangedAt(
      input.existing.sourceChangedAt,
      input.sourceChangedAt,
    );
    if (ordering === 'STALE') {
      await this.logRejected({
        externalId: input.externalId,
        cycleId: input.existing.cycleId,
        actor: input.actor,
        sourceChangedAt: input.sourceChangedAt,
        reason: 'Evento mais antigo que o último estado recebido',
        payload: input.payload,
      });
      throw new HttpError(
        'Evento mais antigo que o último estado recebido',
        409,
      );
    }

    if (
      input.existing.status === $Enums.AccidentStatus.CANCELLED &&
      ordering === 'UNCHANGED'
    ) {
      return buildSyncResponse({
        operation: 'UNCHANGED',
        changed: false,
        accident: input.existingSnapshot,
        matched: this.buildMatched(input.existing),
        recalculatedCycleIds: [],
        historyId: null,
      });
    }

    const before = input.existingSnapshot;
    const now = new Date();
    let historyId: string | null = null;

    const after = await prisma.$transaction(async (tx) => {
      const repo = new SafetyAccidentPrismaRepository(tx);
      const audit = new P5AuditService(tx);
      const row = await repo.cancelById(input.existing!.id, {
        sourceChangedAt: input.sourceChangedAt,
        cancelledAt: now,
        lastSyncedAt: now,
      });
      const snapshot = buildSnapshot(
        {
          ...row,
          employee: input.existing!.employee,
          sector: input.existing!.sector,
          cycle: input.existing!.cycle,
        },
        {
          cardNumber: input.existing!.employee?.employeeId ?? null,
          unit: input.existing!.employee?.unit ?? null,
        },
      );
      const log = await audit.logAccidentChange({
        action: 'CIPA_ACCIDENT_RECLASSIFY_TO_CONDITION',
        accidentId: row.id,
        externalId: input.externalId,
        cycleId: row.cycleId,
        before,
        after: snapshot,
        actor: input.actor,
        sourceChangedAt: input.sourceChangedAt,
        previousNature: input.payload.previousNature,
        nature: 'CONDITION',
        changedFields: diffAccidentStates(
          toComparableState(before),
          toComparableState(snapshot),
        ),
        reason: input.payload.reason ?? null,
      });
      historyId = log.id;
      return snapshot;
    });

    await this.recalculateAffected([
      { cycleId: input.existing.cycleId, employeeId: input.existing.employeeId },
    ]);

    return buildSyncResponse({
      operation: 'RECLASSIFIED_TO_CONDITION',
      changed: true,
      accident: after,
      matched: this.buildMatched(input.existing),
      recalculatedCycleIds: [input.existing.cycleId],
      historyId,
    });
  }

  private async handleActPut(input: {
    externalId: string;
    payload: CipaPutActPayload;
    actor: ExternalActorSnapshot;
    sourceChangedAt: Date;
    existing: Awaited<ReturnType<SafetyAccidentPrismaRepository['findCipaByExternalId']>>;
    existingSnapshot: SafetyAccidentSnapshot | null;
  }) {
    const occurredAt = new Date(input.payload.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new HttpError('occurredAt inválido', 400);
    }

    const cycle = await resolveTargetCycle({
      occurredAt,
      ...(input.payload.cycleYear !== undefined
        ? { cycleYear: input.payload.cycleYear }
        : {}),
      ...(input.payload.cycleMonth !== undefined
        ? { cycleMonth: input.payload.cycleMonth }
        : {}),
    });

    if (input.existing) {
      assertCycleEditable(input.existing.cycle.status);
    }
    assertCycleEditable(
      cycle.status,
      `Ciclo ${cycle.month}/${cycle.year} (${cycleStatusLabel(cycle.status)}) não aceita ocorrências`,
    );

    const sectorRepo = new SectorPrismaRepository(prisma);
    const sector = await sectorRepo.findByCode(input.payload.costCenter.trim());
    if (!sector) {
      throw new HttpError(
        `Setor não encontrado para centro de custo: ${input.payload.costCenter}`,
        404,
      );
    }

    const employeeRepo = new EmployeePrismaRepository(prisma);
    const employee = await employeeRepo.findByUnitAndCardNumber(
      input.payload.unit,
      input.payload.cardNumber.trim(),
    );
    if (!employee) {
      throw new HttpError(
        `Colaborador não encontrado: cartão ${input.payload.cardNumber} / ${input.payload.unit}`,
        404,
      );
    }

    if (input.existing) {
      const ordering = compareSourceChangedAt(
        input.existing.sourceChangedAt,
        input.sourceChangedAt,
      );
      if (ordering === 'STALE') {
        await this.logRejected({
          externalId: input.externalId,
          cycleId: input.existing.cycleId,
          actor: input.actor,
          sourceChangedAt: input.sourceChangedAt,
          reason: 'Evento mais antigo que o último estado recebido',
          payload: input.payload,
        });
        throw new HttpError(
          'Evento mais antigo que o último estado recebido',
          409,
        );
      }
    }

    const nextComparable = {
      cycleId: cycle.id,
      employeeId: employee.id,
      sectorId: sector.id,
      accidentType: input.payload.accidentType as $Enums.AccidentType,
      status: $Enums.AccidentStatus.VALIDATED,
      occurredAt: occurredAt.toISOString(),
      daysAway: input.payload.daysAway ?? null,
      description: input.payload.description ?? null,
    };

    const operation = classifyActOperation({
      existing: input.existingSnapshot,
      next: nextComparable,
      previousNature: input.payload.previousNature,
    });

    if (operation === 'UNCHANGED' && input.existing) {
      return buildSyncResponse({
        operation,
        changed: false,
        accident: input.existingSnapshot,
        matched: this.buildMatched(input.existing, cycle),
        recalculatedCycleIds: [],
        historyId: null,
      });
    }

    if (
      input.existing &&
      compareSourceChangedAt(
        input.existing.sourceChangedAt,
        input.sourceChangedAt,
      ) === 'UNCHANGED'
    ) {
      await this.logRejected({
        externalId: input.externalId,
        cycleId: input.existing.cycleId,
        actor: input.actor,
        sourceChangedAt: input.sourceChangedAt,
        reason: 'Conflito de sincronização para o mesmo timestamp',
        payload: input.payload,
      });
      throw new HttpError(
        'Conflito de sincronização para o mesmo timestamp',
        409,
      );
    }

    const before = input.existingSnapshot;
    const previousCycleId = input.existing?.cycleId ?? null;
    const now = new Date();
    let historyId: string | null = null;
    let afterSnapshot: SafetyAccidentSnapshot;

    afterSnapshot = await prisma.$transaction(async (tx) => {
      const participantRepo = new CycleParticipantPrismaRepository(tx);
      await participantRepo.upsert({
        cycleId: cycle.id,
        employeeId: employee.id,
        sectorId: sector.id,
        employeeNameSnapshot: employee.name,
        sectorNameSnapshot: sector.name,
        unitSnapshot: employee.unit,
        activeInCycle: true,
      });

      const repo = new SafetyAccidentPrismaRepository(tx);
      const audit = new P5AuditService(tx);
      const row = await repo.upsertBySourceAndExternalId({
        cycleId: cycle.id,
        sourceSystem: $Enums.SourceSystem.CIPA,
        externalId: input.externalId,
        employeeId: employee.id,
        sectorId: sector.id,
        accidentType: input.payload.accidentType as $Enums.AccidentType,
        occurredAt,
        daysAway: input.payload.daysAway ?? null,
        description: input.payload.description ?? null,
        status: $Enums.AccidentStatus.VALIDATED,
        rawPayload: input.payload as object,
        lastSyncedAt: now,
        sourceChangedAt: input.sourceChangedAt,
        cancelledAt: null,
        reviewedAt: now,
        reviewedByUserId: null,
        rejectionReason: null,
      });

      const snapshot = buildSnapshot(
        {
          ...row,
          employee,
          sector,
          cycle,
        },
        {
          cardNumber: employee.employeeId,
          unit: employee.unit,
        },
      );

      const auditAction = auditActionForOperation(operation);
      if (auditAction) {
        const log = await audit.logAccidentChange({
          action: auditAction,
          accidentId: row.id,
          externalId: input.externalId,
          cycleId: row.cycleId,
          before,
          after: snapshot,
          actor: input.actor,
          sourceChangedAt: input.sourceChangedAt,
          previousNature: input.payload.previousNature,
          nature: 'ACT',
          changedFields: diffAccidentStates(
            before ? toComparableState(before) : null,
            toComparableState(snapshot),
          ),
          previousCycleId,
        });
        historyId = log.id;
      }

      return snapshot;
    });

    const cycleIds = new Set<string>([cycle.id]);
    if (previousCycleId && previousCycleId !== cycle.id) {
      cycleIds.add(previousCycleId);
    }

    const changed = before
      ? diffAccidentStates(toComparableState(before), nextComparable)
      : [];
    const shouldRecalculate =
      operation === 'CREATED' ||
      operation === 'RESTORED' ||
      operation === 'RECLASSIFIED_TO_ACT' ||
      safetyScoreFieldsChanged(changed);

    if (shouldRecalculate) {
      const targets: Array<{ cycleId: string; employeeId: string | null }> = [
        { cycleId: cycle.id, employeeId: employee.id },
      ];
      if (previousCycleId && previousCycleId !== cycle.id) {
        targets.push({
          cycleId: previousCycleId,
          employeeId: employee.id,
        });
      }
      if (before?.employeeId && before.employeeId !== employee.id) {
        targets.push({ cycleId: cycle.id, employeeId: before.employeeId });
        if (previousCycleId) {
          targets.push({
            cycleId: previousCycleId,
            employeeId: before.employeeId,
          });
        }
      }
      await this.recalculateAffected(targets);
      await prisma.monthlyCycle.update({
        where: { id: cycle.id },
        data: { calculatedAt: now },
      });
    }

    const impact = shouldRecalculate
      ? await buildImpact(cycle.id, employee.id, sector.id)
      : undefined;

    return {
      ...buildSyncResponse({
        operation,
        changed: operation !== 'UNCHANGED',
        accident: afterSnapshot,
        matched: {
          employeeId: employee.id,
          employeeName: employee.name,
          sectorId: sector.id,
          sectorName: sector.name,
          cycleId: cycle.id,
          cycleMonth: cycle.month,
          cycleYear: cycle.year,
        },
        recalculatedCycleIds: shouldRecalculate ? [...cycleIds] : [],
        historyId,
      }),
      ...(impact ? { impact } : {}),
    };
  }

  private buildMatched(
    existing: NonNullable<
      Awaited<ReturnType<SafetyAccidentPrismaRepository['findCipaByExternalId']>>
    >,
    cycleOverride?: CycleWithProgram,
  ) {
    const cycle = cycleOverride ?? existing.cycle;
    return {
      employeeId: existing.employeeId ?? '',
      employeeName: existing.employee?.name ?? '',
      sectorId: existing.sectorId,
      sectorName: existing.sector?.name ?? '',
      cycleId: cycle.id,
      cycleMonth: cycle.month,
      cycleYear: cycle.year,
    };
  }

  private async recalculateAffected(
    targets: Array<{ cycleId: string; employeeId: string | null | undefined }>,
  ) {
    const byCycle = new Map<string, Set<string>>();
    for (const target of targets) {
      if (!target.cycleId || !target.employeeId) continue;
      const employees = byCycle.get(target.cycleId) ?? new Set<string>();
      employees.add(target.employeeId);
      byCycle.set(target.cycleId, employees);
    }

    const calc = new SafetyCalculationService();
    for (const [cycleId, employeeIds] of byCycle) {
      const cycle = await prisma.monthlyCycle.findUnique({
        where: { id: cycleId },
      });
      if (!cycle) continue;
      if (
        cycle.status === $Enums.CycleStatus.HOMOLOGATED ||
        cycle.status === $Enums.CycleStatus.LOCKED
      ) {
        continue;
      }
      await calc.recalculateEmployees(cycleId, [...employeeIds]);
    }
  }

  private async logRejected(input: {
    externalId: string;
    cycleId?: string | null;
    actor: ExternalActorSnapshot;
    sourceChangedAt: Date;
    reason: string;
    payload: unknown;
  }) {
    await new P5AuditService().log({
      userId: null,
      action: 'CIPA_ACCIDENT_CHANGE_REJECTED',
      entityType: 'CipaAccidentMutation',
      entityId: input.externalId,
      cycleId: input.cycleId ?? null,
      metadata: {
        actorType: 'CIPA_USER',
        actor: input.actor,
        sourceChangedAt: input.sourceChangedAt.toISOString(),
        receivedAt: new Date().toISOString(),
        reason: input.reason,
        payload: JSON.parse(JSON.stringify(input.payload)) as object,
        channel: 'CIPA_API',
      },
    });
  }
}
