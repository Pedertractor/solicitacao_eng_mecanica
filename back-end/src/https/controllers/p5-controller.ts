import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { $Enums } from '../../generated/prisma/client.js';
import { assertCanAccessPillar, getScopedPillarCodes } from '../../middlewares/pillar-access-middleware.js';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../errors/index.js';
import { AccidentSimulationService } from '../../services/accident-simulation-service.js';
import { AbsenteeismSimulationService } from '../../services/absenteeism-simulation-service.js';
import { EmployeeSyncService } from '../../services/employee-sync-service.js';
import { CipaInboundService } from '../../services/cipa-inbound-service.js';
import { MonthlyCycleService } from '../../services/monthly-cycle-service.js';
import { ProgramYearService, AVAILABLE_PILLAR_CODES } from '../../services/program-year-service.js';
import { SafetyCalculationService } from '../../services/safety-calculation-service.js';
import { AbsenteeismCalculationService } from '../../services/absenteeism-calculation-service.js';
import { SafetySyncService } from '../../services/safety-sync-service.js';
import { AbsenteeismService } from '../../services/absenteeism-service.js';
import { ScoringRulesService } from '../../services/scoring-rules-service.js';

const absenteeismService = new AbsenteeismService();

function actorId(request: FastifyRequest) {
  return request.user.sub;
}

const actorSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  identifier: z.string().min(1),
});

const previousNatureSchema = z.enum(['ACT', 'CONDITION']).nullable();

const cycleFieldsSchema = z
  .object({
    cycleYear: z.number().int().min(2000).max(2100).optional(),
    cycleMonth: z.number().int().min(1).max(12).optional(),
  })
  .superRefine((value, ctx) => {
    const hasYear = value.cycleYear != null;
    const hasMonth = value.cycleMonth != null;
    if (hasYear !== hasMonth) {
      ctx.addIssue({
        code: 'custom',
        message: 'cycleYear e cycleMonth devem ser informados juntos',
      });
    }
  });

const cipaPutActSchema = z
  .object({
    nature: z.literal('ACT'),
    previousNature: previousNatureSchema,
    costCenter: z.string().min(1),
    unit: z.enum(['PEDERTRACTOR', 'TRACTOR']),
    cardNumber: z.string().min(1),
    accidentType: z.enum(['WITH_LEAVE', 'WITHOUT_LEAVE']),
    occurredAt: z.string().min(1),
    daysAway: z.number().int().min(0).nullable().optional(),
    description: z.string().nullable().optional(),
    sourceChangedAt: z.string().min(1),
    actor: actorSchema,
  })
  .merge(cycleFieldsSchema);

const cipaPutConditionSchema = z
  .object({
    nature: z.literal('CONDITION'),
    previousNature: previousNatureSchema,
    occurredAt: z.string().min(1),
    sourceChangedAt: z.string().min(1),
    reason: z.string().nullable().optional(),
    actor: actorSchema,
  })
  .merge(cycleFieldsSchema);

const cipaPutSchema = z.discriminatedUnion('nature', [
  cipaPutActSchema,
  cipaPutConditionSchema,
]);

const cipaDeleteSchema = z.object({
  sourceChangedAt: z.string().min(1),
  reason: z.string().nullable().optional(),
  actor: actorSchema,
});

