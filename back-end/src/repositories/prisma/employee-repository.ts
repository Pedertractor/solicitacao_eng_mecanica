import {
  $Enums,
  Prisma,
  PrismaClient,
} from '../../generated/prisma/client.js';

export class EmployeePrismaRepository {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async upsertByExternalId(data: {
    externalId: string;
    employeeId: string;
    name: string;
    unit: $Enums.Unit;
    active: boolean;
    currentSectorId: string | null;
    userId: string | null;
  }) {
    return this.prisma.employee.upsert({
      where: { externalId: data.externalId },
      create: data,
      update: {
        employeeId: data.employeeId,
        name: data.name,
        unit: data.unit,
        active: data.active,
        currentSectorId: data.currentSectorId,
        userId: data.userId,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.employee.findUnique({ where: { id } });
  }

  async findByUnitAndCardNumber(unit: $Enums.Unit, cardNumber: string) {
    return this.prisma.employee.findFirst({
      where: { unit, employeeId: cardNumber, active: true },
    });
  }

  async findByEmployeeId(employeeId: string) {
    return this.prisma.employee.findUnique({ where: { employeeId } });
  }

  async findByExternalId(externalId: string) {
    return this.prisma.employee.findUnique({ where: { externalId } });
  }

  async findAllActive() {
    return this.prisma.employee.findMany({
      where: { active: true },
      include: { currentSector: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAllActiveWithSector() {
    return this.prisma.employee.findMany({
      where: {
        active: true,
        currentSectorId: { not: null },
      },
      include: { currentSector: true },
      orderBy: { name: 'asc' },
    });
  }

  async markInactiveExceptExternalIds(activeExternalIds: string[]) {
    return this.prisma.employee.updateMany({
      where: {
        active: true,
        externalId: { notIn: activeExternalIds },
      },
      data: { active: false },
    });
  }

  async findUserIdByCardAndUnit(cardNumber: string, unit: $Enums.Unit) {
    const user = await this.prisma.user.findUnique({
      where: { cardNumber_unit: { cardNumber, unit } },
      select: { id: true },
    });
    return user?.id ?? null;
  }
}
