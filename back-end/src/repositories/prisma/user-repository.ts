import { randomUUID } from 'node:crypto';
import {
  $Enums,
  Prisma,
  PrismaClient,
  type User,
} from '../../generated/prisma/client.js';

/** Campos de User que podem ser expostos (nunca inclui passwordHash) */
const userSafeSelect = {
  id: true,
  employeeId: true,
  name: true,
  unit: true,
  cardNumber: true,
  role: true,
  active: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type UserWithoutPassword = Prisma.UserGetPayload<{
  select: typeof userSafeSelect;
}>;

export class UserPrismaRepository {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async findById(id: string): Promise<UserWithoutPassword | null> {
    return await this.prisma.user.findUnique({
      where: { id },
      select: userSafeSelect,
    });
  }

  async findAll(): Promise<UserWithoutPassword[]> {
    return await this.prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: userSafeSelect,
    });
  }

  /** Retorna usuário sem passwordHash (uso em listagens/detalhes). */
  async findByUnitAndCardNumber({
    cardNumber,
    unit,
  }: {
    cardNumber: string;
    unit: $Enums.Unit;
  }): Promise<UserWithoutPassword | null> {
    return await this.prisma.user.findUnique({
      where: {
        cardNumber_unit: {
          cardNumber,
          unit,
        },
      },
      select: userSafeSelect,
    });
  }

  /** Apenas para autenticação (login); retorna usuário com passwordHash. */
  async findByUnitAndCardNumberForAuth({
    cardNumber,
    unit,
  }: {
    cardNumber: string;
    unit: $Enums.Unit;
  }): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: {
        cardNumber_unit: {
          cardNumber,
          unit,
        },
      },
    });
  }

  async create(data: {
    employeeId: string;
    name: string;
    unit: $Enums.Unit;
    cardNumber: string;
    role: $Enums.UserRole;
    active: boolean;
    passwordHash: string;
  }): Promise<UserWithoutPassword> {
    return await this.prisma.user.create({
      data,
      select: userSafeSelect,
    });
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
  ): Promise<UserWithoutPassword> {
    return await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
      select: userSafeSelect,
    });
  }

  async resetPasswordToDefault(
    userId: string,
    passwordHash: string,
  ): Promise<UserWithoutPassword> {
    return await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true },
      select: userSafeSelect,
    });
  }

  async updateRole(
    userId: string,
    role: $Enums.UserRole,
  ): Promise<UserWithoutPassword> {
    return await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: userSafeSelect,
    });
  }

  async findAssignedPillarCodes(userId: string): Promise<$Enums.PillarCode[]> {
    const rows = await this.prisma.userPillarAssignment.findMany({
      where: { userId },
      select: { pillarCode: true },
      orderBy: { pillarCode: 'asc' },
    });
    return rows.map((row) => row.pillarCode);
  }

  async replacePillarAssignments(
    userId: string,
    pillarCodes: $Enums.PillarCode[],
  ): Promise<void> {
    await this.prisma.userPillarAssignment.deleteMany({ where: { userId } });
    if (pillarCodes.length === 0) return;
    // createMany não aplica @default(uuid()) do client — id precisa ser explícito.
    await this.prisma.userPillarAssignment.createMany({
      data: pillarCodes.map((pillarCode) => ({
        id: randomUUID(),
        userId,
        pillarCode,
      })),
    });
  }
}
