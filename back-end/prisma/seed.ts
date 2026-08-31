import 'dotenv/config';
import { $Enums, Prisma } from '../src/generated/prisma/client.js';
import { HttpError } from '../src/https/errors/index.js';
import { prisma } from '../src/lib/prisma.js';
import { UserService } from '../src/services/user-service.js';
import { ensureAbsenteeismIndividualIndicator } from '../src/services/absenteeism-indicator-config.js';
import { defaultScoringConfigV2 } from '../src/services/scoring-rules.js';

const SEED_CARD_NUMBER = '5487';
const SEED_UNIT = $Enums.Unit.PEDERTRACTOR;
const PROGRAM_YEAR = 2026;

async function seedAdminUser() {
  console.log(
    `Seed: registrando cartão ${SEED_CARD_NUMBER} na unidade ${SEED_UNIT} via API corporativa (mesmo fluxo de cadastro).`,
  );

  const userService = new UserService();

  try {
    const user = await userService.register({
      cardNumber: SEED_CARD_NUMBER,
      unit: SEED_UNIT,
      active: true,
      role: $Enums.UserRole.ADMIN,
    });
    console.log(
      `Seed: usuário criado (${user.name}, cartão ${user.cardNumber}, unidade ${user.unit}, role ${user.role}, senha inicial = cartão).`,
    );
  } catch (e) {
    if (e instanceof HttpError) {
      if (e.statusCode === 400 && e.message === 'Usuário já existe') {
        console.log(
          `Seed: usuário ${SEED_CARD_NUMBER}/${SEED_UNIT} já existe; ignorando.`,
        );
        return;
      }
      console.error(
        `Seed: falha ao registrar ${SEED_CARD_NUMBER} (${e.statusCode}): ${e.message}`,
      );
      throw e;
    }
    throw e;
  }
}

