import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';
import { $Enums } from '../src/generated/prisma/client.js';
import { prisma } from '../src/lib/prisma.js';
import { CycleParticipantPrismaRepository } from '../src/repositories/prisma/monthly-cycle-repository.js';
import { SafetyAccidentPrismaRepository } from '../src/repositories/prisma/safety-repository.js';
import { SafetyCalculationService } from '../src/services/safety-calculation-service.js';

const PROGRAM_YEAR = 2026;
const THROUGH_MONTH = 8;
const CIPA_URL =
  process.env.CIPA_DATABASE_URL ??
  'postgresql://cipa:cipa@127.0.0.1:5008/cipa_local?schema=public';
const APPLY = process.argv.includes('--apply');
const TIME_ZONE = 'America/Sao_Paulo';

type CipaRow = {
  id: number;
  relatedOccurrence: string;
  remoteness: boolean;
  totalDaysAway: number;
  dateOfAccident: Date;
  accidentYear: number | null;
  accidentMonth: number | null;
  descriptionOfAccident: string | null;
  accidentCompany: string | null;
  card: string | null;
  emp_unit: string | null;
  emp_name: string | null;
  situation: string | null;
  detailedDescription: string | null;
  costCenter: string | null;
  sector_name: string | null;
  responsibleCostCenter: string | null;
};

type Skip = { id: number; reason: string };
type Match = {
  id: number;
  externalId: string;
  cycleYear: number;
  cycleMonth: number;
  cycleId: string;
  employeeId: string;
  employeeName: string;
  sectorId: string;
  sectorName: string;
  accidentType: $Enums.AccidentType;
  occurredAt: Date;
  daysAway: number;
  description: string | null;
  unit: $Enums.Unit;
  cardNumber: string;
  costCenter: string;
  createEmployee: boolean;
  employeeDisplayName: string;
};

function parseUnit(value: string | null | undefined): $Enums.Unit | null {
  const normalized = (value ?? '').trim().toUpperCase();
  if (normalized === 'PEDERTRACTOR' || normalized === 'TRACTOR') {
    return normalized;
  }
  return null;
}

function usableCostCenter(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim() ?? '';
    if (trimmed && trimmed.toUpperCase() !== 'XXXX') {
      return trimmed;
    }
  }
  return '';
}

function calendarMonthInSaoPaulo(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return { year, month };
}

