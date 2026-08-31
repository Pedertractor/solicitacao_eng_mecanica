import { $Enums, Prisma } from '../generated/prisma/client.js';
import {
  ABSENTEEISM_INDICATOR_CODE,
  ABSENTEEISM_INDIVIDUAL_POINTS,
  ABSENTEEISM_P5_MAX,
  ABSENTEEISM_SECTOR_PLACEHOLDER,
} from '../constants/absenteeism-scoring.js';
import { isCurrentCalendarMonth, padMonth, previousCalendarMonth } from '../lib/calendar-month.js';
import { normalizeCardNumber } from '../lib/card-number.js';
import { centsToFixed2, centsToNumber, toCents } from '../lib/fixed-point.js';
import { prisma } from '../lib/prisma.js';
import { cycleStatusLabel } from '../lib/status-labels.js';
import { HttpError } from '../https/errors/index.js';
import { CycleParticipantPrismaRepository } from '../repositories/prisma/monthly-cycle-repository.js';
import { MonthlyCyclePrismaRepository } from '../repositories/prisma/monthly-cycle-repository.js';
import {
  PillarConfigPrismaRepository,
  ProgramYearPrismaRepository,
} from '../repositories/prisma/program-year-repository.js';
import {
  EmployeePillarScorePrismaRepository,
  IndicatorResultPrismaRepository,
} from '../repositories/prisma/safety-repository.js';
import { AbsenteeismService } from './absenteeism-service.js';
import { ensureAbsenteeismIndividualIndicator } from './absenteeism-indicator-config.js';
import {
  absenteeismEmployeeWarning,
  aggregateAbsenteeismSectors,
  buildAbsenteeismEmployeeScore,
  computeAbsenteeismFactoryBalance,
  countAbsenteeismFactoryOccurrences,
  filterSectorsByCostCenter,
  paginateItems,
  parseAbsenteeismCalculationDetails,
  resolveAbsenteeismScoringConfig,
  summarizeAbsenteeismCycleScores,
  type AbsenteeismEmployeeScore,
  type AbsenteeismSectorSummary,
} from './absenteeism-scoring.js';
import { P5AuditService } from './p5-audit-service.js';
import { rebuildParticipantMonthlyScore } from './participant-monthly-score-service.js';
import { isCycleRecalculating } from './safety-calculation-pending.js';
import { convertInternalToP5Cents } from './safety-calculation-service.js';
import { parseScoringConfig } from './scoring-rules.js';
import type { AbsenteeismRecord } from '../types/absenteeism.js';

const WRITABLE_CYCLE_STATUSES: $Enums.CycleStatus[] = [
  $Enums.CycleStatus.OPEN,
  $Enums.CycleStatus.CALCULATED,
  $Enums.CycleStatus.UNDER_REVIEW,
];

const P5_DATA_LOCKED_STATUSES: $Enums.CycleStatus[] = [
  $Enums.CycleStatus.HOMOLOGATED,
  $Enums.CycleStatus.LOCKED,
];

export function assertCycleWritableForP5Data(
  status: $Enums.CycleStatus,
): void {
  if (P5_DATA_LOCKED_STATUSES.includes(status)) {
    throw new HttpError(
      'Não é possível atualizar dados do P5 de um ciclo homologado ou bloqueado.',
      409,
    );
  }
}

function decimalAsPrisma(cents: number) {
  return new Prisma.Decimal(centsToFixed2(cents));
}

function mapCompanyToUnit(company: string): $Enums.Unit | null {
  const normalized = company.trim().toUpperCase();
  if (normalized === $Enums.Unit.PEDERTRACTOR) {
    return $Enums.Unit.PEDERTRACTOR;
  }
  if (normalized === $Enums.Unit.TRACTOR) {
    return $Enums.Unit.TRACTOR;
  }
  return null;
}

export type AbsenteeismApplyResult =
  | { status: 'skipped'; reason: string }
  | {
      status: 'applied';
      targetCycleId: string;
      targetMonth: number;
      targetYear: number;
      participantsScored: number;
      penalizedCount: number;
      unmatchedProcedureRows: number;
      partial: boolean;
    };

export class AbsenteeismCalculationService {
  constructor(
    private absenteeismService = new AbsenteeismService(),
    private auditService = new P5AuditService(),
  ) {}