async function seedProgramYear2026() {
  const startsAt = new Date(`${PROGRAM_YEAR}-01-01T00:00:00.000Z`);
  const endsAt = new Date(`${PROGRAM_YEAR}-12-31T23:59:59.999Z`);

  const programYear = await prisma.programYear.upsert({
    where: { year: PROGRAM_YEAR },
    create: {
      year: PROGRAM_YEAR,
      name: `Programa P5 ${PROGRAM_YEAR}`,
      startsAt,
      endsAt,
      active: true,
      scoringConfig: defaultScoringConfigV2() as unknown as Prisma.InputJsonValue,
    },
    update: {
      name: `Programa P5 ${PROGRAM_YEAR}`,
      startsAt,
      endsAt,
      active: true,
      scoringConfig: defaultScoringConfigV2() as unknown as Prisma.InputJsonValue,
    },
  });

  console.log(`Seed: ProgramYear ${PROGRAM_YEAR} (${programYear.id})`);

  const pillars: Array<{
    code: $Enums.PillarCode;
    name: string;
    maxPoints: number;
  }> = [
    { code: $Enums.PillarCode.SAFETY, name: 'Segurança', maxPoints: 20 },
    {
      code: $Enums.PillarCode.PRODUCTIVITY,
      name: 'Produtividade',
      maxPoints: 25,
    },
    {
      code: $Enums.PillarCode.QUALITY_5S,
      name: 'Qualidade e 5S',
      maxPoints: 20,
    },
    { code: $Enums.PillarCode.ABSENTEEISM, name: 'Absenteísmo', maxPoints: 10 },
    { code: $Enums.PillarCode.REVENUE, name: 'Faturamento', maxPoints: 25 },
  ];

  const pillarByCode = new Map<string, string>();

  for (const pillar of pillars) {
    const row = await prisma.pillarConfig.upsert({
      where: {
        programYearId_code: {
          programYearId: programYear.id,
          code: pillar.code,
        },
      },
      create: {
        programYearId: programYear.id,
        code: pillar.code,
        name: pillar.name,
        maxPoints: new Prisma.Decimal(pillar.maxPoints),
        active: true,
      },
      update: {
        name: pillar.name,
        maxPoints: new Prisma.Decimal(pillar.maxPoints),
        active: true,
      },
    });
    pillarByCode.set(pillar.code, row.id);
  }

  const safetyPillarId = pillarByCode.get($Enums.PillarCode.SAFETY);
  if (!safetyPillarId) {
    throw new Error('Seed: pilar SAFETY não encontrado após upsert');
  }

  const safetyIndicators: Array<{
    code: string;
    name: string;
    maxInternalPoints: number;
    calculationType: $Enums.CalculationType;
    scope: $Enums.IndicatorScope;
    ruleConfig?: Prisma.InputJsonValue;
  }> = [
    {
      code: 'SAFETY_WITH_LEAVE',
      name: 'Acidentes com afastamento',
      maxInternalPoints: 50,
      calculationType: $Enums.CalculationType.ZERO_OCCURRENCE,
      scope: $Enums.IndicatorScope.INDIVIDUAL,
      ruleConfig: {
        note: 'V2: cada acidente desconta da fábrica (ex.: 2,06 P5) e a vítima perde multa individual (ex.: 20 P5); abaixo de 70% zera todos',
      },
    },
    {
      code: 'SAFETY_WITHOUT_LEAVE',
      name: 'Acidentes sem afastamento',
      maxInternalPoints: 30,
      calculationType: $Enums.CalculationType.ZERO_OCCURRENCE,
      scope: $Enums.IndicatorScope.INDIVIDUAL,
      ruleConfig: {
        note: 'V2: mesma regra coletiva/individual da config (factoryDeductionP5 + individualPenaltyP5); limiar global 70%',
      },
    },
    {
      code: 'SAFETY_FREQUENCY',
      name: 'Reincidência / frequência',
      maxInternalPoints: 20,
      calculationType: $Enums.CalculationType.ZERO_OCCURRENCE,
      scope: $Enums.IndicatorScope.INDIVIDUAL,
      ruleConfig: {
        note: 'Depreciado na regra v2 (sem FREQUENCY). Legado: 2+ acidentes no ciclo descontavam 20 pts internos',
        source: 'P5_INTERNAL',
        deprecatedInV2: true,
      },
    },
  ];

  for (const indicator of safetyIndicators) {
    await prisma.indicatorConfig.upsert({
      where: {
        pillarId_code: {
          pillarId: safetyPillarId,
          code: indicator.code,
        },
      },
      create: {
        pillarId: safetyPillarId,
        code: indicator.code,
        name: indicator.name,
        scope: indicator.scope,
        calculationType: indicator.calculationType,
        maxInternalPoints: new Prisma.Decimal(indicator.maxInternalPoints),
        target: null,
        targetOperator: null,
        sourceSystem: $Enums.SourceSystem.CIPA,
        ruleConfig: indicator.ruleConfig ?? Prisma.JsonNull,
        active: true,
      },
      update: {
        name: indicator.name,
        scope: indicator.scope,
        calculationType: indicator.calculationType,
        maxInternalPoints: new Prisma.Decimal(indicator.maxInternalPoints),
        sourceSystem: $Enums.SourceSystem.CIPA,
        ruleConfig: indicator.ruleConfig ?? Prisma.JsonNull,
        active: true,
      },
    });
  }

  console.log(
    'Seed: pilares e indicadores de Segurança do Programa P5 2026 garantidos.',
  );

  const absenteeismPillarId = pillarByCode.get($Enums.PillarCode.ABSENTEEISM);
  if (!absenteeismPillarId) {
    throw new Error('Seed: pilar ABSENTEEISM não encontrado após upsert');
  }

  await ensureAbsenteeismIndividualIndicator(absenteeismPillarId);
  console.log('Seed: indicador ABSENTEEISM_INDIVIDUAL garantido.');

  // 12 ciclos mensais (jan–dez): 100 pts base/mês por colaborador → 1200/ano
  let cyclesCreated = 0;
  for (let month = 1; month <= 12; month += 1) {
    const existing = await prisma.monthlyCycle.findUnique({
      where: {
        programYearId_year_month: {
          programYearId: programYear.id,
          year: PROGRAM_YEAR,
          month,
        },
      },
    });
    if (existing) continue;

    await prisma.monthlyCycle.create({
      data: {
        programYearId: programYear.id,
        year: PROGRAM_YEAR,
        month,
        status: $Enums.CycleStatus.DRAFT,
      },
    });
    cyclesCreated += 1;
  }

  const cyclesTotal = await prisma.monthlyCycle.count({
    where: { programYearId: programYear.id },
  });
  console.log(
    `Seed: ciclos mensais ${PROGRAM_YEAR} — criados ${cyclesCreated}, total ${cyclesTotal}/12 (100 pts/mês, 1200 pts/ano por colaborador).`,
  );
}

async function main() {
  await seedAdminUser();
  await seedProgramYear2026();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