async function loadCipaAccidents(): Promise<CipaRow[]> {
  const client = new pg.Client({
    connectionString: CIPA_URL,
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  try {
    const result = await client.query<CipaRow>(
      `SELECT a.id, a."relatedOccurrence", a.remoteness, a."totalDaysAway",
              a."dateOfAccident", a."accidentYear", a."accidentMonth",
              a."descriptionOfAccident", a."accidentCompany",
              e.card, e.unit AS emp_unit, e.name AS emp_name,
              t.situation, t."detailedDescription",
              s."costCenter", s.name AS sector_name,
              sr."costCenter" AS "responsibleCostCenter"
       FROM "Accident" a
       LEFT JOIN "Employee" e ON e.id = a."collaboratorId"
       LEFT JOIN "AccidentTst" t ON t."accidentId" = a.id AND t."deletedAt" IS NULL
       LEFT JOIN "Sector" s ON s.id = t."sectorAccidentId"
       LEFT JOIN "Sector" sr ON sr.id = a."sectorResponsibleId"
       WHERE a."deletedAt" IS NULL
         AND COALESCE(a."accidentYear", EXTRACT(YEAR FROM a."dateOfAccident" AT TIME ZONE 'America/Sao_Paulo')::int) = $1
       ORDER BY a."dateOfAccident"`,
      [PROGRAM_YEAR],
    );
    return result.rows;
  } finally {
    await client.end();
  }
}

async function resolveEmployee(unit: $Enums.Unit, cardNumber: string) {
  const active = await prisma.employee.findFirst({
    where: { unit, employeeId: cardNumber, active: true },
  });
  if (active) return { employee: active, note: null as string | null };

  const sameUnit = await prisma.employee.findFirst({
    where: { unit, employeeId: cardNumber },
  });
  if (sameUnit) {
    return { employee: sameUnit, note: 'colaborador inativo no P5' };
  }

  const byCard = await prisma.employee.findFirst({
    where: { employeeId: cardNumber, active: true },
  });
  if (byCard) {
    return {
      employee: byCard,
      note: `unidade CIPA ${unit} ≠ P5 ${byCard.unit}; casou só pelo cartão`,
    };
  }

  const anyCard = await prisma.employee.findFirst({
    where: { employeeId: cardNumber },
  });
  if (anyCard) {
    return { employee: anyCard, note: 'colaborador inativo casado só pelo cartão' };
  }

  return { employee: null, note: null };
}

async function resolveSector(costCenter: string) {
  const active = await prisma.sector.findFirst({
    where: { code: costCenter, active: true },
  });
  if (active) return active;
  return prisma.sector.findFirst({ where: { code: costCenter } });
}

async function matchRows(rows: CipaRow[]) {
  const cycles = await prisma.monthlyCycle.findMany({
    where: { year: PROGRAM_YEAR },
    orderBy: { month: 'asc' },
  });
  const cycleByMonth = new Map(cycles.map((cycle) => [cycle.month, cycle]));

  const skipped: Skip[] = [];
  const matched: Match[] = [];

  for (const row of rows) {
    if (row.relatedOccurrence === 'CONTRATADO') {
      skipped.push({ id: row.id, reason: 'terceiro (CONTRATADO)' });
      continue;
    }
    if (!row.situation) {
      skipped.push({ id: row.id, reason: 'sem investigação TST' });
      continue;
    }
    if (row.situation !== 'ATO') {
      skipped.push({ id: row.id, reason: `situação ${row.situation}` });
      continue;
    }

    const unit = parseUnit(row.emp_unit) ?? parseUnit(row.accidentCompany);
    const cardNumber = row.card?.trim() ?? '';
    const costCenter = usableCostCenter(
      row.costCenter,
      row.responsibleCostCenter,
    );
    if (!unit || !cardNumber || !costCenter) {
      skipped.push({
        id: row.id,
        reason: `dados insuficientes unit=${unit ?? '—'} card=${cardNumber || '—'} cc=${costCenter || '—'}`,
      });
      continue;
    }

    const fromFields =
      row.accidentYear && row.accidentMonth
        ? { year: row.accidentYear, month: row.accidentMonth }
        : calendarMonthInSaoPaulo(row.dateOfAccident);

    if (fromFields.year !== PROGRAM_YEAR) {
      skipped.push({
        id: row.id,
        reason: `ano ${fromFields.year} fora de ${PROGRAM_YEAR}`,
      });
      continue;
    }
    if (fromFields.month < 1 || fromFields.month > THROUGH_MONTH) {
      skipped.push({
        id: row.id,
        reason: `mês ${fromFields.month} fora de jan–ago`,
      });
      continue;
    }

    const cycle = cycleByMonth.get(fromFields.month);
    if (!cycle) {
      skipped.push({
        id: row.id,
        reason: `ciclo ${fromFields.month}/${PROGRAM_YEAR} inexistente`,
      });
      continue;
    }

    const sector = await resolveSector(costCenter);
    if (!sector) {
      skipped.push({
        id: row.id,
        reason: `setor não encontrado centro de custo ${costCenter}`,
      });
      continue;
    }

    const { employee } = await resolveEmployee(unit, cardNumber);
    const employeeDisplayName =
      employee?.name ?? row.emp_name?.trim() ?? `Cartão ${cardNumber}`;
    if (!employee && !row.emp_name?.trim()) {
      skipped.push({
        id: row.id,
        reason: `colaborador não encontrado cartão ${cardNumber} / ${unit}`,
      });
      continue;
    }

    const accidentType =
      row.remoteness || row.totalDaysAway > 0
        ? $Enums.AccidentType.WITH_LEAVE
        : $Enums.AccidentType.WITHOUT_LEAVE;

    matched.push({
      id: row.id,
      externalId: `cipa-ocorrencia-${row.id}`,
      cycleYear: PROGRAM_YEAR,
      cycleMonth: fromFields.month,
      cycleId: cycle.id,
      employeeId: employee?.id ?? '',
      employeeName: employeeDisplayName,
      sectorId: sector.id,
      sectorName: sector.name,
      accidentType,
      occurredAt: row.dateOfAccident,
      daysAway: row.totalDaysAway,
      description:
        row.detailedDescription?.trim() ||
        row.descriptionOfAccident?.trim() ||
        null,
      unit,
      cardNumber,
      costCenter,
      createEmployee: !employee,
      employeeDisplayName,
    });
  }

  return { cycles, skipped, matched };
}

async function copyParticipants(sourceCycleId: string, targetCycleId: string) {
  const existing = await prisma.cycleParticipant.count({
    where: { cycleId: targetCycleId },
  });
  if (existing > 0) return existing;

  const source = await prisma.cycleParticipant.findMany({
    where: { cycleId: sourceCycleId },
  });
  if (source.length === 0) return 0;

  await prisma.cycleParticipant.createMany({
    data: source.map((row) => ({
      id: randomUUID(),
      cycleId: targetCycleId,
      employeeId: row.employeeId,
      sectorId: row.sectorId,
      employeeNameSnapshot: row.employeeNameSnapshot,
      sectorNameSnapshot: row.sectorNameSnapshot,
      unitSnapshot: row.unitSnapshot,
      activeInCycle: row.activeInCycle,
    })),
    skipDuplicates: true,
  });

  return source.length;
}

async function apply(matched: Match[], cycles: Awaited<ReturnType<typeof prisma.monthlyCycle.findMany>>) {
  const jan = cycles.find((cycle) => cycle.month === 1);
  const aug = cycles.find((cycle) => cycle.month === 8);
  if (!jan || !aug) {
    throw new Error('Ciclos de janeiro ou agosto/2026 não encontrados');
  }

  const testDeleted = await prisma.safetyAccident.deleteMany({
    where: {
      cycle: { year: PROGRAM_YEAR },
      OR: [
        { externalId: { startsWith: 'sim-' } },
        { accidentType: $Enums.AccidentType.FREQUENCY },
        { sourceSystem: $Enums.SourceSystem.CIPA },
      ],
    },
  });

  if (jan.status === $Enums.CycleStatus.LOCKED) {
    await prisma.monthlyCycle.update({
      where: { id: jan.id },
      data: {
        status: $Enums.CycleStatus.UNDER_REVIEW,
        lockedAt: null,
        homologatedAt: null,
      },
    });
  }

  const monthsWithAccidents = new Set(matched.map((row) => row.cycleMonth));
  for (const month of monthsWithAccidents) {
    if (month === 1 || month === 8) continue;
    const cycle = cycles.find((item) => item.month === month);
    if (!cycle) continue;
    await copyParticipants(aug.id, cycle.id);
  }

  const accidentRepo = new SafetyAccidentPrismaRepository(prisma);
  const participantRepo = new CycleParticipantPrismaRepository(prisma);
  const now = new Date();

  for (const row of matched) {
    let employee = row.employeeId
      ? await prisma.employee.findUnique({ where: { id: row.employeeId } })
      : null;

    if (!employee) {
      employee = await prisma.employee.upsert({
        where: { externalId: `cipa-card-${row.unit}-${row.cardNumber}` },
        create: {
          externalId: `cipa-card-${row.unit}-${row.cardNumber}`,
          employeeId: row.cardNumber,
          name: row.employeeDisplayName,
          unit: row.unit,
          active: false,
          currentSectorId: row.sectorId,
        },
        update: {
          name: row.employeeDisplayName,
          currentSectorId: row.sectorId,
        },
      });
    }
    const sector = await prisma.sector.findUniqueOrThrow({
      where: { id: row.sectorId },
    });

    await participantRepo.upsert({
      cycleId: row.cycleId,
      employeeId: employee.id,
      sectorId: sector.id,
      employeeNameSnapshot: employee.name,
      sectorNameSnapshot: sector.name,
      unitSnapshot: employee.unit,
      activeInCycle: true,
    });

    await accidentRepo.upsertBySourceAndExternalId({
      cycleId: row.cycleId,
      sourceSystem: $Enums.SourceSystem.CIPA,
      externalId: row.externalId,
      employeeId: employee.id,
      sectorId: sector.id,
      accidentType: row.accidentType,
      occurredAt: row.occurredAt,
      daysAway: row.daysAway,
      description: row.description,
      status: $Enums.AccidentStatus.VALIDATED,
      rawPayload: {
        importedBy: 'import-cipa-2026-accidents',
        cipaId: row.id,
        cycleYear: row.cycleYear,
        cycleMonth: row.cycleMonth,
        costCenter: row.costCenter,
        cardNumber: row.cardNumber,
        unit: row.unit,
      },
      lastSyncedAt: now,
      sourceChangedAt: now,
      cancelledAt: null,
      reviewedAt: now,
      reviewedByUserId: null,
      rejectionReason: null,
    });
  }

  const safety = new SafetyCalculationService();
  const recalculated: Array<{ month: number; ok: boolean }> = [];
  const monthsToCalc = new Set<number>([1, 8, ...monthsWithAccidents]);

  for (const month of [...monthsToCalc].sort((a, b) => a - b)) {
    const cycle = cycles.find((item) => item.month === month);
    if (!cycle) continue;
    if (
      cycle.status === $Enums.CycleStatus.LOCKED ||
      cycle.status === $Enums.CycleStatus.HOMOLOGATED
    ) {
      await prisma.monthlyCycle.update({
        where: { id: cycle.id },
        data: {
          status: $Enums.CycleStatus.UNDER_REVIEW,
          lockedAt: null,
          homologatedAt: null,
        },
      });
    }
    console.error(`Recalculando segurança ${month}/${PROGRAM_YEAR}...`);
    const ok = await safety.recalculateIfApplicable(cycle.id, null);
    recalculated.push({ month, ok });
  }

  const submittedAt = jan.submittedAt ?? now;
  for (const cycle of cycles) {
    if (cycle.month < 1 || cycle.month > 7) continue;
    if (cycle.month === 8) continue;
    const shouldClose =
      cycle.month === 1 || monthsWithAccidents.has(cycle.month);
    if (!shouldClose) continue;
    await prisma.monthlyCycle.update({
      where: { id: cycle.id },
      data: {
        status: $Enums.CycleStatus.UNDER_REVIEW,
        submittedAt: cycle.submittedAt ?? submittedAt,
        lockedAt: null,
        homologatedAt: null,
      },
    });
  }

  await prisma.monthlyCycle.update({
    where: { id: aug.id },
    data: {
      status: $Enums.CycleStatus.OPEN,
      submittedAt: null,
      lockedAt: null,
      homologatedAt: null,
    },
  });

  return { testDeleted: testDeleted.count, recalculated };
}

async function main() {
  const rows = await loadCipaAccidents();
  const { cycles, skipped, matched } = await matchRows(rows);

  const byMonth: Record<number, number> = {};
  for (const row of matched) {
    byMonth[row.cycleMonth] = (byMonth[row.cycleMonth] ?? 0) + 1;
  }

  const report = {
    apply: APPLY,
    cipa2026: rows.length,
    matched: matched.length,
    willCreateEmployees: matched.filter((row) => row.createEmployee).length,
    skipped: skipped.length,
    byMonth,
    skippedReasons: skipped.reduce<Record<string, number>>((acc, item) => {
      acc[item.reason] = (acc[item.reason] ?? 0) + 1;
      return acc;
    }, {}),
    cycles: cycles.map((cycle) => ({
      month: cycle.month,
      status: cycle.status,
    })),
    skipped,
    matchedPreview: matched.map((row) => ({
      id: row.id,
      month: row.cycleMonth,
      type: row.accidentType,
      card: row.cardNumber,
        name: row.employeeDisplayName,
        sector: row.sectorName,
        createEmployee: row.createEmployee,
    })),
  };

  if (!APPLY) {
    fs.writeFileSync('_import-dry-run.json', JSON.stringify(report, null, 2));
    console.error(
      `Dry-run: ${matched.length} atos casados, ${skipped.length} ignorados. Arquivo _import-dry-run.json`,
    );
    return;
  }

  console.error('Aplicando importação...');
  const applied = await apply(matched, cycles);
  const after = await prisma.monthlyCycle.findMany({
    where: { year: PROGRAM_YEAR },
    orderBy: { month: 'asc' },
    include: {
      _count: { select: { accidents: true, participants: true } },
    },
  });

  const result = {
    ...report,
    applied,
    after: after.map((cycle) => ({
      month: cycle.month,
      status: cycle.status,
      accidents: cycle._count.accidents,
      participants: cycle._count.participants,
    })),
  };
  fs.writeFileSync('_import-apply-result.json', JSON.stringify(result, null, 2));
  console.error('Concluído. Arquivo _import-apply-result.json');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