export async function ingestCipaAccident(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = z
    .object({
      externalId: z.string().min(1),
      costCenter: z.string().min(1),
      unit: z.enum(['PEDERTRACTOR', 'TRACTOR']),
      cardNumber: z.string().min(1),
      accidentType: z.enum(['WITH_LEAVE', 'WITHOUT_LEAVE']),
      occurredAt: z.string().min(1),
      daysAway: z.number().int().nullable().optional(),
      description: z.string().nullable().optional(),
      cycleYear: z.number().int().min(2000).max(2100).optional(),
      cycleMonth: z.number().int().min(1).max(12).optional(),
    })
    .parse(request.body);

  const result = await new CipaInboundService().ingestAccident({
    externalId: body.externalId,
    costCenter: body.costCenter,
    unit: body.unit,
    cardNumber: body.cardNumber,
    accidentType: body.accidentType,
    occurredAt: body.occurredAt,
    ...(body.daysAway !== undefined ? { daysAway: body.daysAway } : {}),
    ...(body.description !== undefined
      ? { description: body.description }
      : {}),
    ...(body.cycleYear !== undefined ? { cycleYear: body.cycleYear } : {}),
    ...(body.cycleMonth !== undefined ? { cycleMonth: body.cycleMonth } : {}),
  });

  return reply.status(result.created ? 201 : 200).send(result);
}

export async function putCipaAccident(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { externalId } = z
    .object({ externalId: z.string().min(1) })
    .parse(request.params);
  const body = cipaPutSchema.parse(request.body);
  const payload =
    body.nature === 'ACT'
      ? {
          nature: 'ACT' as const,
          previousNature: body.previousNature,
          costCenter: body.costCenter,
          unit: body.unit,
          cardNumber: body.cardNumber,
          accidentType: body.accidentType,
          occurredAt: body.occurredAt,
          daysAway: body.daysAway ?? null,
          description: body.description ?? null,
          sourceChangedAt: body.sourceChangedAt,
          actor: body.actor,
          ...(body.cycleYear !== undefined ? { cycleYear: body.cycleYear } : {}),
          ...(body.cycleMonth !== undefined
            ? { cycleMonth: body.cycleMonth }
            : {}),
        }
      : {
          nature: 'CONDITION' as const,
          previousNature: body.previousNature,
          occurredAt: body.occurredAt,
          sourceChangedAt: body.sourceChangedAt,
          reason: body.reason ?? null,
          actor: body.actor,
          ...(body.cycleYear !== undefined ? { cycleYear: body.cycleYear } : {}),
          ...(body.cycleMonth !== undefined
            ? { cycleMonth: body.cycleMonth }
            : {}),
        };

  const result = await new CipaInboundService().putAccident(
    externalId,
    payload,
  );
  return reply.status(result.created ? 201 : 200).send(result);
}

export async function deleteCipaAccident(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { externalId } = z
    .object({ externalId: z.string().min(1) })
    .parse(request.params);
  const body = cipaDeleteSchema.parse(request.body ?? {});

  const result = await new CipaInboundService().cancelAccident(externalId, {
    sourceChangedAt: body.sourceChangedAt,
    reason: body.reason ?? null,
    actor: body.actor,
  });
  return reply.status(200).send(result);
}

export async function simulateAccident(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = z
    .object({
      accidentType: z.enum(['WITH_LEAVE', 'WITHOUT_LEAVE'], {
        error: 'Informe se o acidente é com ou sem afastamento',
      }),
      daysAway: z.number().int().min(0).nullable().optional(),
      costCenter: z.string().min(1).optional(),
      cardNumber: z.string().min(1, 'Informe o número do cartão'),
      unit: z.enum(['PEDERTRACTOR', 'TRACTOR'], {
        error: 'Informe a unidade do colaborador',
      }),
    })
    .parse(request.body ?? {});

  const result = await new AccidentSimulationService().simulate({
    accidentType: body.accidentType,
    cardNumber: body.cardNumber,
    unit: body.unit,
    ...(body.daysAway !== undefined ? { daysAway: body.daysAway } : {}),
    ...(body.costCenter !== undefined ? { costCenter: body.costCenter } : {}),
  });

  return reply.status(result.created ? 201 : 200).send(result);
}

export async function listSimulationAccidents(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const result = await new AccidentSimulationService().listWorkingCycleAccidents();
  return reply.status(200).send(result);
}

export async function cancelSimulatedAccident(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = z
    .object({
      accidentId: z.string().uuid('Identificador da ocorrência inválido'),
    })
    .parse(request.body ?? {});

  const result = await new AccidentSimulationService().cancel({
    accidentId: body.accidentId,
    actorUserId: actorId(request),
  });

  return reply.status(200).send(result);
}

