import { $Enums, Prisma } from '../generated/prisma/client.js';
import {
  ABSENTEEISM_INDICATOR_CODE,
  ABSENTEEISM_INDIVIDUAL_POINTS,
  ABSENTEEISM_INDEX_THRESHOLD,
} from '../constants/absenteeism-scoring.js';
import { prisma } from '../lib/prisma.js';

const ABSENTEEISM_INDICATOR_NAME = 'Absenteísmo individual';

function absenteeismIndicatorPayload(pillarId: string) {
  return {
    pillarId,
    code: ABSENTEEISM_INDICATOR_CODE,
    name: ABSENTEEISM_INDICATOR_NAME,
    scope: $Enums.IndicatorScope.INDIVIDUAL,
    calculationType: $Enums.CalculationType.THRESHOLD,
    maxInternalPoints: new Prisma.Decimal(ABSENTEEISM_INDIVIDUAL_POINTS),
    target: new Prisma.Decimal(ABSENTEEISM_INDEX_THRESHOLD),
    targetOperator: '>=',
    sourceSystem: $Enums.SourceSystem.PEDERTRACTOR,
    ruleConfig: {
      threshold: ABSENTEEISM_INDEX_THRESHOLD,
      note: `Índice < ${ABSENTEEISM_INDEX_THRESHOLD}: perda coletiva de fábrica + perda individual (configuráveis no painel de pontuação)`,
    },
    active: true,
  };
}

/** Garante o indicador operacional do pilar Absenteísmo (idempotente). */
export async function ensureAbsenteeismIndividualIndicator(pillarId: string) {
  const payload = absenteeismIndicatorPayload(pillarId);
  return prisma.indicatorConfig.upsert({
    where: {
      pillarId_code: {
        pillarId,
        code: ABSENTEEISM_INDICATOR_CODE,
      },
    },
    create: payload,
    update: {
      name: payload.name,
      scope: payload.scope,
      calculationType: payload.calculationType,
      maxInternalPoints: payload.maxInternalPoints,
      target: payload.target,
      targetOperator: payload.targetOperator,
      sourceSystem: payload.sourceSystem,
      ruleConfig: payload.ruleConfig,
      active: true,
    },
  });
}

export async function ensureAbsenteeismIndividualIndicatorForProgram(
  programYearId: string,
) {
  const pillar = await prisma.pillarConfig.findUnique({
    where: {
      programYearId_code: {
        programYearId,
        code: $Enums.PillarCode.ABSENTEEISM,
      },
    },
  });
  if (!pillar) return null;
  return ensureAbsenteeismIndividualIndicator(pillar.id);
}

export async function ensureAbsenteeismIndividualIndicatorForAllPrograms() {
  const pillars = await prisma.pillarConfig.findMany({
    where: { code: $Enums.PillarCode.ABSENTEEISM },
    select: { id: true, programYearId: true },
  });
  const indicators = [];
  for (const pillar of pillars) {
    indicators.push(await ensureAbsenteeismIndividualIndicator(pillar.id));
  }
  return { pillars: pillars.length, indicators: indicators.length };
}