  /**
   * Ao abrir um ciclo (ex.: agosto), aplica absenteísmo no ciclo do mês anterior
   * (julho) usando SP_PRJ_ABSENTEISMO com parâmetros do mês fechado.
   */
  async applyForPreviousMonth(
    openedCycleId: string,
    actorUserId?: string | null,
  ): Promise<AbsenteeismApplyResult> {
    const cycleRepo = new MonthlyCyclePrismaRepository(prisma);
    const openedCycle = await cycleRepo.findById(openedCycleId);
    if (!openedCycle) {
      return { status: 'skipped', reason: 'Ciclo aberto não encontrado' };
    }

    const targetCycle = await this.resolvePreviousCycle(openedCycle);
    if (!targetCycle) {
      return {
        status: 'skipped',
        reason: 'Ciclo do mês anterior não encontrado',
      };
    }

    if (!WRITABLE_CYCLE_STATUSES.includes(targetCycle.status)) {
      return {
        status: 'skipped',
        reason: `Ciclo ${targetCycle.month}/${targetCycle.year} não editável (${targetCycle.status})`,
      };
    }

    return this.applyToCycle({
      cycleId: targetCycle.id,
      programYearId: targetCycle.programYearId,
      month: targetCycle.month,
      year: targetCycle.year,
      triggerCycleId: openedCycleId,
      partial: false,
      ...(actorUserId !== undefined ? { actorUserId } : {}),
    });
  }

  /**
   * Cron diário: lê o índice do mês em andamento no ciclo OPEN e grava
   * resultado parcial (quem está abaixo de 100 já gera perda coletiva e
   * individual, com aviso de que o mês ainda pode mudar).
   */
  async applyPartialForOpenCycles(): Promise<AbsenteeismApplyResult[]> {
    const openCycles = await prisma.monthlyCycle.findMany({
      where: { status: $Enums.CycleStatus.OPEN },
      orderBy: [{ openedAt: 'asc' }],
    });

    const results: AbsenteeismApplyResult[] = [];
    for (const cycle of openCycles) {
      try {
        results.push(
          await this.applyToCycle({
            cycleId: cycle.id,
            programYearId: cycle.programYearId,
            month: cycle.month,
            year: cycle.year,
            partial: true,
          }),
        );
      } catch (error) {
        console.error(
          `AbsenteeismCalculationService.partial: falha no ciclo ${cycle.id}:`,
          error,
        );
      }
    }
    return results;
  }

  async applyDailyUpdates(): Promise<{
    previous: AbsenteeismApplyResult[];
    current: AbsenteeismApplyResult[];
  }> {
    const previous = await this.retryPendingForRecentlyOpenedCycles();
    const current = await this.applyPartialForOpenCycles();
    return { previous, current };
  }

  /**
   * Recálculo manual (simulação): consulta o Firebird do mês informado e
   * grava no ciclo correspondente. Mês civil atual → parcial. Homologado/bloqueado → 409.
   */
  async forceApplyByMonth(input: {
    month: number;
    year: number;
    actorUserId?: string | null;
  }) {
    const cycle = await prisma.monthlyCycle.findFirst({
      where: { month: input.month, year: input.year },
      include: { programYear: true },
    });
    if (!cycle) {
      throw new HttpError(
        `Ciclo ${padMonth(input.month)}/${input.year} não encontrado.`,
        404,
      );
    }

    assertCycleWritableForP5Data(cycle.status);

    if (!WRITABLE_CYCLE_STATUSES.includes(cycle.status)) {
      throw new HttpError(
        `O ciclo ${cycle.month}/${cycle.year} ainda está em rascunho. Abra o ciclo antes de calcular o absenteísmo.`,
        409,
      );
    }

    const partial = isCurrentCalendarMonth(input.month, input.year);
    const result = await this.applyToCycle({
      cycleId: cycle.id,
      programYearId: cycle.programYearId,
      month: cycle.month,
      year: cycle.year,
      partial,
      ...(input.actorUserId !== undefined
        ? { actorUserId: input.actorUserId }
        : {}),
    });

    if (result.status === 'skipped') {
      const notFound = result.reason.toLowerCase().includes('não encontrado');
      throw new HttpError(result.reason, notFound ? 404 : 409);
    }

    return {
      ...result,
      cycleLabel: `${cycle.month}/${cycle.year}`,
      cycleStatus: cycle.status,
    };
  }