export async function simulateAbsenteeism(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = z
    .object({
      absenteeism: z
        .number()
        .min(0, 'O índice de absenteísmo deve ser 0 ou maior'),
      costCenter: z.string().min(1).optional(),
      cardNumber: z.string().min(1).optional(),
      unit: z.enum(['PEDERTRACTOR', 'TRACTOR']).optional(),
    })
    .parse(request.body ?? {});

  const result = await new AbsenteeismSimulationService().simulate({
    absenteeism: body.absenteeism,
    ...(body.costCenter !== undefined ? { costCenter: body.costCenter } : {}),
    ...(body.cardNumber !== undefined ? { cardNumber: body.cardNumber } : {}),
    ...(body.unit !== undefined ? { unit: body.unit } : {}),
    actorUserId: actorId(request),
  });

  return reply.status(200).send(result);
}

export async function forceCalculateAbsenteeism(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = z
    .object({
      month: z
        .number()
        .int()
        .min(1, 'Mês deve estar entre 1 e 12')
        .max(12, 'Mês deve estar entre 1 e 12'),
      year: z
        .number()
        .int()
        .min(2000, 'Ano inválido')
        .max(2100, 'Ano inválido'),
    })
    .parse(request.body ?? {});

  const result = await new AbsenteeismCalculationService().forceApplyByMonth({
    month: body.month,
    year: body.year,
    actorUserId: actorId(request),
  });

  return reply.status(200).send({ result });
}

export async function syncEmployees(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const summary = await new EmployeeSyncService().syncFromPedertractor(
    actorId(request),
  );
  return reply.status(200).send({ summary });
}

export async function listActiveEmployees(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const rows = await new EmployeeSyncService().listActiveEmployees();
  const employees = rows.flatMap((e) => {
    const sector = e.currentSector;
    const costCenter = sector?.code?.trim();
    if (!sector || !costCenter) return [];
    return [
      {
        id: e.id,
        name: e.name,
        cardNumber: e.employeeId,
        unit: e.unit,
        costCenter,
        sectorName: sector.name,
      },
    ];
  });
  return reply.status(200).send({ employees });
}

export async function purgeEmployeesAndSectors(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const summary = await new EmployeeSyncService().purgeEmployeesAndSectors(
    actorId(request),
  );
  return reply.status(200).send({ summary });
}

export async function listProgramYears(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const programYears = await new ProgramYearService().list(
    getScopedPillarCodes(request.user),
  );
  return reply.status(200).send({ programYears });
}

export async function createProgramYear(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = z
    .object({
      year: z.number().int().min(2000).max(2100),
      name: z.string().min(1),
      startsAt: z.string().min(1),
      endsAt: z.string().min(1),
      active: z.boolean().optional(),
    })
    .parse(request.body);

  const programYear = await new ProgramYearService().create({
    year: body.year,
    name: body.name,
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    ...(body.active !== undefined ? { active: body.active } : {}),
    actorUserId: actorId(request),
  });
  return reply.status(201).send({ programYear });
}

export async function getProgramYear(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
  const programYear = await new ProgramYearService().getById(
    id,
    getScopedPillarCodes(request.user),
  );
  return reply.status(200).send({ programYear });
}

export async function getProgramYearOverview(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { programYearId } = z
    .object({ programYearId: z.string().uuid() })
    .parse(request.params);
  const overview = await new ProgramYearService().getOverview(
    programYearId,
    getScopedPillarCodes(request.user),
  );
  return reply.status(200).send({ overview });
}

export async function listPillars(request: FastifyRequest, reply: FastifyReply) {
  const { programYearId } = z
    .object({ programYearId: z.string().uuid() })
    .parse(request.params);
  const pillars = await new ProgramYearService().listPillars(
    programYearId,
    getScopedPillarCodes(request.user),
  );
  return reply.status(200).send({ pillars });
}

