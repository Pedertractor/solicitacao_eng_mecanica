import { $Enums, Prisma } from '../generated/prisma/client.js';
import { centsToFixed2, sumCents, toCents } from '../lib/fixed-point.js';
import { EmployeeMonthlyScorePrismaRepository } from '../repositories/prisma/safety-repository.js';

function decimalAsPrisma(cents: number) {
  return new Prisma.Decimal(centsToFixed2(cents));
}

/**
 * Recalcula EmployeeMonthlyScore a partir de todos os EmployeePillarScore
 * gravados para o participante (soma real dos pilares calculados).
 */
export async function rebuildParticipantMonthlyScore(input: {
  tx: Prisma.TransactionClient;
  participantId: string;
  programYearId: string;
  calculatedAt: Date;
}) {
  const { tx, participantId, programYearId, calculatedAt } = input;

  const activePillars = await tx.pillarConfig.findMany({
    where: { programYearId, active: true },
    select: { code: true },
    orderBy: { code: 'asc' },
  });

  const pillarScores = await tx.employeePillarScore.findMany({
    where: { participantId },
    include: { pillar: { select: { code: true } } },
  });

  const calculatedPillars = pillarScores.map(
    (score) => score.pillar.code,
  ) as $Enums.PillarCode[];

  const calculatedSet = new Set(calculatedPillars);
  const pendingPillars = activePillars
    .map((pillar) => pillar.code)
    .filter((code) => !calculatedSet.has(code));

  const totalPointsCents = sumCents(
    pillarScores.map((score) => toCents(score.weightedPoints)),
  );

  const monthlyScoreRepo = new EmployeeMonthlyScorePrismaRepository(tx);
  await monthlyScoreRepo.upsert({
    participantId,
    totalPoints: decimalAsPrisma(totalPointsCents),
    status: $Enums.ResultStatus.PROVISIONAL,
    isPartial: pendingPillars.length > 0,
    calculatedPillars,
    pendingPillars,
    calculatedAt,
  });
}