  async applyToCycle(input: {
    cycleId: string;
    programYearId: string;
    month: number;
    year: number;
    actorUserId?: string | null;
    triggerCycleId?: string | null;
    partial?: boolean;
  }): Promise<AbsenteeismApplyResult> {
    const cycleRepo = new MonthlyCyclePrismaRepository(prisma);
    const cycle = await cycleRepo.findById(input.cycleId);
    if (!cycle) {
      return { status: 'skipped', reason: 'Ciclo alvo não encontrado' };
    }

    if (!WRITABLE_CYCLE_STATUSES.includes(cycle.status)) {
      return {
        status: 'skipped',
        reason: `Ciclo ${cycle.month}/${cycle.year} não editável (${cycle.status})`,
      };
    }

    const pillarRepo = new PillarConfigPrismaRepository(prisma);
    const absenteeismPillar = await pillarRepo.findByProgramYearAndCode(
      input.programYearId,
      $Enums.PillarCode.ABSENTEEISM,
    );
    if (!absenteeismPillar) {
      return {
        status: 'skipped',
        reason: 'Pilar Absenteísmo não configurado no programa',
      };
    }

    const individualIndicator = await ensureAbsenteeismIndividualIndicator(
      absenteeismPillar.id,
    );

    const participantRepo = new CycleParticipantPrismaRepository(prisma);
    const participants = await participantRepo.findActiveByCycleId(input.cycleId);
    if (participants.length === 0) {
      return { status: 'skipped', reason: 'Ciclo alvo sem participantes ativos' };
    }

    const firebirdData = await this.absenteeismService.listByPeriod(
      padMonth(input.month),
      String(input.year),
    );

    const absenteeismByKey = buildAbsenteeismLookup(firebirdData.records);
    const matchedProcedureKeys = new Set<string>();
    const calculatedAt = new Date();
    let penalizedCount = 0;

    const scoringConfig = resolveAbsenteeismScoringConfig(
      parseScoringConfig(cycle.scoringConfig),
    );
    const indices = participants.map((participant) => {
      const cardNumber = normalizeCardNumber(participant.employee.employeeId);
      const lookupKey = `${participant.unitSnapshot}:${cardNumber}`;
      const record = absenteeismByKey.get(lookupKey) ?? null;
      return record?.absenteeism ?? null;
    });
    const factoryBalance = computeAbsenteeismFactoryBalance({
      config: scoringConfig,
      factoryOccurrenceCount: countAbsenteeismFactoryOccurrences(indices),
    });

    const prepared = participants.map((participant, index) => {
      const cardNumber = normalizeCardNumber(participant.employee.employeeId);
      const lookupKey = `${participant.unitSnapshot}:${cardNumber}`;
      const record = absenteeismByKey.get(lookupKey) ?? null;
      if (record) {
        matchedProcedureKeys.add(lookupKey);
      }

      const score = buildAbsenteeismEmployeeScore({
        absenteeism: indices[index] ?? null,
        config: scoringConfig,
        factoryBalance,
      });
      if (score.individualDeducted) {
        penalizedCount += 1;
      }

      return {
        participantId: participant.id,
        employeeId: participant.employeeId,
        sectorId: participant.sectorId,
        cardNumber,
        unit: participant.unitSnapshot,
        record,
        score,
      };
    });

    const partial = input.partial === true;

    await persistPreparedAbsenteeismRows({
      cycleId: input.cycleId,
      programYearId: input.programYearId,
      absenteeismPillarId: absenteeismPillar.id,
      individualIndicatorId: individualIndicator.id,
      prepared: prepared.map((row) => ({
        participantId: row.participantId,
        employeeId: row.employeeId,
        sectorId: row.sectorId,
        score: row.score,
      })),
      source: 'PEDERTRACTOR',
      partial,
      calculatedAt,
      absenteeismPenalties: scoringConfig.absenteeism,
    });

    const unmatchedProcedureRows =
      firebirdData.records.length - matchedProcedureKeys.size;

    await this.auditService.log({
      userId: input.actorUserId ?? null,
      action: 'ABSENTEEISM_CALCULATE',
      entityType: 'MonthlyCycle',
      entityId: input.cycleId,
      cycleId: input.cycleId,
      metadata: {
        pillarCode: $Enums.PillarCode.ABSENTEEISM,
        sourceMonth: input.month,
        sourceYear: input.year,
        triggerCycleId: input.triggerCycleId ?? null,
        participantsScored: prepared.length,
        penalizedCount,
        unmatchedProcedureRows,
        firebirdCount: firebirdData.count,
        partial,
      },
    });

    return {
      status: 'applied',
      targetCycleId: input.cycleId,
      targetMonth: input.month,
      targetYear: input.year,
      participantsScored: prepared.length,
      penalizedCount,
      unmatchedProcedureRows,
      partial,
    };
  }