export async function listIndicators(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { pillarId } = z
    .object({ pillarId: z.string().uuid() })
    .parse(request.params);
  const pillar = await prisma.pillarConfig.findUnique({
    where: { id: pillarId },
    select: { code: true },
  });
  if (!pillar) {
    throw new HttpError('Pilar não encontrado', 404);
  }
  assertCanAccessPillar(request.user, pillar.code, 'read');
  const indicators = await new ProgramYearService().listIndicators(pillarId);
  return reply.status(200).send({ indicators });
}

export async function updateIndicator(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { indicatorId } = z
    .object({ indicatorId: z.string().uuid() })
    .parse(request.params);
  const indicatorRecord = await prisma.indicatorConfig.findUnique({
    where: { id: indicatorId },
    select: { pillar: { select: { code: true } } },
  });
  if (!indicatorRecord) {
    throw new HttpError('Indicador não encontrado', 404);
  }
  assertCanAccessPillar(request.user, indicatorRecord.pillar.code, 'write');
  if (
    request.user.role === $Enums.UserRole.RESPONSIBLE &&
    !AVAILABLE_PILLAR_CODES.has(indicatorRecord.pillar.code)
  ) {
    throw new HttpError('Sem permissão para editar este pilar', 403);
  }
  const body = z
    .object({
      name: z.string().min(1).optional(),
      target: z.number().nullable().optional(),
      targetOperator: z.string().nullable().optional(),
      ruleConfig: z.unknown().nullable().optional(),
      active: z.boolean().optional(),
      maxInternalPoints: z.number().positive().optional(),
    })
    .parse(request.body);

  const indicator = await new ProgramYearService().updateIndicator(
    indicatorId,
    {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.target !== undefined ? { target: body.target } : {}),
      ...(body.targetOperator !== undefined
        ? { targetOperator: body.targetOperator }
        : {}),
      ...(body.ruleConfig !== undefined
        ? { ruleConfig: body.ruleConfig as object | null }
        : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
      ...(body.maxInternalPoints !== undefined
        ? { maxInternalPoints: body.maxInternalPoints }
        : {}),
      actorUserId: actorId(request),
    },
  );
  return reply.status(200).send({ indicator });
}

export async function listCycles(request: FastifyRequest, reply: FastifyReply) {
  const query = z
    .object({
      programYearId: z.string().uuid().optional(),
      year: z.coerce.number().int().optional(),
    })
    .parse(request.query);
  const cycles = await new MonthlyCycleService().list(
    {
      ...(query.programYearId !== undefined
        ? { programYearId: query.programYearId }
        : {}),
      ...(query.year !== undefined ? { year: query.year } : {}),
    },
    getScopedPillarCodes(request.user),
  );
  return reply.status(200).send({ cycles });
}

export async function createCycle(request: FastifyRequest, reply: FastifyReply) {
  const body = z
    .object({
      programYearId: z.string().uuid(),
      month: z.number().int().min(1).max(12).optional(),
      year: z.number().int().min(2000).max(2100).optional(),
    })
    .parse(request.body);

  // Preferência: gera o ano completo (12 ciclos). month/year legados são ignorados
  // salvo quando month é informado (retorna aquele ciclo após ensure).
  if (body.month != null) {
    const cycle = await new MonthlyCycleService().create({
      programYearId: body.programYearId,
      month: body.month,
      year: body.year ?? new Date().getFullYear(),
      actorUserId: actorId(request),
    });
    return reply.status(201).send({ cycle });
  }

  const result = await new MonthlyCycleService().ensureYearCycles(
    body.programYearId,
    actorId(request),
  );
  return reply.status(201).send(result);
}

export async function ensureYearCycles(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { programYearId } = z
    .object({ programYearId: z.string().uuid() })
    .parse(request.params);

  const result = await new MonthlyCycleService().ensureYearCycles(
    programYearId,
    actorId(request),
  );
  return reply.status(200).send(result);
}

