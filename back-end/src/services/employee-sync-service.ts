import { $Enums } from '../generated/prisma/client.js';
import { HttpError } from '../https/errors/index.js';
import { ApiPedertractorEmployee } from '../integrations/api-pedertractor-employee.js';
import { ApiPedertractorSector } from '../integrations/api-pedertractor-sector.js';
import { prisma } from '../lib/prisma.js';
import { EmployeePrismaRepository } from '../repositories/prisma/employee-repository.js';
import { SectorPrismaRepository } from '../repositories/prisma/sector-repository.js';
import { P5AuditService } from './p5-audit-service.js';
import type { ApiBaseEmployeeListItem } from '../types/api-base-employee-list.js';

export type EmployeeSyncSummary = {
  sectorsReceived: number;
  sectorsCreated: number;
  sectorsUpdated: number;
  received: number;
  created: number;
  updated: number;
  deactivated: number;
  ignored: number;
  unmatchedSector: number;
  errors: Array<{ externalId: string; message: string }>;
};

export type PurgeEmployeesSectorsSummary = {
  monthlyScores: number;
  pillarScores: number;
  participants: number;
  accidents: number;
  indicatorResults: number;
  employees: number;
  sectors: number;
};

function parseUnit(unit: string): $Enums.Unit | null {
  if (unit === 'PEDERTRACTOR' || unit === 'TRACTOR') {
    return unit;
  }
  return null;
}

function resolveCurrentDesignation(employee: ApiBaseEmployeeListItem) {
  const designations = employee.Designation ?? [];
  if (designations.length === 0) return null;

  const open = designations.filter((d) => {
    if (!d.endDate || d.endDate.trim() === '') return true;
    const end = Date.parse(d.endDate);
    if (Number.isNaN(end)) return true;
    return end >= Date.now();
  });
  const pool = open.length > 0 ? open : designations;

  return pool.sort((a, b) => {
    const aTime = Date.parse(a.startDate) || 0;
    const bTime = Date.parse(b.startDate) || 0;
    return bTime - aTime;
  })[0];
}

export class EmployeeSyncService {
  /**
   * 1) Carrega setores de GET /sector/list
   * 2) Carrega colaboradores de GET /employee/get (status true)
   * 3) Relaciona Employee.currentSectorId pelo Designation.sector.id ↔ Sector.externalId
   */
  async syncFromPedertractor(
    actorUserId?: string | null,
  ): Promise<EmployeeSyncSummary> {
    const sectorApi = new ApiPedertractorSector();
    const employeeApi = new ApiPedertractorEmployee();
    const sectorRepo = new SectorPrismaRepository(prisma);
    const employeeRepo = new EmployeePrismaRepository(prisma);

    const summary: EmployeeSyncSummary = {
      sectorsReceived: 0,
      sectorsCreated: 0,
      sectorsUpdated: 0,
      received: 0,
      created: 0,
      updated: 0,
      deactivated: 0,
      ignored: 0,
      unmatchedSector: 0,
      errors: [],
    };

    const apiSectors = await sectorApi.listSectors();
    summary.sectorsReceived = apiSectors.length;

    for (const item of apiSectors) {
      if (!item.id?.trim()) {
        summary.errors.push({
          externalId: String(item.id ?? ''),
          message: 'Setor sem id',
        });
        continue;
      }

      const existing = await sectorRepo.findByExternalId(item.id);
      await sectorRepo.upsertByExternalId({
        externalId: item.id,
        code: item.costCenter || null,
        name: item.name,
        active: true,
      });

      if (existing) summary.sectorsUpdated += 1;
      else summary.sectorsCreated += 1;
    }

    const employees = await employeeApi.listEmployees();
    summary.received = employees.length;
    const activeExternalIds: string[] = [];

    for (const item of employees) {
      const externalId = String(item.id);
      try {
        const unit = parseUnit(item.unit);
        if (!unit) {
          summary.ignored += 1;
          summary.errors.push({
            externalId,
            message: `Unidade inválida: ${item.unit}`,
          });
          continue;
        }

        if (!item.cardNumber?.trim()) {
          summary.ignored += 1;
          summary.errors.push({
            externalId,
            message: 'cardNumber ausente',
          });
          continue;
        }

        const designation = resolveCurrentDesignation(item);
        if (!designation?.sector?.id) {
          summary.ignored += 1;
          summary.errors.push({
            externalId,
            message: 'Colaborador sem designation/setor vigente',
          });
          continue;
        }

        const sectorExternalId = designation.sector.id;
        const sector = await sectorRepo.findByExternalId(sectorExternalId);
        if (!sector) {
          summary.ignored += 1;
          summary.unmatchedSector += 1;
          summary.errors.push({
            externalId,
            message: `Setor ${sectorExternalId} não encontrado em /sector/list`,
          });
          continue;
        }

        await sectorRepo.updateUnitIfEmpty(sector.id, unit);

        const userId = await employeeRepo.findUserIdByCardAndUnit(
          item.cardNumber,
          unit,
        );

        const existingEmployee =
          await employeeRepo.findByExternalId(externalId);

        await employeeRepo.upsertByExternalId({
          externalId,
          employeeId: item.cardNumber,
          name: item.name,
          unit,
          active: true,
          currentSectorId: sector.id,
          userId,
        });

        activeExternalIds.push(externalId);

        if (existingEmployee) summary.updated += 1;
        else summary.created += 1;
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Erro desconhecido no sync';
        summary.errors.push({ externalId, message });
        summary.ignored += 1;
      }
    }

    if (activeExternalIds.length > 0) {
      const result =
        await employeeRepo.markInactiveExceptExternalIds(activeExternalIds);
      summary.deactivated = result.count;
    }

    await new P5AuditService().log({
      userId: actorUserId ?? null,
      action: 'EMPLOYEES_SYNC',
      entityType: 'Employee',
      entityId: 'bulk',
      metadata: summary as unknown as object,
    });

    return summary;
  }

  /**
   * Remove colaboradores e setores P5 (e dependências).
   * Não remove contas User de login.
   */
  async purgeEmployeesAndSectors(
    actorUserId?: string | null,
  ): Promise<PurgeEmployeesSectorsSummary> {
    const summary = await prisma.$transaction(async (tx) => {
      const monthlyScores = await tx.employeeMonthlyScore.deleteMany({});
      const pillarScores = await tx.employeePillarScore.deleteMany({});
      const participants = await tx.cycleParticipant.deleteMany({});
      const accidents = await tx.safetyAccident.deleteMany({});
      const indicatorResults = await tx.indicatorResult.deleteMany({});
      const employees = await tx.employee.deleteMany({});
      const sectors = await tx.sector.deleteMany({});

      return {
        monthlyScores: monthlyScores.count,
        pillarScores: pillarScores.count,
        participants: participants.count,
        accidents: accidents.count,
        indicatorResults: indicatorResults.count,
        employees: employees.count,
        sectors: sectors.count,
      };
    });

    await new P5AuditService().log({
      userId: actorUserId ?? null,
      action: 'EMPLOYEES_SECTORS_PURGE',
      entityType: 'Employee',
      entityId: 'bulk',
      metadata: summary as unknown as object,
    });

    return summary;
  }

  async listActiveEmployees() {
    const repo = new EmployeePrismaRepository(prisma);
    return repo.findAllActive();
  }

  async getEmployeeOrThrow(id: string) {
    const repo = new EmployeePrismaRepository(prisma);
    const employee = await repo.findById(id);
    if (!employee) {
      throw new HttpError('Colaborador não encontrado', 404);
    }
    return employee;
  }
}