  /**
   * Aplica um índice de absenteísmo informado a um único colaborador no ciclo.
   * Usado pela simulação de desenvolvimento (não consulta o Firebird).
   */
  async scoreEmployeeOnCycle(input: {
    cycleId: string;
    employeeId: string;
    absenteeism: number;
    actorUserId?: string | null;
    source?: 'PEDERTRACTOR' | 'SIMULATION';
  }) {
    const cycleRepo = new MonthlyCyclePrismaRepository(prisma);
    const cycle = await cycleRepo.findById(input.cycleId);
    if (!cycle) {
      throw new HttpError('Ciclo não encontrado', 404);
    }

    assertCycleWritableForP5Data(cycle.status);

    if (!WRITABLE_CYCLE_STATUSES.includes(cycle.status)) {
      throw new HttpError(
        `Ciclo ${cycle.month}/${cycle.year} não editável (${cycleStatusLabel(cycle.status)})`,
        409,
      );
    }

    const pillarRepo = new PillarConfigPrismaRepository(prisma);
    const absenteeismPillar = await pillarRepo.findByProgramYearAndCode(
      cycle.programYearId,
      $Enums.PillarCode.ABSENTEEISM,
    );
    if (!absenteeismPillar) {
      throw new HttpError(
        'Pilar Absenteísmo não configurado no programa',
        400,
      );
    }

    const individualIndicator = await ensureAbsenteeismIndividualIndicator(
      absenteeismPillar.id,
    );

    const participantRepo = new CycleParticipantPrismaRepository(prisma);
    const participants = await participantRepo.findActiveByCycleId(input.cycleId);
    const target = participants.find(
      (row) => row.employeeId === input.employeeId,
    );
    if (!target) {
      throw new HttpError(
        'Colaborador não é participante ativo neste ciclo',
        404,
      );
    }

    const existingScores =
      participants.length === 0
        ? []
        : await prisma.employeePillarScore.findMany({
            where: {
              participantId: { in: participants.map((row) => row.id) },
              pillar: { code: $Enums.PillarCode.ABSENTEEISM },
            },
          });
    const detailsByParticipant = new Map(
      existingScores.map((score) => [
        score.participantId,
        parseAbsenteeismCalculationDetails(score.calculationDetails),
      ]),
    );

    const scoringConfig = resolveAbsenteeismScoringConfig(
      parseScoringConfig(cycle.scoringConfig),
    );
    const indices = participants.map((row) => {
      if (row.employeeId === input.employeeId) return input.absenteeism;
      return detailsByParticipant.get(row.id)?.absenteeism ?? null;
    });
    const factoryBalance = computeAbsenteeismFactoryBalance({
      config: scoringConfig,
      factoryOccurrenceCount: countAbsenteeismFactoryOccurrences(indices),
    });

    const prepared = participants.map((row, index) => ({
      participantId: row.id,
      employeeId: row.employeeId,
      sectorId: row.sectorId,
      score: buildAbsenteeismEmployeeScore({
        absenteeism: indices[index] ?? null,
        config: scoringConfig,
        factoryBalance,
      }),
    }));
    const score = prepared.find((row) => row.employeeId === input.employeeId)!
      .score;
    const calculatedAt = new Date();
    const source = input.source ?? 'PEDERTRACTOR';

    await persistPreparedAbsenteeismRows({
      cycleId: input.cycleId,
      programYearId: cycle.programYearId,
      absenteeismPillarId: absenteeismPillar.id,
      individualIndicatorId: individualIndicator.id,
      prepared,
      source,
      partial: false,
      calculatedAt,
      absenteeismPenalties: scoringConfig.absenteeism,
    });

    await this.auditService.log({
      userId: input.actorUserId ?? null,
      action:
        source === 'SIMULATION'
          ? 'ABSENTEEISM_SIMULATE'
          : 'ABSENTEEISM_CALCULATE',
      entityType: 'MonthlyCycle',
      entityId: input.cycleId,
      cycleId: input.cycleId,
      metadata: {
        pillarCode: $Enums.PillarCode.ABSENTEEISM,
        employeeId: input.employeeId,
        absenteeism: input.absenteeism,
        individualDeducted: score.individualDeducted,
        weightedP5: score.weightedP5,
        factoryOccurrenceCount: score.factoryOccurrenceCount,
        source,
      },
    });

    return {
      cycle: {
        id: cycle.id,
        month: cycle.month,
        year: cycle.year,
        status: cycle.status,
      },
      employee: {
        id: target.employeeId,
        name: target.employeeNameSnapshot,
        cardNumber: target.employee.employeeId,
      },
      score,
    };
  }

