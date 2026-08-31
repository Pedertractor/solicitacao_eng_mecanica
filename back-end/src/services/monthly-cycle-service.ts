import { $Enums, Prisma } from '../generated/prisma/client.js';
import {
  ANNUAL_BASE_POINTS,
  CYCLES_PER_PROGRAM_YEAR,
  MONTHLY_BASE_POINTS,
} from '../constants/p5-scoring.js';
import { HttpError } from '../https/errors/index.js';
import {
  averageCents,
  centsToNumber,
  decimalToUnits,
  divFloor,
  intUnitsToCents,
  toCents,
} from '../lib/fixed-point.js';
import { prisma } from '../lib/prisma.js';
import { cycleStatusLabel } from '../lib/status-labels.js';
import { isCycleRecalculating } from './safety-calculation-pending.js';
import { EmployeePrismaRepository } from '../repositories/prisma/employee-repository.js';
import {
  CycleParticipantPrismaRepository,
  MonthlyCyclePrismaRepository,
} from '../repositories/prisma/monthly-cycle-repository.js';
import { SafetyAccidentPrismaRepository } from '../repositories/prisma/safety-repository.js';
import { ProgramYearPrismaRepository } from '../repositories/prisma/program-year-repository.js';
import { EmployeeSyncService } from './employee-sync-service.js';
import { P5AuditService } from './p5-audit-service.js';
import {
  computeAverageFromTotalCents,
  computeAveragePoints,
  computeVisiblePoints,
  computeVisiblePointsCents,
  DEFAULT_PILLAR_MAX,
  filterPillarCodeList,
  filterPillarScores,
  type PillarMaxConfig,
  scopeAccidentsCount,
  type ScopedPillarCodes,
  visibleMaxPoints,
} from './pillar-scope-service.js';
import { SafetyCalculationService } from './safety-calculation-service.js';
import { AbsenteeismCalculationService } from './absenteeism-calculation-service.js';
import { parseAbsenteeismCalculationDetails } from './absenteeism-scoring.js';
import {
  defaultScoringConfigV2,
  isScoringConfigV2,
  parseScoringConfig,
} from './scoring-rules.js';

const ALLOWED_TRANSITIONS: Record<$Enums.CycleStatus, $Enums.CycleStatus[]> = {
  DRAFT: [$Enums.CycleStatus.OPEN],
  // OPEN/CALCULATED → UNDER_REVIEW: revisão explícita antes de abrir outro mês
  OPEN: [$Enums.CycleStatus.CALCULATED, $Enums.CycleStatus.UNDER_REVIEW],
  CALCULATED: [$Enums.CycleStatus.UNDER_REVIEW],
  // Homologação já bloqueia o ciclo (irreversível).
  UNDER_REVIEW: [$Enums.CycleStatus.LOCKED],
  // Mantido para ciclos legados que ficaram em HOMOLOGATED sem lock.
  HOMOLOGATED: [$Enums.CycleStatus.LOCKED],
  LOCKED: [],
};

function assertTransition(
  from: $Enums.CycleStatus,
  to: $Enums.CycleStatus,
) {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new HttpError(
      `Transição de status inválida: ${cycleStatusLabel(from)} → ${cycleStatusLabel(to)}`,
      400,
    );
  }
}

async function loadPillarConfigsForCycle(
  cycleId: string,
): Promise<PillarMaxConfig[]> {
  const cycle = await prisma.monthlyCycle.findUnique({
    where: { id: cycleId },
    select: {
      programYear: {
        select: {
          pillars: {
            select: { code: true, maxPoints: true },
          },
        },
      },
    },
  });
  if (!cycle || cycle.programYear.pillars.length === 0) {
    return DEFAULT_PILLAR_MAX;
  }
  return cycle.programYear.pillars.map((pillar) => ({
    code: pillar.code,
    maxPoints: decimalToUnits(pillar.maxPoints),
  }));
}