export async function getCycle(request: FastifyRequest, reply: FastifyReply) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const cycle = await new MonthlyCycleService().getById(
    cycleId,
    getScopedPillarCodes(request.user),
  );
  return reply.status(200).send({ cycle });
}

export async function openCycle(request: FastifyRequest, reply: FastifyReply) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const result = await new MonthlyCycleService().open(
    cycleId,
    actorId(request),
  );
  return reply.status(200).send(result);
}

export async function calculateCycle(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const result = await new MonthlyCycleService().calculate(
    cycleId,
    actorId(request),
  );
  return reply.status(200).send(result);
}

export async function submitCycleReview(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const cycle = await new MonthlyCycleService().submitReview(
    cycleId,
    actorId(request),
  );
  return reply.status(200).send({ cycle });
}

export async function homologateCycle(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const cycle = await new MonthlyCycleService().homologate(
    cycleId,
    actorId(request),
  );
  return reply.status(200).send({ cycle });
}

export async function lockCycle(request: FastifyRequest, reply: FastifyReply) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const cycle = await new MonthlyCycleService().lock(cycleId, actorId(request));
  return reply.status(200).send({ cycle });
}

export async function listCycleSectors(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const query = z
    .object({
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(10).optional(),
      name: z.string().optional(),
      costCenter: z.string().optional(),
    })
    .parse(request.query);

  const result = await new MonthlyCycleService().listSectorsWithAverages(
    cycleId,
    {
      ...(query.page != null ? { page: query.page } : {}),
      ...(query.pageSize != null ? { pageSize: query.pageSize } : {}),
      ...(query.name?.trim() ? { name: query.name.trim() } : {}),
      ...(query.costCenter?.trim()
        ? { costCenter: query.costCenter.trim() }
        : {}),
    },
    getScopedPillarCodes(request.user),
  );
  return reply.status(200).send(result);
}

export async function getCycleSectorEmployees(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId, sectorId } = z
    .object({
      cycleId: z.string().uuid(),
      sectorId: z.string().uuid(),
    })
    .parse(request.params);
  const result = await new MonthlyCycleService().getSectorEmployees(
    cycleId,
    sectorId,
    getScopedPillarCodes(request.user),
  );
  return reply.status(200).send(result);
}

export async function listParticipants(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const query = z
    .object({
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(10).optional(),
      cardNumber: z.string().optional(),
      unit: z.string().optional(),
    })
    .parse(request.query);

  const result = await new MonthlyCycleService().listParticipants(
    cycleId,
    {
      ...(query.page != null ? { page: query.page } : {}),
      ...(query.pageSize != null ? { pageSize: query.pageSize } : {}),
      ...(query.cardNumber != null ? { cardNumber: query.cardNumber } : {}),
      ...(query.unit != null && query.unit !== 'ALL'
        ? { unit: query.unit }
        : {}),
    },
    getScopedPillarCodes(request.user),
  );
  return reply.status(200).send(result);
}

export async function syncParticipants(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const body = z
    .object({ refreshFromApi: z.boolean().optional() })
    .parse(request.body ?? {});

  const result = await new MonthlyCycleService().syncParticipants(cycleId, {
    refreshFromApi: body.refreshFromApi ?? true,
    actorUserId: actorId(request),
  });
  return reply.status(200).send(result);
}

export async function listCycleAudit(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const auditLogs = await new MonthlyCycleService().listAudit(
    cycleId,
    getScopedPillarCodes(request.user),
  );
  return reply.status(200).send({ auditLogs });
}

export async function listSafetyHistory(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const query = z
    .object({
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(10).optional(),
      externalId: z.string().optional(),
      action: z.string().optional(),
    })
    .parse(request.query);

  const result = await new MonthlyCycleService().listSafetyHistory(cycleId, {
    ...(query.page != null ? { page: query.page } : {}),
    ...(query.pageSize != null ? { pageSize: query.pageSize } : {}),
    ...(query.externalId != null ? { externalId: query.externalId } : {}),
    ...(query.action != null ? { action: query.action } : {}),
  });
  return reply.status(200).send(result);
}