  async getResults(
    cycleId: string,
    options?: {
      page?: number;
      pageSize?: number;
      costCenter?: string;
    },
  ) {
    const cycle = await this.requireCycle(cycleId);
    const { participants, scores } =
      await this.loadAbsenteeismParticipantsAndScores(cycleId);

    const summary = summarizeAbsenteeismCycleScores(
      scores.map((score) => {
        const details = parseAbsenteeismCalculationDetails(
          score.calculationDetails,
        );
        return {
          weightedP5Cents: toCents(score.weightedPoints),
          internalCents: toCents(score.internalScore),
          individualDeducted: details?.individualDeducted ?? false,
          partial: details?.partial ?? false,
          calculatedAt: score.calculatedAt,
        };
      }),
    );

    const includeSectors = options?.page != null;
    let sectors: AbsenteeismSectorSummary[] = [];
    let pagination: ReturnType<typeof paginateItems<AbsenteeismSectorSummary>>['pagination'];

    if (includeSectors) {
      const scoreByParticipant = new Map(
        scores.map((score) => [score.participantId, score]),
      );
      const aggregated = filterSectorsByCostCenter(
        aggregateAbsenteeismSectors(
          participants.map((participant) => {
            const score = scoreByParticipant.get(participant.id);
            const details = score
              ? parseAbsenteeismCalculationDetails(score.calculationDetails)
              : null;
            return {
              sectorId: participant.sectorId,
              sectorName: participant.sector.name,
              costCenter: participant.sector.code ?? null,
              hasScore: Boolean(score),
              internalCents: score ? toCents(score.internalScore) : 0,
              weightedP5Cents: score ? toCents(score.weightedPoints) : 0,
              individualDeducted: details?.individualDeducted ?? false,
              partial: details?.partial ?? false,
            };
          }),
        ),
        options?.costCenter,
      );
      const paged = paginateItems(aggregated, {
        page: options!.page!,
        ...(options?.pageSize != null ? { pageSize: options.pageSize } : {}),
      });
      sectors = paged.items;
      pagination = paged.pagination;
    }

    return {
      cycleId: cycle.id,
      month: cycle.month,
      year: cycle.year,
      p5Max: ABSENTEEISM_P5_MAX,
      ...summary,
      sectors,
      ...(pagination ? { pagination } : {}),
      recalculating: isCycleRecalculating(cycleId),
    };
  }