export class MonthlyCycleService {
  /**
   * Garante os 12 ciclos mensais (jan–dez) do programa anual em DRAFT.
   * Idempotente: meses já existentes não são recriados.
   * Cada ciclo representa até MONTHLY_BASE_POINTS (100) por colaborador;
   * no ano completo: ANNUAL_BASE_POINTS (1200).
   */
  async ensureYearCycles(
    programYearId: string,
    actorUserId?: string | null,
  ) {
    const programRepo = new ProgramYearPrismaRepository(prisma);
    const program = await programRepo.findById(programYearId);
    if (!program) throw new HttpError('Programa anual não encontrado', 404);

    const repo = new MonthlyCyclePrismaRepository(prisma);
    const beforeCount = await repo.countByProgramYearId(programYearId);

    const payload = Array.from({ length: CYCLES_PER_PROGRAM_YEAR }, (_, i) => ({
      programYearId,
      month: i + 1,
      year: program.year,
      status: $Enums.CycleStatus.DRAFT,
    }));

    const created = await repo.createManySkipDuplicates(payload);
    const afterCount = await repo.countByProgramYearId(programYearId);

    await new P5AuditService().log({
      userId: actorUserId ?? null,
      action: 'CYCLES_ENSURE_YEAR',
      entityType: 'ProgramYear',
      entityId: programYearId,
      metadata: {
        year: program.year,
        created: created.count,
        total: afterCount,
        monthlyBasePoints: MONTHLY_BASE_POINTS,
        annualBasePoints: ANNUAL_BASE_POINTS,
      },
    });

    const cycles = await this.list({ programYearId });

    return {
      programYearId,
      year: program.year,
      created: created.count,
      alreadyExisted: beforeCount,
      total: afterCount,
      monthlyBasePoints: MONTHLY_BASE_POINTS,
      annualBasePoints: ANNUAL_BASE_POINTS,
      cycles,
    };
  }

