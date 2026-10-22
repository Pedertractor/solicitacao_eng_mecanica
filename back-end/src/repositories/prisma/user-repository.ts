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
  department: true,
  approvalStatus: true,
  active: true,
  mustChangePassword: true,
  notificationEmail: true,
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

  async findAll(
    where?: Prisma.UserWhereInput,
  ): Promise<UserWithoutPassword[]> {
    return await this.prisma.user.findMany({
      ...(where ? { where } : {}),
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
    department: $Enums.UserDepartment | null;
    approvalStatus?: $Enums.UserApprovalStatus;
    active: boolean;
    mustChangePassword?: boolean;
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
    department: $Enums.UserDepartment | null,
  ): Promise<UserWithoutPassword> {
    return await this.prisma.user.update({
      where: { id: userId },
      data: { role, department },
      select: userSafeSelect,
    });
  }

  async updateApproval(
    userId: string,
    data: {
      approvalStatus: $Enums.UserApprovalStatus;
      active: boolean;
    },
  ): Promise<UserWithoutPassword> {
    return await this.prisma.user.update({
      where: { id: userId },
      data,
      select: userSafeSelect,
    });
  }

  async updateNotificationEmail(
    userId: string,
    notificationEmail: string | null,
  ): Promise<UserWithoutPassword> {
    return await this.prisma.user.update({
      where: { id: userId },
      data: { notificationEmail },
      select: userSafeSelect,
    });
  }

  async findAreaAdminsWithNotificationEmail(
    department: $Enums.UserDepartment,
  ): Promise<UserWithoutPassword[]> {
    return await this.prisma.user.findMany({
      where: {
        role: $Enums.UserRole.ADMIN,
        department,
        active: true,
        approvalStatus: $Enums.UserApprovalStatus.APPROVED,
        notificationEmail: { not: null },
      },
      orderBy: { name: 'asc' },
      select: userSafeSelect,
    });
  }

  async applyBootstrapSuperAdminState(
    userId: string,
  ): Promise<UserWithoutPassword> {
    return await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: $Enums.UserRole.SUPER_ADMIN,
        department: null,
        approvalStatus: $Enums.UserApprovalStatus.APPROVED,
        active: true,
      },
      select: userSafeSelect,
    });
  }
}
