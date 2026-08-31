import { $Enums } from '../generated/prisma/client.js';
import { HttpError } from '../https/errors/index.js';
import { prisma } from '../lib/prisma.js';
import { EmployeePrismaRepository } from '../repositories/prisma/employee-repository.js';
import { CycleParticipantPrismaRepository } from '../repositories/prisma/monthly-cycle-repository.js';
import { SectorPrismaRepository } from '../repositories/prisma/sector-repository.js';
import { AbsenteeismCalculationService } from './absenteeism-calculation-service.js';

const DEFAULT_COST_CENTER = '7051';
const DEFAULT_CARD_NUMBER = '5485';
const DEFAULT_UNIT = $Enums.Unit.PEDERTRACTOR;
const DEFAULT_EMPLOYEE_NAME = 'MATHEUS MARQUES SILVA';

export type SimulateAbsenteeismInput = {
  absenteeism: number;
  costCenter?: string;
  cardNumber?: string;
  unit?: 'PEDERTRACTOR' | 'TRACTOR';
  actorUserId?: string | null;
};

export class AbsenteeismSimulationService {
  async simulate(input: SimulateAbsenteeismInput) {
    const costCenter = (input.costCenter ?? DEFAULT_COST_CENTER).trim();
    const cardNumber = (input.cardNumber ?? DEFAULT_CARD_NUMBER).trim();
    const unit = input.unit ?? DEFAULT_UNIT;

    const cycle = await prisma.monthlyCycle.findFirst({
      where: {
        status: {
          in: [
            $Enums.CycleStatus.OPEN,
            $Enums.CycleStatus.CALCULATED,
            $Enums.CycleStatus.UNDER_REVIEW,
          ],
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    if (!cycle) {
      throw new HttpError(
        'Nenhum ciclo editável (Aberto, Calculado ou Em revisão). Abra um ciclo no P5 antes de simular.',
        400,
      );
    }

    const sectorRepo = new SectorPrismaRepository(prisma);
    const sector = await sectorRepo.findByCode(costCenter);
    if (!sector) {
      throw new HttpError(
        `Setor ${costCenter} não encontrado. Sincronize setores/colaboradores antes de simular.`,
        404,
      );
    }

    const employeeRepo = new EmployeePrismaRepository(prisma);
    let employee = await employeeRepo.findByUnitAndCardNumber(unit, cardNumber);
    if (!employee) {
      employee = await prisma.employee.create({
        data: {
          externalId: `sim-emp-${unit}-${cardNumber}`,
          employeeId: cardNumber,
          name: DEFAULT_EMPLOYEE_NAME,
          unit,
          active: true,
          currentSectorId: sector.id,
        },
      });
    }

    const participantRepo = new CycleParticipantPrismaRepository(prisma);
    const participant = await participantRepo.upsert({
      cycleId: cycle.id,
      employeeId: employee.id,
      sectorId: sector.id,
      employeeNameSnapshot: employee.name,
      sectorNameSnapshot: sector.name,
      unitSnapshot: unit,
      activeInCycle: true,
    });

    const result = await new AbsenteeismCalculationService().scoreEmployeeOnCycle(
      {
        cycleId: cycle.id,
        employeeId: employee.id,
        absenteeism: input.absenteeism,
        source: 'SIMULATION',
        ...(input.actorUserId !== undefined
          ? { actorUserId: input.actorUserId }
          : {}),
      },
    );

    return {
      simulation: {
        costCenter,
        cardNumber,
        unit,
        absenteeism: input.absenteeism,
        employeeName: employee.name,
        sectorName: sector.name,
        cycleId: cycle.id,
        cycleLabel: `${cycle.month}/${cycle.year}`,
        participantId: participant.id,
      },
      score: {
        absenteeism: result.score.absenteeism,
        individualPreserved: result.score.individualPreserved,
        sectorPreserved: result.score.sectorPreserved,
        internalTotal: result.score.internalTotal,
        weightedP5: result.score.weightedP5,
        individualDeducted: result.score.individualDeducted,
      },
    };
  }
}
