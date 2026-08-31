import { $Enums } from '../generated/prisma/client.js';
import { HttpError } from '../https/errors/index.js';
import { createCipaProvider } from '../integrations/cipa/unconfigured-cipa-provider.js';
import type { NormalizedCipaAccident } from '../integrations/cipa/cipa-provider.js';
import { prisma } from '../lib/prisma.js';
import { EmployeePrismaRepository } from '../repositories/prisma/employee-repository.js';
import { MonthlyCyclePrismaRepository } from '../repositories/prisma/monthly-cycle-repository.js';
import { SectorPrismaRepository } from '../repositories/prisma/sector-repository.js';
import { SafetyAccidentPrismaRepository } from '../repositories/prisma/safety-repository.js';
import { P5AuditService } from './p5-audit-service.js';
import { SafetyCalculationService } from './safety-calculation-service.js';

export type SafetySyncSummary = {
  received: number;
  created: number;
  updated: number;
  ignored: number;
  errors: Array<{ externalId: string; message: string }>;
};

function assertCycleEditable(status: $Enums.CycleStatus) {
  if (
    status === $Enums.CycleStatus.HOMOLOGATED ||
    status === $Enums.CycleStatus.LOCKED
  ) {
    throw new HttpError(
      'Não é possível alterar ocorrências de um ciclo homologado ou bloqueado',
      400,
    );
  }
}

export class SafetySyncService {
  async syncFromCipa(
    cycleId: string,
    actorUserId?: string | null,
  ): Promise<SafetySyncSummary> {
    const cycleRepo = new MonthlyCyclePrismaRepository(prisma);
    const cycle = await cycleRepo.findById(cycleId);
    if (!cycle) throw new HttpError('Ciclo não encontrado', 404);
    assertCycleEditable(cycle.status);

    const provider = createCipaProvider();
    const accidents = await provider.listAccidents({
      cycleYear: cycle.year,
      cycleMonth: cycle.month,
    });

    const summary = await this.upsertNormalized(
      cycleId,
      accidents,
      $Enums.SourceSystem.CIPA,
    );

    const recalculated = await new SafetyCalculationService().recalculateIfApplicable(
      cycleId,
      actorUserId,
    );

    await new P5AuditService().log({
      userId: actorUserId ?? null,
      action: 'SAFETY_CIPA_SYNC',
      entityType: 'SafetyAccident',
      entityId: cycleId,
      cycleId,
      metadata: { ...summary, recalculated } as unknown as object,
    });

    return summary;
  }

  async importNormalized(
    cycleId: string,
    accidents: NormalizedCipaAccident[],
    actorUserId?: string | null,
  ): Promise<SafetySyncSummary> {
    const cycleRepo = new MonthlyCyclePrismaRepository(prisma);
    const cycle = await cycleRepo.findById(cycleId);
    if (!cycle) throw new HttpError('Ciclo não encontrado', 404);
    assertCycleEditable(cycle.status);

    const summary = await this.upsertNormalized(
      cycleId,
      accidents,
      $Enums.SourceSystem.MANUAL,
    );

    const recalculated = await new SafetyCalculationService().recalculateIfApplicable(
      cycleId,
      actorUserId,
    );

    await new P5AuditService().log({
      userId: actorUserId ?? null,
      action: 'SAFETY_IMPORT',
      entityType: 'SafetyAccident',
      entityId: cycleId,
      cycleId,
      metadata: { ...summary, recalculated } as unknown as object,
    });

    return summary;
  }

  private async upsertNormalized(
    cycleId: string,
    accidents: NormalizedCipaAccident[],
    defaultSource: $Enums.SourceSystem,
  ): Promise<SafetySyncSummary> {
    const summary: SafetySyncSummary = {
      received: accidents.length,
      created: 0,
      updated: 0,
      ignored: 0,
      errors: [],
    };

    const accidentRepo = new SafetyAccidentPrismaRepository(prisma);
    const sectorRepo = new SectorPrismaRepository(prisma);
    const employeeRepo = new EmployeePrismaRepository(prisma);

    for (const item of accidents) {
      try {
        const unit = item.unit;
        const sector = await sectorRepo.findByExternalId(
          item.sectorExternalId,
        );
        if (!sector) {
          summary.ignored += 1;
          summary.errors.push({
            externalId: item.externalId,
            message: `Setor não encontrado: ${item.sectorExternalId}/${unit}`,
          });
          continue;
        }

        let employeeId: string | null = null;
        if (item.employeeExternalId) {
          const emp = await employeeRepo.findByExternalId(
            item.employeeExternalId,
          );
          employeeId = emp?.id ?? null;
        } else if (item.employeeCardNumber) {
          const emp = await employeeRepo.findByEmployeeId(
            item.employeeCardNumber,
          );
          employeeId = emp?.id ?? null;
        }

        if ((item.employeeExternalId || item.employeeCardNumber) && !employeeId) {
          summary.errors.push({
            externalId: item.externalId,
            message: 'Colaborador não vinculado; ocorrência importada só com setor',
          });
        }

        const occurredAt = new Date(item.occurredAt);
        if (Number.isNaN(occurredAt.getTime())) {
          summary.ignored += 1;
          summary.errors.push({
            externalId: item.externalId,
            message: 'occurredAt inválido',
          });
          continue;
        }

        const sourceSystem =
          defaultSource === $Enums.SourceSystem.MANUAL
            ? $Enums.SourceSystem.MANUAL
            : $Enums.SourceSystem.CIPA;

        const existing = await prisma.safetyAccident.findUnique({
          where: {
            sourceSystem_externalId: {
              sourceSystem,
              externalId: item.externalId,
            },
          },
        });

        await accidentRepo.upsertBySourceAndExternalId({
          cycleId,
          sourceSystem,
          externalId: item.externalId,
          employeeId,
          sectorId: sector.id,
          accidentType: item.accidentType,
          occurredAt,
          daysAway: item.daysAway ?? null,
          description: item.description ?? null,
          status: existing?.status ?? $Enums.AccidentStatus.PENDING_REVIEW,
          rawPayload: (item.rawPayload ?? item) as object,
          lastSyncedAt: new Date(),
        });

        if (existing) summary.updated += 1;
        else summary.created += 1;
      } catch (e) {
        summary.ignored += 1;
        summary.errors.push({
          externalId: item.externalId,
          message: e instanceof Error ? e.message : 'Erro desconhecido',
        });
      }
    }

    return summary;
  }

