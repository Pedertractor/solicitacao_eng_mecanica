import { $Enums, Prisma } from '../generated/prisma/client.js';
import { HttpError } from '../https/errors/index.js';
import { isCurrentCalendarMonth } from '../lib/calendar-month.js';
import { prisma } from '../lib/prisma.js';
import { MonthlyCyclePrismaRepository } from '../repositories/prisma/monthly-cycle-repository.js';
import { ProgramYearPrismaRepository } from '../repositories/prisma/program-year-repository.js';
import { AbsenteeismCalculationService } from './absenteeism-calculation-service.js';
import { P5AuditService } from './p5-audit-service.js';
import { SafetyCalculationService } from './safety-calculation-service.js';
import {
  defaultScoringConfigV2,
  isScoringConfigV2,
  normalizeScoringConfigInput,
  parseScoringConfig,
  scopeScoringConfigForViewer,
  type PillarCodeString,
  type ScoringConfig,
  type ScoringConfigV2,
} from './scoring-rules.js';

export type EditableCycleSummary = {
  id: string;
  month: number;
  year: number;
  status: $Enums.CycleStatus;
};

export type ProgramYearScoringRulesPayload = {
  config: ScoringConfig;
  editableCycle: EditableCycleSummary | null;
  source: 'cycle' | 'program';
};

export type CycleScoringRulesPayload = {
  cycleId: string;
  month: number;
  year: number;
  status: $Enums.CycleStatus;
  config: ScoringConfig;
  readOnly: true;
};

function toJson(config: ScoringConfigV2): Prisma.InputJsonValue {
  return config as unknown as Prisma.InputJsonValue;
}

function editableSummary(cycle: {
  id: string;
  month: number;
  year: number;
  status: $Enums.CycleStatus;
}): EditableCycleSummary {
  return {
    id: cycle.id,
    month: cycle.month,
    year: cycle.year,
    status: cycle.status,
  };
}

function resolveProgramTemplate(raw: unknown): ScoringConfigV2 {
  const parsed = parseScoringConfig(raw);
  return isScoringConfigV2(parsed) ? parsed : defaultScoringConfigV2();
}

export class ScoringRulesService {
  async getProgramYearRules(
    programYearId: string,
  ): Promise<ProgramYearScoringRulesPayload> {
    const programRepo = new ProgramYearPrismaRepository(prisma);
    const program = await programRepo.findById(programYearId);
    if (!program) {
      throw new HttpError('Programa anual não encontrado', 404);
    }

    const cycleRepo = new MonthlyCyclePrismaRepository(prisma);
    const writable = await cycleRepo.findWritableByProgramYear(programYearId);
    const editableCycle = writable ? editableSummary(writable) : null;

    if (writable?.scoringConfig != null) {
      return {
        config: parseScoringConfig(writable.scoringConfig),
        editableCycle,
        source: 'cycle',
      };
    }

    return {
      config: resolveProgramTemplate(program.scoringConfig),
      editableCycle,
      source: 'program',
    };
  }

  async updateProgramYearRules(
    programYearId: string,
    rawConfig: unknown,
    actorUserId?: string | null,
  ): Promise<ProgramYearScoringRulesPayload> {
    const programRepo = new ProgramYearPrismaRepository(prisma);
    const program = await programRepo.findById(programYearId);
    if (!program) {
      throw new HttpError('Programa anual não encontrado', 404);
    }

    const config = normalizeScoringConfigInput(rawConfig);
    const configJson = toJson(config);
    const before = resolveProgramTemplate(program.scoringConfig);

    await programRepo.updateScoringConfig(programYearId, configJson);

    const cycleRepo = new MonthlyCyclePrismaRepository(prisma);
    const writable = await cycleRepo.findWritableByProgramYear(programYearId);

    let safetyRecalculated = false;
    let absenteeismApplied: Prisma.InputJsonValue | null = null;

    if (writable) {
      await cycleRepo.updateScoringConfig(writable.id, configJson);

      safetyRecalculated =
        await new SafetyCalculationService().recalculateIfApplicable(
          writable.id,
          actorUserId,
        );

      try {
        const result = await new AbsenteeismCalculationService().applyToCycle({
          cycleId: writable.id,
          programYearId: writable.programYearId,
          month: writable.month,
          year: writable.year,
          partial: isCurrentCalendarMonth(writable.month, writable.year),
          ...(actorUserId !== undefined ? { actorUserId } : {}),
        });
        absenteeismApplied = result as unknown as Prisma.InputJsonValue;
      } catch (error) {
        console.error(
          `ScoringRulesService.update: falha ao recalcular absenteísmo (ciclo ${writable.id}):`,
          error,
        );
      }
    }

    await new P5AuditService().log({
      userId: actorUserId ?? null,
      action: 'SCORING_RULES_UPDATE',
      entityType: 'ProgramYear',
      entityId: programYearId,
      ...(writable ? { cycleId: writable.id } : {}),
      before: before as unknown as Prisma.InputJsonValue,
      after: configJson,
      metadata: {
        source: writable ? 'cycle+program' : 'program',
        safetyRecalculated,
        absenteeismApplied,
      },
    });

    return this.getProgramYearRules(programYearId);
  }

  async getCycleRules(
    cycleId: string,
    allowedPillarCodes: $Enums.PillarCode[] | null,
  ): Promise<CycleScoringRulesPayload> {
    const cycleRepo = new MonthlyCyclePrismaRepository(prisma);
    const cycle = await cycleRepo.findById(cycleId);
    if (!cycle) {
      throw new HttpError('Ciclo mensal não encontrado', 404);
    }

    const config = parseScoringConfig(cycle.scoringConfig);
    const scoped = scopeScoringConfigForViewer(
      config,
      allowedPillarCodes as PillarCodeString[] | null,
    );

    return {
      cycleId: cycle.id,
      month: cycle.month,
      year: cycle.year,
      status: cycle.status,
      config: scoped,
      readOnly: true,
    };
  }
}