export async function listSafetyAccidents(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const accidents = await new SafetySyncService().listAccidents(cycleId);
  return reply.status(200).send({ accidents });
}

export async function syncSafetyFromCipa(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const summary = await new SafetySyncService().syncFromCipa(
    cycleId,
    actorId(request),
  );
  return reply.status(200).send({ summary });
}

export async function importSafetyAccidents(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);

  const body = z
    .object({
      accidents: z.array(
        z.object({
          externalId: z.string().min(1),
          employeeExternalId: z.string().nullable().optional(),
          employeeCardNumber: z.string().nullable().optional(),
          sectorExternalId: z.string().min(1),
          unit: z.enum(['PEDERTRACTOR', 'TRACTOR']),
          accidentType: z.enum(['WITH_LEAVE', 'WITHOUT_LEAVE', 'FREQUENCY']),
          occurredAt: z.string().min(1),
          daysAway: z.number().int().nullable().optional(),
          description: z.string().nullable().optional(),
          rawPayload: z.unknown().optional(),
        }),
      ),
    })
    .parse(request.body);

  const summary = await new SafetySyncService().importNormalized(
    cycleId,
    body.accidents.map((a) => ({
      externalId: a.externalId,
      sectorExternalId: a.sectorExternalId,
      unit: a.unit,
      accidentType: a.accidentType,
      occurredAt: a.occurredAt,
      ...(a.employeeExternalId !== undefined
        ? { employeeExternalId: a.employeeExternalId }
        : {}),
      ...(a.employeeCardNumber !== undefined
        ? { employeeCardNumber: a.employeeCardNumber }
        : {}),
      ...(a.daysAway !== undefined ? { daysAway: a.daysAway } : {}),
      ...(a.description !== undefined ? { description: a.description } : {}),
      ...(a.rawPayload !== undefined ? { rawPayload: a.rawPayload } : {}),
    })),
    actorId(request),
  );
  return reply.status(200).send({ summary });
}

export async function reviewSafetyAccident(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { accidentId } = z
    .object({ accidentId: z.string().uuid() })
    .parse(request.params);
  const body = z
    .object({
      status: z.enum(['VALIDATED', 'REJECTED']),
      rejectionReason: z.string().nullable().optional(),
    })
    .parse(request.body);

  const accident = await new SafetySyncService().reviewAccident({
    accidentId,
    status: body.status,
    ...(body.rejectionReason !== undefined
      ? { rejectionReason: body.rejectionReason }
      : {}),
    actorUserId: actorId(request),
  });

  return reply.status(200).send({
    accident: {
      id: accident.id,
      status: accident.status,
      rejectionReason: accident.rejectionReason,
      reviewedAt: accident.reviewedAt?.toISOString() ?? null,
    },
  });
}

export async function getSafetyResults(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const query = z
    .object({
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(10).optional(),
      costCenter: z.string().optional(),
    })
    .parse(request.query);

  const results = await new SafetyCalculationService().getResults(cycleId, {
    ...(query.page != null ? { page: query.page } : {}),
    ...(query.pageSize != null ? { pageSize: query.pageSize } : {}),
    ...(query.costCenter != null ? { costCenter: query.costCenter } : {}),
  });
  return reply.status(200).send({ results });
}

export async function getAbsenteeismResults(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const query = z
    .object({
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(10).optional(),
      costCenter: z.string().optional(),
    })
    .parse(request.query);

  assertCanAccessPillar(request.user, $Enums.PillarCode.ABSENTEEISM, 'read');
  const results = await new AbsenteeismCalculationService().getResults(
    cycleId,
    {
      ...(query.page != null ? { page: query.page } : {}),
      ...(query.pageSize != null ? { pageSize: query.pageSize } : {}),
      ...(query.costCenter != null ? { costCenter: query.costCenter } : {}),
    },
  );
  return reply.status(200).send({ results });
}

