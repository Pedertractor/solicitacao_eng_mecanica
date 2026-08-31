import 'dotenv/config';
import { $Enums, Prisma } from '../src/generated/prisma/client.js';
import { prisma } from '../src/lib/prisma.js';

const PROGRAM_YEAR = 2026;

async function main() {
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
    },
    update: { active: true },
  });

  const pillars = [
    { code: $Enums.PillarCode.SAFETY, name: 'Seguranca', maxPoints: 20 },
    { code: $Enums.PillarCode.PRODUCTIVITY, name: 'Produtividade', maxPoints: 25 },
    { code: $Enums.PillarCode.QUALITY_5S, name: 'Qualidade e 5S', maxPoints: 20 },
    { code: $Enums.PillarCode.ABSENTEEISM, name: 'Absenteismo', maxPoints: 10 },
    { code: $Enums.PillarCode.REVENUE, name: 'Faturamento', maxPoints: 25 },
  ];

  for (const pillar of pillars) {
    await prisma.pillarConfig.upsert({
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
      update: { active: true },
    });
  }

  for (let month = 1; month <= 12; month += 1) {
    await prisma.monthlyCycle.upsert({
      where: {
        programYearId_year_month: {
          programYearId: programYear.id,
          year: PROGRAM_YEAR,
          month,
        },
      },
      create: {
        programYearId: programYear.id,
        year: PROGRAM_YEAR,
        month,
        status: $Enums.CycleStatus.OPEN,
        openedAt: new Date(),
      },
      update: {
        status: $Enums.CycleStatus.OPEN,
        openedAt: new Date(),
      },
    });
  }

  const costCenter = process.env.SEED_COST_CENTER ?? '4501';
  const cardNumber = process.env.SEED_CARD_NUMBER ?? '5487';
  const unit =
    (process.env.SEED_UNIT as $Enums.Unit | undefined) ??
    $Enums.Unit.PEDERTRACTOR;
  const employeeName =
    process.env.SEED_EMPLOYEE_NAME ?? 'Colaborador Teste CIPA';

  const sector = await prisma.sector.upsert({
    where: { externalId: `seed-sector-${costCenter}` },
    create: {
      externalId: `seed-sector-${costCenter}`,
      code: costCenter,
      name: `Setor Teste CIPA ${costCenter}`,
      unit,
      active: true,
    },
    update: { code: costCenter, unit, active: true },
  });

  const employee = await prisma.employee.upsert({
    where: { externalId: `seed-emp-${unit}-${cardNumber}` },
    create: {
      externalId: `seed-emp-${unit}-${cardNumber}`,
      employeeId: cardNumber,
      name: employeeName,
      unit,
      active: true,
      currentSectorId: sector.id,
    },
    update: {
      employeeId: cardNumber,
      name: employeeName,
      unit,
      active: true,
      currentSectorId: sector.id,
    },
  });

  const julyCycle = await prisma.monthlyCycle.findFirst({
    where: { year: PROGRAM_YEAR, month: 7 },
    select: { id: true, status: true },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        sectorCode: sector.code,
        employeeCard: employee.employeeId,
        unit: employee.unit,
        julyCycle,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