  async getSectorDetail(
    cycleId: string,
    sectorId: string,
    options?: { page?: number; pageSize?: number },
  ) {
    const cycle = await this.requireCycle(cycleId);
    const { participants, scores } =
      await this.loadAbsenteeismParticipantsAndScores(cycleId);
    const sectorParticipants = participants.filter(
      (participant) => participant.sectorId === sectorId,
    );

    if (sectorParticipants.length === 0) {
      throw new HttpError('Setor sem participantes ativos neste ciclo', 404);
    }

    const scoreByParticipant = new Map(
      scores.map((score) => [score.participantId, score]),
    );
    const allEmployees = sectorParticipants
      .map((participant) =>
        mapAbsenteeismEmployeeDetail(
          participant,
          scoreByParticipant.get(participant.id) ?? null,
        ),
      )
      .sort((a, b) => {
        const scoreA = a.weightedP5 ?? Number.POSITIVE_INFINITY;
        const scoreB = b.weightedP5 ?? Number.POSITIVE_INFINITY;
        return scoreA - scoreB || a.name.localeCompare(b.name, 'pt-BR');
      });

    const sectorSummary = aggregateAbsenteeismSectors(
      sectorParticipants.map((participant) => {
        const score = scoreByParticipant.get(participant.id);
        const details = score
          ? parseAbsenteeismCalculationDetails(score.calculationDetails)
          : null;
        return {
          sectorId: participant.sectorId,
          sectorName: participant.sector.name,
          costCenter: participant.sector.code ?? null,
          hasScore: Boolean(score),
          internalCents: score ? toCents(score.internalScore) : 0,
          weightedP5Cents: score ? toCents(score.weightedPoints) : 0,
          individualDeducted: details?.individualDeducted ?? false,
          partial: details?.partial ?? false,
        };
      }),
    )[0]!;

    const paged = paginateItems(allEmployees, {
      page: options?.page ?? 1,
      pageSize: options?.pageSize ?? 10,
    });

    return {
      cycle: {
        id: cycle.id,
        month: cycle.month,
        year: cycle.year,
        status: cycle.status,
      },
      sector: sectorSummary,
      employees: paged.items,
      pagination: paged.pagination ?? {
        page: 1,
        pageSize: allEmployees.length || 1,
        totalItems: allEmployees.length,
        totalPages: 1,
      },
    };
  }

  async getParticipantDetail(cycleId: string, participantId: string) {
    const cycle = await this.requireCycle(cycleId);
    const participant = await prisma.cycleParticipant.findFirst({
      where: { id: participantId, cycleId },
      include: { employee: true, sector: true },
    });
    if (!participant) {
      throw new HttpError('Participante não encontrado neste ciclo', 404);
    }

    const score = await prisma.employeePillarScore.findFirst({
      where: {
        participantId,
        pillar: { code: $Enums.PillarCode.ABSENTEEISM },
      },
    });

    return {
      cycle: {
        id: cycle.id,
        month: cycle.month,
        year: cycle.year,
        status: cycle.status,
      },
      employee: mapAbsenteeismEmployeeDetail(participant, score),
    };
  }

  private async requireCycle(cycleId: string) {
    const cycleRepo = new MonthlyCyclePrismaRepository(prisma);
    const cycle = await cycleRepo.findById(cycleId);
    if (!cycle) {
      throw new HttpError('Ciclo não encontrado', 404);
    }
    return cycle;
  }

  private async loadAbsenteeismParticipantsAndScores(cycleId: string) {
    const participantRepo = new CycleParticipantPrismaRepository(prisma);
    const participants = await participantRepo.findActiveByCycleId(cycleId);
    const participantIds = participants.map((participant) => participant.id);
    const scores =
      participantIds.length === 0
        ? []
        : await prisma.employeePillarScore.findMany({
            where: {
              participantId: { in: participantIds },
              pillar: { code: $Enums.PillarCode.ABSENTEEISM },
            },
          });

    return { participants, scores };
  }

  /**
   * Retenta ciclos abertos recentemente cujo mês anterior ainda não tem
   * pontuação de Absenteísmo gravada.
   */
  async retryPendingForRecentlyOpenedCycles(): Promise<AbsenteeismApplyResult[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 45);

    const openCycles = await prisma.monthlyCycle.findMany({
      where: {
        status: $Enums.CycleStatus.OPEN,
        openedAt: { gte: cutoff },
      },
      orderBy: [{ openedAt: 'asc' }],
    });

    const results: AbsenteeismApplyResult[] = [];

    for (const openedCycle of openCycles) {
      const targetCycle = await this.resolvePreviousCycle(openedCycle);
      if (!targetCycle) continue;
      if (!WRITABLE_CYCLE_STATUSES.includes(targetCycle.status)) continue;

      const pending = await this.cycleNeedsAbsenteeismCalculation(
        targetCycle.id,
      );
      if (!pending) continue;

      try {
        const result = await this.applyForPreviousMonth(openedCycle.id, null);
        results.push(result);
      } catch (error) {
        console.error(
          `AbsenteeismCalculationService.retry: falha ao aplicar para ciclo ${openedCycle.id}:`,
          error,
        );
      }
    }