export async function getAbsenteeismSectorDetail(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId, sectorId } = z
    .object({
      cycleId: z.string().uuid(),
      sectorId: z.string().uuid(),
    })
    .parse(request.params);
  const query = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(10).default(10),
    })
    .parse(request.query);

  assertCanAccessPillar(request.user, $Enums.PillarCode.ABSENTEEISM, 'read');
  const detail = await new AbsenteeismCalculationService().getSectorDetail(
    cycleId,
    sectorId,
    query,
  );
  return reply.status(200).send(detail);
}

export async function getAbsenteeismParticipantDetail(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId, participantId } = z
    .object({
      cycleId: z.string().uuid(),
      participantId: z.string().uuid(),
    })
    .parse(request.params);

  assertCanAccessPillar(request.user, $Enums.PillarCode.ABSENTEEISM, 'read');
  const detail =
    await new AbsenteeismCalculationService().getParticipantDetail(
      cycleId,
      participantId,
    );
  return reply.status(200).send(detail);
}

export async function getSafetySectorDetail(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId, sectorId } = z
    .object({
      cycleId: z.string().uuid(),
      sectorId: z.string().uuid(),
    })
    .parse(request.params);
  const query = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(10).default(10),
    })
    .parse(request.query);
  const detail = await new SafetyCalculationService().getSectorDetail(
    cycleId,
    sectorId,
    query,
  );
  return reply.status(200).send(detail);
}

export async function getSafetyParticipantDetail(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId, participantId } = z
    .object({
      cycleId: z.string().uuid(),
      participantId: z.string().uuid(),
    })
    .parse(request.params);
  const detail = await new SafetyCalculationService().getParticipantDetail(
    cycleId,
    participantId,
  );
  return reply.status(200).send(detail);
}

export async function calculateSafety(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const result = await new SafetyCalculationService().calculate(
    cycleId,
    actorId(request),
  );
  return reply.status(200).send(result);
}

export async function setFrequencyResult(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);
  const body = z
    .object({
      sectorId: z.string().uuid(),
      preservedInternalPoints: z.number().min(0).max(20),
    })
    .parse(request.body);

  const result = await new SafetyCalculationService().setFrequencyResult({
    cycleId,
    sectorId: body.sectorId,
    preservedInternalPoints: body.preservedInternalPoints,
    actorUserId: actorId(request),
  });
  return reply.status(200).send({ result });
}

export async function listAbsenteeism(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const query = z
    .object({
      month: z.coerce
        .number()
        .int()
        .min(1, 'Mês deve estar entre 1 e 12')
        .max(12, 'Mês deve estar entre 1 e 12'),
      year: z.coerce
        .number()
        .int()
        .min(2000, 'Ano inválido')
        .max(2100, 'Ano inválido'),
    })
    .parse(request.query);

  const month = String(query.month).padStart(2, '0');
  const year = String(query.year);
  const data = await absenteeismService.listByPeriod(month, year);
  return reply.status(200).send(data);
}

export async function getProgramYearScoringRules(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { programYearId } = z
    .object({ programYearId: z.string().uuid() })
    .parse(request.params);

  const result = await new ScoringRulesService().getProgramYearRules(
    programYearId,
  );
  return reply.status(200).send(result);
}

export async function updateProgramYearScoringRules(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { programYearId } = z
    .object({ programYearId: z.string().uuid() })
    .parse(request.params);

  const result = await new ScoringRulesService().updateProgramYearRules(
    programYearId,
    request.body,
    actorId(request),
  );
  return reply.status(200).send(result);
}

export async function getCycleScoringRules(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { cycleId } = z
    .object({ cycleId: z.string().uuid() })
    .parse(request.params);

  const result = await new ScoringRulesService().getCycleRules(
    cycleId,
    getScopedPillarCodes(request.user),
  );
  return reply.status(200).send(result);
}
