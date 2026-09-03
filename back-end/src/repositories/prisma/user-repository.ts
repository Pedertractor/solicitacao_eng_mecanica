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
}