    return results;
  }

  private async resolvePreviousCycle(openedCycle: {
    month: number;
    year: number;
    programYearId: string;
  }) {
    const prev = previousCalendarMonth(openedCycle.month, openedCycle.year);
    const cycleRepo = new MonthlyCyclePrismaRepository(prisma);

    const sameProgramCycle = await cycleRepo.findByProgramYearAndMonth(
      openedCycle.programYearId,
      prev.year,
      prev.month,
    );
    if (sameProgramCycle) {
      return sameProgramCycle;
    }

    const programRepo = new ProgramYearPrismaRepository(prisma);
    const previousProgramYear = await programRepo.findByYear(prev.year);
    if (!previousProgramYear) {
      return null;
    }

    return cycleRepo.findByProgramYearAndMonth(
      previousProgramYear.id,
      prev.year,
      prev.month,
    );
  }

  private async cycleNeedsAbsenteeismCalculation(
    cycleId: string,
  ): Promise<boolean> {
    const absenteeismScores = await prisma.employeePillarScore.count({
      where: {
        participant: { cycleId, activeInCycle: true },
        pillar: { code: $Enums.PillarCode.ABSENTEEISM },
      },
    });

    const activeParticipants = await prisma.cycleParticipant.count({
      where: { cycleId, activeInCycle: true },
    });

    return activeParticipants > 0 && absenteeismScores < activeParticipants;
  }
}

function mapAbsenteeismEmployeeDetail(
  participant: {
    id: string;
    employeeId: string;
    employeeNameSnapshot: string;
    sectorId: string;
    sector: { name: string; code: string | null };
    employee: { employeeId: string };
  },
  score: {
    internalScore: Prisma.Decimal | number;
    weightedPoints: Prisma.Decimal | number;
    calculationDetails: unknown;
  } | null,
) {
  const details = score
    ? parseAbsenteeismCalculationDetails(score.calculationDetails)
    : null;

  return {
    participantId: participant.id,
    employeeId: participant.employeeId,
    cardNumber: participant.employee.employeeId,
    name: participant.employeeNameSnapshot,
    sectorId: participant.sectorId,
    sectorName: participant.sector.name,
    costCenter: participant.sector.code ?? null,
    absenteeism: details?.absenteeism ?? null,
    individualPreserved:
      details?.individualPreserved ?? ABSENTEEISM_INDIVIDUAL_POINTS,
    individualDeducted: details?.individualDeducted ?? false,
    sectorPreserved: details?.sectorPreserved ?? ABSENTEEISM_SECTOR_PLACEHOLDER,
    internalScore: score
      ? centsToNumber(toCents(score.internalScore))
      : null,
    weightedP5: score ? centsToNumber(toCents(score.weightedPoints)) : null,
    partial: details?.partial ?? false,
    warning: details?.warning ?? null,
    scoringRuleVersion: details?.scoringRuleVersion,
    factoryOccurrenceCount: details?.factoryOccurrenceCount,
    factoryDeductionP5: details?.factoryDeductionP5,
    factoryBalanceP5: details?.factoryBalanceP5,
    individualDeductionP5: details?.individualDeductionP5,
    factoryZeroed: details?.factoryZeroed,
    zeroedBy: details?.zeroedBy,
    zeroBelowPercent: details?.zeroBelowPercent,
    floorP5: details?.floorP5,
  };
}

function buildAbsenteeismLookup(
  records: AbsenteeismRecord[],
): Map<string, AbsenteeismRecord> {
  const map = new Map<string, AbsenteeismRecord>();

  for (const record of records) {
    const unit = mapCompanyToUnit(record.company);
    if (!unit) continue;

    const cardNumber = normalizeCardNumber(record.cardNumber);
    const key = `${unit}:${cardNumber}`;
    map.set(key, record);
  }

  return map;
}

