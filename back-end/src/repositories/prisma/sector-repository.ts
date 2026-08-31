import {
  $Enums,
  Prisma,
  PrismaClient,
} from '../../generated/prisma/client.js';

export class SectorPrismaRepository {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async upsertByExternalId(data: {
    externalId: string;
    code: string | null;
    name: string;
    unit?: $Enums.Unit | null;
    active: boolean;
  }) {
    return this.prisma.sector.upsert({
      where: { externalId: data.externalId },
      create: {
        externalId: data.externalId,
        code: data.code,
        name: data.name,
        unit: data.unit ?? null,
        active: data.active,
      },
      update: {
        code: data.code,
        name: data.name,
        active: data.active,
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
      },
    });
  }

  async findById(id: string) {
    return this.prisma.sector.findUnique({ where: { id } });
  }

  async findByExternalId(externalId: string) {
    return this.prisma.sector.findUnique({
      where: { externalId },
    });
  }

  async findByCode(code: string) {
    return this.prisma.sector.findFirst({
      where: { code, active: true },
    });
  }

  async findAllActive() {
    return this.prisma.sector.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async updateUnitIfEmpty(id: string, unit: $Enums.Unit) {
    return this.prisma.sector.updateMany({
      where: { id, unit: null },
      data: { unit },
    });
  }
}