  async listAccidents(cycleId: string) {
    const cycleRepo = new MonthlyCyclePrismaRepository(prisma);
    const cycle = await cycleRepo.findById(cycleId);
    if (!cycle) throw new HttpError('Ciclo não encontrado', 404);

    // Garante linha de reincidência no histórico antes de listar.
    await new SafetyCalculationService().syncRecidivismHistoryRows(cycleId);

    const repo = new SafetyAccidentPrismaRepository(prisma);
    const rows = await repo.findByCycleId(cycleId);

    return rows
      .map((row) => ({
        id: row.id,
        cycleId: row.cycleId,
        sourceSystem: row.sourceSystem,
        externalId: row.externalId,
        employeeId: row.employeeId,
        employeeName: row.employee?.name ?? null,
        sectorId: row.sectorId,
        sectorName: row.sector.name,
        accidentType: row.accidentType,
        occurredAt: row.occurredAt.toISOString(),
        daysAway: row.daysAway,
        description: row.description,
        status: row.status,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        reviewedByUserId: row.reviewedByUserId,
        reviewedByName: row.reviewedBy?.name ?? null,
        rejectionReason: row.rejectionReason,
        importedAt: row.importedAt.toISOString(),
        lastSyncedAt: row.lastSyncedAt.toISOString(),
      }));
  }

  async reviewAccident(input: {
    accidentId: string;
    status: 'VALIDATED' | 'REJECTED';
    rejectionReason?: string | null;
    actorUserId: string;
  }) {
    const repo = new SafetyAccidentPrismaRepository(prisma);
    const accident = await repo.findById(input.accidentId);
    if (!accident) throw new HttpError('Ocorrência não encontrada', 404);
    assertCycleEditable(accident.cycle.status);

    if (accident.accidentType === $Enums.AccidentType.FREQUENCY) {
      throw new HttpError(
        'Reincidência é gerada automaticamente pelo P5 e não pode ser revisada',
        400,
      );
    }

    if (input.status === 'REJECTED' && !input.rejectionReason?.trim()) {
      throw new HttpError('Motivo é obrigatório ao rejeitar', 400);
    }

    const beforeSnapshot = {
      id: accident.id,
      externalId: accident.externalId,
      sourceSystem: accident.sourceSystem,
      cycleId: accident.cycleId,
      cycleYear: accident.cycle.year,
      cycleMonth: accident.cycle.month,
      employeeId: accident.employeeId,
      employeeName: accident.employee?.name ?? null,
      cardNumber: accident.employee?.employeeId ?? null,
      unit: accident.employee?.unit ?? null,
      sectorId: accident.sectorId,
      sectorName: accident.sector.name,
      costCenter: accident.sector.code,
      accidentType: accident.accidentType,
      status: accident.status,
      occurredAt: accident.occurredAt.toISOString(),
      daysAway: accident.daysAway,
      description: accident.description,
      sourceChangedAt: accident.sourceChangedAt?.toISOString() ?? null,
      cancelledAt: accident.cancelledAt?.toISOString() ?? null,
    };

    const updated = await repo.updateReview(input.accidentId, {
      status:
        input.status === 'VALIDATED'
          ? $Enums.AccidentStatus.VALIDATED
          : $Enums.AccidentStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedByUserId: input.actorUserId,
      rejectionReason:
        input.status === 'REJECTED' ? input.rejectionReason!.trim() : null,
    });

    await new P5AuditService().log({
      userId: input.actorUserId,
      action:
        input.status === 'VALIDATED'
          ? 'SAFETY_ACCIDENT_VALIDATE'
          : 'SAFETY_ACCIDENT_REJECT',
      entityType: 'SafetyAccident',
      entityId: input.accidentId,
      cycleId: accident.cycleId,
      before: beforeSnapshot,
      after: {
        ...beforeSnapshot,
        status: updated.status,
        rejectionReason: updated.rejectionReason,
        reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      },
    });

    await new SafetyCalculationService().recalculateIfApplicable(
      accident.cycleId,
      input.actorUserId,
      accident.employeeId ? [accident.employeeId] : undefined,
    );

    return updated;
  }
}