async function persistPreparedAbsenteeismRows(input: {
  cycleId: string;
  programYearId: string;
  absenteeismPillarId: string;
  individualIndicatorId: string;
  prepared: Array<{
    participantId: string;
    employeeId: string;
    sectorId: string;
    score: AbsenteeismEmployeeScore;
  }>;
  source: 'PEDERTRACTOR' | 'SIMULATION';
  partial: boolean;
  calculatedAt: Date;
  absenteeismPenalties: {
    individualPenaltyP5: number;
    factoryDeductionP5: number;
  };
}) {
  if (input.prepared.length === 0) return;

  const {
    cycleId,
    programYearId,
    absenteeismPillarId,
    individualIndicatorId,
    prepared,
    source,
    partial,
    calculatedAt,
    absenteeismPenalties,
  } = input;

  const txTimeoutMs = Math.min(
    300_000,
    Math.max(15_000, prepared.length * 80),
  );

  await prisma.$transaction(
    async (tx) => {
      const resultRepo = new IndicatorResultPrismaRepository(tx);
      const pillarScoreRepo = new EmployeePillarScorePrismaRepository(tx);
      const chunkSize = 25;

      for (let i = 0; i < prepared.length; i += chunkSize) {
        const chunk = prepared.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (row) => {
            const individualWeightedCents = convertInternalToP5Cents(
              row.score.individualPreserved,
              ABSENTEEISM_P5_MAX,
            );
            const warning = absenteeismEmployeeWarning({
              partial,
              individualDeducted: row.score.individualDeducted,
            });

            await resultRepo.upsert({
              cycleId,
              indicatorId: individualIndicatorId,
              scope: $Enums.IndicatorScope.INDIVIDUAL,
              scopeKey: row.employeeId,
              sectorId: row.sectorId,
              employeeId: row.employeeId,
              rawValue:
                row.score.absenteeism == null
                  ? null
                  : new Prisma.Decimal(row.score.absenteeism),
              targetValue: new Prisma.Decimal(100),
              preservedInternalPoints: new Prisma.Decimal(
                row.score.individualPreserved,
              ),
              weightedP5Points: decimalAsPrisma(individualWeightedCents),
              status: $Enums.ResultStatus.PROVISIONAL,
              calculationDetails: {
                indicatorCode: ABSENTEEISM_INDICATOR_CODE,
                scope: 'INDIVIDUAL',
                employeeId: row.employeeId,
                sectorId: row.sectorId,
                absenteeism: row.score.absenteeism,
                scoringRuleVersion: 2,
                individualPreserved: row.score.individualPreserved,
                individualDeducted: row.score.individualDeducted,
                factoryOccurrenceCount: row.score.factoryOccurrenceCount,
                factoryDeductionP5: row.score.factoryDeductionP5,
                factoryBalanceP5: row.score.factoryBalanceP5,
                individualDeductionP5: row.score.individualDeductionP5,
                threshold: 100,
                rule: 'FACTORY_BALANCE_PLUS_INDIVIDUAL_BELOW_100',
                partial,
                warning,
                source,
                calculatedAt: calculatedAt.toISOString(),
              },
              calculatedAt,
            });

            await pillarScoreRepo.upsert({
              participantId: row.participantId,
              pillarId: absenteeismPillarId,
              internalScore: new Prisma.Decimal(row.score.internalTotal),
              weightedPoints: decimalAsPrisma(row.score.weightedP5Cents),
              status: $Enums.ResultStatus.PROVISIONAL,
              calculationDetails: {
                sectorId: row.sectorId,
                absenteeism: row.score.absenteeism,
                scoringRuleVersion: 2,
                individualPreserved: row.score.individualPreserved,
                individualDeducted: row.score.individualDeducted,
                sectorPreserved: row.score.sectorPreserved,
                internalTotal: row.score.internalTotal,
                weightedP5Cents: row.score.weightedP5Cents,
                weightedP5: row.score.weightedP5,
                factoryOccurrenceCount: row.score.factoryOccurrenceCount,
                factoryDeductionP5: row.score.factoryDeductionP5,
                factoryBalanceP5: row.score.factoryBalanceP5,
                individualDeductionP5: row.score.individualDeductionP5,
                factoryZeroed: row.score.factoryZeroed,
                zeroedBy: row.score.zeroedBy,
                zeroedByThreshold: row.score.zeroedByThreshold,
                zeroBelowPercent: row.score.zeroBelowPercent,
                floorP5: row.score.floorP5,
                configSnapshot: {
                  absenteeism: absenteeismPenalties,
                },
                partial,
                warning,
                source,
                calculatedAt: calculatedAt.toISOString(),
              },
              calculatedAt,
            });

            await rebuildParticipantMonthlyScore({
              tx,
              participantId: row.participantId,
              programYearId,
              calculatedAt,
            });
          }),
        );
      }
    },
    { maxWait: 20_000, timeout: txTimeoutMs },
  );
}

export { mapCompanyToUnit, buildAbsenteeismLookup, WRITABLE_CYCLE_STATUSES };