  async list(
    filters?: { programYearId?: string; year?: number },
    allowedPillarCodes?: ScopedPillarCodes,
  ) {
    const repo = new MonthlyCyclePrismaRepository(prisma);
    const accidentRepo = new SafetyAccidentPrismaRepository(prisma);
    const rows = await repo.findAll(filters);
    const cycles = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        programYearId: row.programYearId,
        programName: row.programYear.name,
        month: row.month,
        year: row.year,
        status: row.status,
        basePointsPerEmployee: MONTHLY_BASE_POINTS,
        participantsCount: row._count.participants,
        accidentsCount: scopeAccidentsCount(
          await accidentRepo.countRealAccidentsByCycleId(row.id),
          allowedPillarCodes ?? null,
        ),
        openedAt: row.openedAt?.toISOString() ?? null,
        calculatedAt: row.calculatedAt?.toISOString() ?? null,
        submittedAt: row.submittedAt?.toISOString() ?? null,
        homologatedAt: row.homologatedAt?.toISOString() ?? null,
        lockedAt: row.lockedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    );
    return cycles;
  }

  async getById(id: string, allowedPillarCodes?: ScopedPillarCodes) {
    const repo = new MonthlyCyclePrismaRepository(prisma);
    const accidentRepo = new SafetyAccidentPrismaRepository(prisma);
    const row = await repo.findById(id);
    if (!row) throw new HttpError('Ciclo não encontrado', 404);
    return {
      id: row.id,
      programYearId: row.programYearId,
      programName: row.programYear.name,
      programYear: row.programYear.year,
      month: row.month,
      year: row.year,
      status: row.status,
      basePointsPerEmployee: MONTHLY_BASE_POINTS,
      annualBasePointsIfFullYear: ANNUAL_BASE_POINTS,
      participantsCount: row._count.participants,
      accidentsCount: scopeAccidentsCount(
        await accidentRepo.countRealAccidentsByCycleId(row.id),
        allowedPillarCodes ?? null,
      ),
      openedAt: row.openedAt?.toISOString() ?? null,
      calculatedAt: row.calculatedAt?.toISOString() ?? null,
      recalculating: isCycleRecalculating(row.id),
      submittedAt: row.submittedAt?.toISOString() ?? null,
      homologatedAt: row.homologatedAt?.toISOString() ?? null,
      lockedAt: row.lockedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** @deprecated Use ensureYearCycles — ciclos do ano são gerados em lote. */
  async create(input: {
    programYearId: string;
    month: number;
    year: number;
    actorUserId?: string | null;
  }) {
    if (input.month < 1 || input.month > 12) {
      throw new HttpError('Mês inválido', 400);
    }

    const ensured = await this.ensureYearCycles(
      input.programYearId,
      input.actorUserId,
    );
    const cycle = ensured.cycles.find((c) => c.month === input.month);
    if (!cycle) {
      throw new HttpError('Ciclo não encontrado após geração anual', 500);
    }
    return this.getById(cycle.id);
  }

  async syncParticipants(
    cycleId: string,
    options?: {
      refreshFromApi?: boolean;
      actorUserId?: string | null;
    },
  ) {
    const cycle = await this.getById(cycleId);
    if (
      cycle.status === $Enums.CycleStatus.HOMOLOGATED ||
      cycle.status === $Enums.CycleStatus.LOCKED
    ) {
      throw new HttpError(
        'Não é possível sincronizar participantes de ciclo homologado ou bloqueado',
        400,
      );
    }
    if (
      cycle.status !== $Enums.CycleStatus.DRAFT &&
      cycle.status !== $Enums.CycleStatus.OPEN
    ) {
      throw new HttpError(
        'Sincronização de participantes permitida apenas em Rascunho ou Aberto',
        400,
      );
    }

    let employeeSync: Awaited<
      ReturnType<EmployeeSyncService['syncFromPedertractor']>
    > | null = null;

    if (options?.refreshFromApi) {
      employeeSync = await new EmployeeSyncService().syncFromPedertractor(
        options.actorUserId,
      );
    }

    const employeeRepo = new EmployeePrismaRepository(prisma);
    const employees = await employeeRepo.findAllActiveWithSector();
    const participantRepo = new CycleParticipantPrismaRepository(prisma);

    const keepIds: string[] = [];
    let upserted = 0;

    for (const employee of employees) {
      if (!employee.currentSectorId || !employee.currentSector) continue;
      keepIds.push(employee.id);
      await participantRepo.upsert({
        cycleId,
        employeeId: employee.id,
        sectorId: employee.currentSectorId,
        employeeNameSnapshot: employee.name,
        sectorNameSnapshot: employee.currentSector.name,
        unitSnapshot: employee.unit,
        activeInCycle: true,
      });
      upserted += 1;
    }

    const deactivated = await participantRepo.deactivateMissing(
      cycleId,
      keepIds,
    );

    await new P5AuditService().log({
      userId: options?.actorUserId ?? null,
      action: 'PARTICIPANTS_SYNC',
      entityType: 'CycleParticipant',
      entityId: cycleId,
      cycleId,
      metadata: {
        upserted,
        deactivated: deactivated.count,
        employeeSync,
      },
    });

    return {
      upserted,
      deactivated: deactivated.count,
      employeeSync,
      participants: (await this.listParticipants(cycleId)).participants,
    };
  }

  async listParticipants(
    cycleId: string,
    options?: {
      page?: number;
      pageSize?: number;
      cardNumber?: string;
      unit?: string;
    },
    allowedPillarCodes?: ScopedPillarCodes,
  ) {
    const cycle = await this.getById(cycleId);
    const pillarConfigs = allowedPillarCodes
      ? await loadPillarConfigsForCycle(cycleId)
      : null;
    const repo = new CycleParticipantPrismaRepository(prisma);
    const rows = await repo.findByCycleId(cycleId);

    const cardQuery = options?.cardNumber?.trim() ?? '';
    const unitQuery = options?.unit?.trim() ?? '';

    const mapped = rows.map((row) => {
      const rawPillarScores = row.pillarScores.map((ps) => ({
        pillarCode: ps.pillar.code,
        pillarName: ps.pillar.name,
        internalScore: centsToNumber(toCents(ps.internalScore)),
        weightedPoints: centsToNumber(toCents(ps.weightedPoints)),
        status: ps.status,
        absenteeism:
          ps.pillar.code === $Enums.PillarCode.ABSENTEEISM
            ? parseAbsenteeismCalculationDetails(ps.calculationDetails)
            : null,
      }));

      const pillarScores =
        allowedPillarCodes !== undefined
          ? filterPillarScores(rawPillarScores, allowedPillarCodes)
          : rawPillarScores;

      const monthlyScore = row.monthlyScore
        ? {
            totalPoints:
              allowedPillarCodes !== undefined && pillarConfigs
                ? computeVisiblePoints(
                    rawPillarScores,
                    pillarConfigs,
                    allowedPillarCodes,
                  )
                : centsToNumber(toCents(row.monthlyScore.totalPoints)),
            status: row.monthlyScore.status,
            isPartial: row.monthlyScore.isPartial,
            calculatedPillars:
              allowedPillarCodes !== undefined
                ? filterPillarCodeList(
                    row.monthlyScore.calculatedPillars,
                    allowedPillarCodes,
                  )
                : row.monthlyScore.calculatedPillars,
            pendingPillars:
              allowedPillarCodes !== undefined
                ? filterPillarCodeList(
                    row.monthlyScore.pendingPillars,
                    allowedPillarCodes,
                  )
                : row.monthlyScore.pendingPillars,
            calculatedAt: row.monthlyScore.calculatedAt.toISOString(),
          }
        : null;

      return {
        id: row.id,
        cycleId: row.cycleId,
        employeeId: row.employeeId,
        cardNumber: row.employee.employeeId,
        sectorId: row.sectorId,
        employeeNameSnapshot: row.employeeNameSnapshot,
        sectorNameSnapshot: row.sectorNameSnapshot,
        sectorCostCenter: row.sector?.code ?? null,
        unitSnapshot: row.unitSnapshot,
        activeInCycle: row.activeInCycle,
        createdAt: row.createdAt.toISOString(),
        monthlyScore,
        pillarScores,
        scopedTotalPoints:
          allowedPillarCodes !== undefined && pillarConfigs
            ? computeVisiblePoints(
                rawPillarScores,
                pillarConfigs,
                allowedPillarCodes,
              )
            : monthlyScore?.totalPoints ?? null,
      };
    });

    const filtered = mapped.filter((p) => {
      const matchesCard =
        !cardQuery ||
        p.cardNumber.includes(cardQuery) ||
        p.cardNumber.replace(/\D/g, '').includes(cardQuery.replace(/\D/g, ''));
      const matchesUnit = !unitQuery || p.unitSnapshot === unitQuery;
      return matchesCard && matchesUnit;
    });

    const allParticipants = filtered.sort((a, b) => {
      const pointsA =
        a.scopedTotalPoints ??
        a.monthlyScore?.totalPoints ??
        Number.POSITIVE_INFINITY;
      const pointsB =
        b.scopedTotalPoints ??
        b.monthlyScore?.totalPoints ??
        Number.POSITIVE_INFINITY;
      if (pointsA !== pointsB) return pointsA - pointsB;
      return a.employeeNameSnapshot.localeCompare(
        b.employeeNameSnapshot,
        'pt-BR',
      );
    });

    const paginate = options?.page != null;
    const pageSize = paginate
      ? Math.min(Math.max(options?.pageSize ?? 10, 1), 10)
      : allParticipants.length || 1;
    const totalItems = allParticipants.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
    const page = paginate
      ? Math.min(Math.max(options!.page!, 1), totalPages)
      : 1;
    const participants = paginate
      ? allParticipants.slice((page - 1) * pageSize, page * pageSize)
      : allParticipants;

    return {
      participants: participants.map(({ scopedTotalPoints: _s, ...rest }) => rest),
      ...(paginate
        ? {
            pagination: {
              page,
              pageSize,
              totalItems,
              totalPages,
            },
          }
        : {}),
    };
  }

  /**
   * Abre um ciclo (DRAFT → OPEN). Sempre sincroniza setores/colaboradores
   * com a API base e monta os participantes. Qualquer mês ainda em DRAFT
   * pode ser aberto (não exige ordem jan→dez). Só um ciclo pode estar em
   * trabalho (OPEN/CALCULATED): o anterior precisa ser revisado
   * (UNDER_REVIEW) antes de abrir outro mês.
   */
  async open(cycleId: string, actorUserId?: string | null) {
    const cycle = await this.getById(cycleId);
    assertTransition(cycle.status, $Enums.CycleStatus.OPEN);

    const repo = new MonthlyCyclePrismaRepository(prisma);
    const working = await repo.findWorkingByProgramYear(
      cycle.programYearId,
      cycleId,
    );

    if (working.length > 0) {
      const current = working[0]!;
      throw new HttpError(
        `Não é possível abrir outro ciclo enquanto ${current.month}/${current.year} estiver em trabalho (${cycleStatusLabel(current.status)}). Confirme a revisão do ciclo anterior primeiro.`,
        409,
      );
    }

    const now = new Date();

    const syncResult = await this.syncParticipants(cycleId, {
      refreshFromApi: true,
      ...(actorUserId !== undefined ? { actorUserId } : {}),
    });

    const program = await new ProgramYearPrismaRepository(prisma).findById(
      cycle.programYearId,
    );
    const parsedProgramConfig = parseScoringConfig(program?.scoringConfig);
    const scoringSnapshot = isScoringConfigV2(parsedProgramConfig)
      ? parsedProgramConfig
      : defaultScoringConfigV2();

    await prisma.monthlyCycle.update({
      where: { id: cycleId },
      data: {
        status: $Enums.CycleStatus.OPEN,
        openedAt: now,
        scoringConfig: scoringSnapshot as unknown as Prisma.InputJsonValue,
      },
    });

    const safetyRecalculated =
      await new SafetyCalculationService().recalculateIfApplicable(
        cycleId,
        actorUserId,
      );

    let absenteeismApplied: Awaited<
      ReturnType<AbsenteeismCalculationService['applyForPreviousMonth']>
    > | null = null;
    try {
      absenteeismApplied =
        await new AbsenteeismCalculationService().applyForPreviousMonth(
          cycleId,
          actorUserId,
        );
    } catch (error) {
      console.error(
        `MonthlyCycleService.open: falha ao aplicar absenteísmo do mês anterior (ciclo ${cycleId}):`,
        error,
      );
    }

    await new P5AuditService().log({
      userId: actorUserId ?? null,
      action: 'CYCLE_OPEN',
      entityType: 'MonthlyCycle',
      entityId: cycleId,
      cycleId,
      before: { status: cycle.status },
      after: { status: $Enums.CycleStatus.OPEN },
      metadata: {
        participantsUpserted: syncResult.upserted,
        participantsDeactivated: syncResult.deactivated,
        employeeSync: syncResult.employeeSync,
        safetyRecalculated,
        absenteeismApplied,
      },
    });

    return {
      cycle: await this.getById(cycleId),
      sync: {
        employeeSync: syncResult.employeeSync,
        participantsUpserted: syncResult.upserted,
        participantsDeactivated: syncResult.deactivated,
      },
    };
  }

  /**
   * Zera resultados/ocorrências/participantes e volta todos os ciclos para DRAFT.
   */
  async resetAllCycles(
    programYearId?: string,
    actorUserId?: string | null,
  ) {
    if (programYearId) {
      const program = await new ProgramYearPrismaRepository(prisma).findById(
        programYearId,
      );
      if (!program) throw new HttpError('Programa anual não encontrado', 404);
    }

    const summary = await prisma.$transaction(async (tx) => {
      const cycleIds = programYearId
        ? (
            await tx.monthlyCycle.findMany({
              where: { programYearId },
              select: { id: true },
            })
          ).map((c) => c.id)
        : (
            await tx.monthlyCycle.findMany({ select: { id: true } })
          ).map((c) => c.id);

      const participantIds = (
        await tx.cycleParticipant.findMany({
          where: { cycleId: { in: cycleIds } },
          select: { id: true },
        })
      ).map((p) => p.id);

      const monthlyScores = await tx.employeeMonthlyScore.deleteMany({
        where: { participantId: { in: participantIds } },
      });
      const pillarScores = await tx.employeePillarScore.deleteMany({
        where: { participantId: { in: participantIds } },
      });
      const participants = await tx.cycleParticipant.deleteMany({
        where: { cycleId: { in: cycleIds } },
      });
      const accidents = await tx.safetyAccident.deleteMany({
        where: { cycleId: { in: cycleIds } },
      });
      const indicatorResults = await tx.indicatorResult.deleteMany({
        where: { cycleId: { in: cycleIds } },
      });

      const cycles = await new MonthlyCyclePrismaRepository(tx).resetAllToDraft(
        programYearId,
      );

      return {
        monthlyScores: monthlyScores.count,
        pillarScores: pillarScores.count,
        participants: participants.count,
        accidents: accidents.count,
        indicatorResults: indicatorResults.count,
        cyclesReset: cycles.count,
      };
    });

    await new P5AuditService().log({
      userId: actorUserId ?? null,
      action: 'CYCLES_RESET_ALL',
      entityType: 'MonthlyCycle',
      entityId: programYearId ?? 'all',
      metadata: summary as unknown as object,
    });

    return summary;
  }

  async calculate(cycleId: string, actorUserId?: string | null) {
    const cycle = await this.getById(cycleId);
    if (
      cycle.status === $Enums.CycleStatus.HOMOLOGATED ||
      cycle.status === $Enums.CycleStatus.LOCKED
    ) {
      throw new HttpError(
        'Ciclo homologado ou bloqueado não pode ser recalculado',
        400,
      );
    }

    if (
      cycle.status !== $Enums.CycleStatus.OPEN &&
      cycle.status !== $Enums.CycleStatus.CALCULATED
    ) {
      throw new HttpError(
        'Cálculo permitido apenas com ciclo Aberto ou Calculado',
        400,
      );
    }

    const safetyResult = await new SafetyCalculationService().calculate(
      cycleId,
      actorUserId,
    );

    const repo = new MonthlyCyclePrismaRepository(prisma);
    if (cycle.status === $Enums.CycleStatus.OPEN) {
      assertTransition(cycle.status, $Enums.CycleStatus.CALCULATED);
      await repo.updateStatus(cycleId, {
        status: $Enums.CycleStatus.CALCULATED,
        calculatedAt: new Date(),
      });
    } else {
      await repo.updateStatus(cycleId, {
        status: $Enums.CycleStatus.CALCULATED,
        calculatedAt: new Date(),
      });
    }

    await new P5AuditService().log({
      userId: actorUserId ?? null,
      action: 'CYCLE_CALCULATE',
      entityType: 'MonthlyCycle',
      entityId: cycleId,
      cycleId,
      metadata: safetyResult.summary as unknown as object,
    });

    return {
      cycle: await this.getById(cycleId),
      safety: safetyResult,
    };
  }

  async submitReview(cycleId: string, actorUserId?: string | null) {
    const cycle = await this.getById(cycleId);
    assertTransition(cycle.status, $Enums.CycleStatus.UNDER_REVIEW);

    const repo = new MonthlyCyclePrismaRepository(prisma);
    await repo.updateStatus(cycleId, {
      status: $Enums.CycleStatus.UNDER_REVIEW,
      submittedAt: new Date(),
    });

    await new P5AuditService().log({
      userId: actorUserId ?? null,
      action: 'CYCLE_SUBMIT_REVIEW',
      entityType: 'MonthlyCycle',
      entityId: cycleId,
      cycleId,
      before: { status: cycle.status },
      after: { status: $Enums.CycleStatus.UNDER_REVIEW },
    });

    return this.getById(cycleId);
  }

  async homologate(cycleId: string, actorUserId?: string | null) {
    const cycle = await this.getById(cycleId);
    assertTransition(cycle.status, $Enums.CycleStatus.LOCKED);

    const now = new Date();
    const repo = new MonthlyCyclePrismaRepository(prisma);
    await repo.updateStatus(cycleId, {
      status: $Enums.CycleStatus.LOCKED,
      homologatedAt: now,
      lockedAt: now,
    });

    await new P5AuditService().log({
      userId: actorUserId ?? null,
      action: 'CYCLE_HOMOLOGATE',
      entityType: 'MonthlyCycle',
      entityId: cycleId,
      cycleId,
      before: { status: cycle.status },
      after: { status: $Enums.CycleStatus.LOCKED },
    });

    return this.getById(cycleId);
  }

  async lock(cycleId: string, actorUserId?: string | null) {
    const cycle = await this.getById(cycleId);
    assertTransition(cycle.status, $Enums.CycleStatus.LOCKED);

    const repo = new MonthlyCyclePrismaRepository(prisma);
    await repo.updateStatus(cycleId, {
      status: $Enums.CycleStatus.LOCKED,
      lockedAt: new Date(),
    });

    await new P5AuditService().log({
      userId: actorUserId ?? null,
      action: 'CYCLE_LOCK',
      entityType: 'MonthlyCycle',
      entityId: cycleId,
      cycleId,
      before: { status: cycle.status },
      after: { status: $Enums.CycleStatus.LOCKED },
    });

    return this.getById(cycleId);
  }

  async listSafetyHistory(
    cycleId: string,
    options?: {
      page?: number;
      pageSize?: number;
      externalId?: string;
      action?: string;
    },
  ) {
    await this.getById(cycleId);
    const result = await new P5AuditService().listSafetyHistoryByCycle(
      cycleId,
      options,
    );
    return {
      items: result.items.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        cycleId: log.cycleId,
        before: log.before,
        after: log.after,
        metadata: log.metadata,
        userId: log.userId,
        userName: log.user?.name ?? null,
        createdAt: log.createdAt.toISOString(),
      })),
      pagination: result.pagination,
    };
  }

  async listAudit(
    cycleId: string,
    allowedPillarCodes?: ScopedPillarCodes,
  ) {
    await this.getById(cycleId);
    const logs = await new P5AuditService().listByCycle(
      cycleId,
      allowedPillarCodes,
    );
    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      before: log.before,
      after: log.after,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  /**
   * Setores do ciclo com média = soma(pontos dos colaboradores) / n.
   * Sem cálculo mensal ainda, usa MONTHLY_BASE_POINTS (100) por colaborador.
   * Ordenado da menor para a maior média; pagina quando `page` é informado (máx. 10).
   */
  async listSectorsWithAverages(
    cycleId: string,
    options?: {
      page?: number;
      pageSize?: number;
      name?: string;
      costCenter?: string;
    },
    allowedPillarCodes?: ScopedPillarCodes,
  ) {
    const cycle = await this.getById(cycleId);
    const pillarConfigs =
      allowedPillarCodes !== undefined
        ? await loadPillarConfigsForCycle(cycleId)
        : null;
    const scopedMaxPoints =
      allowedPillarCodes !== undefined && pillarConfigs
        ? visibleMaxPoints(pillarConfigs, allowedPillarCodes)
        : MONTHLY_BASE_POINTS;
    const { participants } = await this.listParticipants(
      cycleId,
      undefined,
      allowedPillarCodes,
    );
    const active = participants.filter((p) => p.activeInCycle);

    const bySector = new Map<
      string,
      {
        sectorId: string;
        sectorName: string;
        costCenter: string | null;
        employeesCount: number;
        totalPointsCents: number;
        scoredCount: number;
        baseCount: number;
      }
    >();

    for (const p of active) {
      const pointsCents =
        allowedPillarCodes !== undefined && pillarConfigs
          ? computeVisiblePointsCents(
              p.pillarScores,
              pillarConfigs,
              allowedPillarCodes,
            )
          : p.monthlyScore != null
            ? toCents(p.monthlyScore.totalPoints)
            : intUnitsToCents(MONTHLY_BASE_POINTS);
      const current = bySector.get(p.sectorId) ?? {
        sectorId: p.sectorId,
        sectorName: p.sectorNameSnapshot,
        costCenter: p.sectorCostCenter,
        employeesCount: 0,
        totalPointsCents: 0,
        scoredCount: 0,
        baseCount: 0,
      };
      current.employeesCount += 1;
      current.totalPointsCents += pointsCents;
      if (p.monthlyScore != null) current.scoredCount += 1;
      else current.baseCount += 1;
      bySector.set(p.sectorId, current);
    }

    const nameQuery = options?.name?.trim().toLowerCase() ?? '';
    const costCenterQuery = options?.costCenter?.trim().toLowerCase() ?? '';

    const allSectors = [...bySector.values()]
      .map((s) => ({
        sectorId: s.sectorId,
        sectorName: s.sectorName,
        costCenter: s.costCenter,
        employeesCount: s.employeesCount,
        totalPoints: centsToNumber(s.totalPointsCents),
        averagePoints: computeAverageFromTotalCents(
          s.totalPointsCents,
          s.employeesCount,
        ),
        scoredCount: s.scoredCount,
        usingBasePointsCount: s.baseCount,
        basePointsPerEmployee: scopedMaxPoints,
      }))
      .filter((s) => {
        if (
          nameQuery &&
          !s.sectorName.toLowerCase().includes(nameQuery)
        ) {
          return false;
        }
        if (
          costCenterQuery &&
          !(s.costCenter ?? '').toLowerCase().includes(costCenterQuery)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.averagePoints !== b.averagePoints) {
          return a.averagePoints - b.averagePoints;
        }
        return a.sectorName.localeCompare(b.sectorName, 'pt-BR');
      });

    const factoryPointsCents = active.map((p) =>
      allowedPillarCodes !== undefined && pillarConfigs
        ? computeVisiblePointsCents(
            p.pillarScores,
            pillarConfigs,
            allowedPillarCodes,
          )
        : p.monthlyScore != null
          ? toCents(p.monthlyScore.totalPoints)
          : intUnitsToCents(MONTHLY_BASE_POINTS),
    );
    const factoryEmployeesCount = active.length;
    const factoryTotalPointsCents = factoryPointsCents.reduce(
      (acc, c) => acc + c,
      0,
    );
    const factoryTotalPoints = centsToNumber(factoryTotalPointsCents);
    const factoryAveragePoints = computeAveragePoints(factoryPointsCents);

    const paginate = options?.page != null;
    const pageSize = paginate
      ? Math.min(Math.max(options?.pageSize ?? 10, 1), 10)
      : allSectors.length || 1;
    const totalItems = allSectors.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
    const page = paginate
      ? Math.min(Math.max(options!.page!, 1), totalPages)
      : 1;
    const sectors = paginate
      ? allSectors.slice((page - 1) * pageSize, page * pageSize)
      : allSectors;

    return {
      cycle: {
        id: cycle.id,
        month: cycle.month,
        year: cycle.year,
        status: cycle.status,
        programName: cycle.programName,
      },
      monthlyBasePoints: scopedMaxPoints,
      factory: {
        employeesCount: factoryEmployeesCount,
        totalPoints: factoryTotalPoints,
        averagePoints: factoryAveragePoints,
        sectorsCount: bySector.size,
      },
      sectors,
      ...(paginate
        ? {
            pagination: {
              page,
              pageSize,
              totalItems,
              totalPages,
            },
          }
        : {}),
    };
  }

  async getSectorEmployees(
    cycleId: string,
    sectorId: string,
    allowedPillarCodes?: ScopedPillarCodes,
  ) {
    const cycle = await this.getById(cycleId);
    const pillarConfigs =
      allowedPillarCodes !== undefined
        ? await loadPillarConfigsForCycle(cycleId)
        : null;
    const scopedMaxPoints =
      allowedPillarCodes !== undefined && pillarConfigs
        ? visibleMaxPoints(pillarConfigs, allowedPillarCodes)
        : MONTHLY_BASE_POINTS;
    const { participants } = await this.listParticipants(
      cycleId,
      undefined,
      allowedPillarCodes,
    );
    const inSector = participants.filter(
      (p) => p.activeInCycle && p.sectorId === sectorId,
    );

    if (inSector.length === 0) {
      throw new HttpError(
        'Setor sem participantes ativos neste ciclo',
        404,
      );
    }

    const employees = inSector
      .map((p) => {
        const totalPointsCents =
          allowedPillarCodes !== undefined && pillarConfigs
            ? computeVisiblePointsCents(
                p.pillarScores,
                pillarConfigs,
                allowedPillarCodes,
              )
            : p.monthlyScore != null
              ? toCents(p.monthlyScore.totalPoints)
              : intUnitsToCents(MONTHLY_BASE_POINTS);
        const totalPoints = centsToNumber(totalPointsCents);
        const hasScore = p.monthlyScore != null;
        return {
          participantId: p.id,
          employeeId: p.employeeId,
          name: p.employeeNameSnapshot,
          costCenter: p.sectorCostCenter,
          totalPointsCents,
          totalPoints,
          pointsSource: hasScore ? ('CALCULATED' as const) : ('BASE' as const),
          isPartial: p.monthlyScore?.isPartial ?? true,
          monthlyScore: p.monthlyScore,
          pillarScores: p.pillarScores,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    const pointsCents = employees.map((e) => e.totalPointsCents);
    const totalPointsCents = pointsCents.reduce((acc, c) => acc + c, 0);
    const averagePoints = computeAveragePoints(pointsCents);

    return {
      cycle: {
        id: cycle.id,
        month: cycle.month,
        year: cycle.year,
        status: cycle.status,
        programName: cycle.programName,
      },
      sector: {
        sectorId,
        sectorName: inSector[0]!.sectorNameSnapshot,
        costCenter: inSector[0]!.sectorCostCenter,
        employeesCount: employees.length,
        totalPoints: centsToNumber(totalPointsCents),
        averagePoints,
        basePointsPerEmployee: scopedMaxPoints,
      },
      employees: employees.map(({ totalPointsCents: _cents, ...rest }) => rest),
    };
  }
}