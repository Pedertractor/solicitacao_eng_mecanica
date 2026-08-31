import bcrypt from 'bcrypt';
import { HttpError } from '../https/errors/index.js';
import { prisma } from '../lib/prisma.js';
import {
  UserPrismaRepository,
  type UserWithoutPassword,
} from '../repositories/prisma/user-repository.js';
import { $Enums } from '../generated/prisma/client.js';
import { ApiPedertractorEmployee } from '../integrations/api-pedertractor-employee.js';

export type RegisterUserInput = {
  cardNumber: string;
  unit: $Enums.Unit;
  active: boolean;
  role: $Enums.UserRole;
  pillarCodes?: $Enums.PillarCode[] | undefined;
};

export type UpdateUserByAdminInput = {
  role: $Enums.UserRole;
  pillarCodes?: $Enums.PillarCode[] | undefined;
};

const ALL_PILLAR_CODES = new Set<string>(Object.values($Enums.PillarCode));

function normalizePillarCodes(
  pillarCodes: $Enums.PillarCode[] | undefined,
): $Enums.PillarCode[] {
  if (!pillarCodes?.length) return [];
  const unique = [...new Set(pillarCodes)];
  for (const code of unique) {
    if (!ALL_PILLAR_CODES.has(code)) {
      throw new HttpError('Pilar inválido', 400);
    }
  }
  return unique;
}

function validateRolePillarAssignment(
  role: $Enums.UserRole,
  pillarCodes: $Enums.PillarCode[],
): void {
  if (role === $Enums.UserRole.RESPONSIBLE) {
    if (pillarCodes.length === 0) {
      throw new HttpError(
        'Responsável deve ter ao menos um pilar atribuído',
        400,
      );
    }
    return;
  }

  if (pillarCodes.length > 0) {
    throw new HttpError(
      'Somente responsáveis podem ter pilares atribuídos',
      400,
    );
  }
}

function mapUserResponse(
  user: UserWithoutPassword,
  assignedPillarCodes: $Enums.PillarCode[],
) {
  return {
    id: user.id,
    name: user.name,
    cardNumber: user.cardNumber,
    unit: user.unit,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    active: user.active,
    assignedPillarCodes,
    createdAt: user.createdAt.toISOString(),
  };
}

export class UserService {
  async register({
    cardNumber,
    unit,
    active,
    role,
    pillarCodes,
  }: RegisterUserInput): Promise<UserWithoutPassword> {
    const normalizedPillars = normalizePillarCodes(pillarCodes);
    validateRolePillarAssignment(role, normalizedPillars);

    const apiPedertractorEmployee = new ApiPedertractorEmployee();

    const employeeApi = await apiPedertractorEmployee.getEmployee({
      cardNumber,
      unit,
    });

    if (!employeeApi.status) {
      throw new HttpError('Colaborador não está ativo', 400);
    }

    const existing = await prisma.user.findUnique({
      where: {
        cardNumber_unit: {
          cardNumber: employeeApi.cardNumber,
          unit: employeeApi.unit as $Enums.Unit,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new HttpError('Usuário já existe', 400);
    }

    const defaultPassword = employeeApi.cardNumber;
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const created = await prisma.$transaction(async (tx) => {
      const userRepository = new UserPrismaRepository(tx);
      const user = await userRepository.create({
        name: employeeApi.name,
        employeeId: employeeApi.id.toString(),
        unit: employeeApi.unit as $Enums.Unit,
        cardNumber: employeeApi.cardNumber,
        role,
        active,
        passwordHash: hashedPassword,
      });

      if (normalizedPillars.length > 0) {
        await userRepository.replacePillarAssignments(user.id, normalizedPillars);
      }

      return user;
    });

    return created;
  }

  async login({
    cardNumber,
    unit,
    password,
  }: {
    cardNumber: string;
    unit: $Enums.Unit;
    password: string;
  }) {
    const userRepository = new UserPrismaRepository(prisma);

    const user = await userRepository.findByUnitAndCardNumberForAuth({
      cardNumber,
      unit,
    });

    if (!user) {
      throw new HttpError('Credenciais inválidas', 401);
    }

    const match = await bcrypt.compare(password, user.passwordHash);

    if (!match) {
      throw new HttpError('Credenciais inválidas', 401);
    }

    return {
      id: user.id,
      name: user.name,
      cardNumber: user.cardNumber,
      unit: user.unit,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  }

  async listAll() {
    const userRepository = new UserPrismaRepository(prisma);
    const users = await userRepository.findAll();
    const assignments = await prisma.userPillarAssignment.findMany({
      select: { userId: true, pillarCode: true },
      orderBy: { pillarCode: 'asc' },
    });
    const pillarsByUser = new Map<string, $Enums.PillarCode[]>();
    for (const row of assignments) {
      const current = pillarsByUser.get(row.userId) ?? [];
      current.push(row.pillarCode);
      pillarsByUser.set(row.userId, current);
    }

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      cardNumber: user.cardNumber,
      unit: user.unit,
      role: user.role,
      active: user.active,
      assignedPillarCodes: pillarsByUser.get(user.id) ?? [],
      createdAt: user.createdAt.toISOString(),
    }));
  }

  /** Role and active status from DB — used on every authenticated request. */
  async resolveSessionPrincipal(userId: string): Promise<{
    id: string;
    role: $Enums.UserRole;
    active: boolean;
    mustChangePassword: boolean;
    assignedPillarCodes: $Enums.PillarCode[];
  }> {
    const userRepository = new UserPrismaRepository(prisma);
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new HttpError('Usuário não encontrado', 401);
    }
    const assignedPillarCodes =
      await userRepository.findAssignedPillarCodes(userId);
    return {
      id: user.id,
      role: user.role,
      active: user.active,
      mustChangePassword: user.mustChangePassword,
      assignedPillarCodes,
    };
  }

  async getById(userId: string) {
    const userRepository = new UserPrismaRepository(prisma);
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new HttpError('Usuário não encontrado', 404);
    }

    const assignedPillarCodes =
      await userRepository.findAssignedPillarCodes(userId);
    return mapUserResponse(user, assignedPillarCodes);
  }

  async updateUserRoleByAdmin(
    actingAdminId: string,
    targetUserId: string,
    role: $Enums.UserRole,
    pillarCodes?: $Enums.PillarCode[],
  ) {
    if (actingAdminId === targetUserId) {
      throw new HttpError('Não é permitido alterar a própria função', 400);
    }

    const userRepository = new UserPrismaRepository(prisma);
    const target = await userRepository.findById(targetUserId);
    if (!target) {
      throw new HttpError('Usuário não encontrado', 404);
    }

    const normalizedPillars = normalizePillarCodes(pillarCodes);
    validateRolePillarAssignment(role, normalizedPillars);

    await prisma.$transaction(async (tx) => {
      const txRepo = new UserPrismaRepository(tx);
      await txRepo.updateRole(targetUserId, role);
      await txRepo.replacePillarAssignments(targetUserId, normalizedPillars);
    });

    return this.getById(targetUserId);
  }

  async changePasswordFirstLogin(userId: string, newPassword: string) {
    const userRepository = new UserPrismaRepository(prisma);
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new HttpError('Usuário não encontrado', 404);
    }
    if (!user.mustChangePassword) {
      throw new HttpError(
        'Redefinição de senha permitida apenas no primeiro login',
        400,
      );
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepository.updatePassword(userId, hashedPassword);
    return this.getById(userId);
  }

  async resetPasswordToCardNumberByAdmin(
    actingAdminId: string,
    targetUserId: string,
  ) {
    if (actingAdminId === targetUserId) {
      throw new HttpError(
        'Não é permitido redefinir a própria senha por esta ação',
        400,
      );
    }

    const userRepository = new UserPrismaRepository(prisma);
    const target = await userRepository.findById(targetUserId);
    if (!target) {
      throw new HttpError('Usuário não encontrado', 404);
    }

    const hashedPassword = await bcrypt.hash(target.cardNumber, 10);
    await userRepository.resetPasswordToDefault(targetUserId, hashedPassword);
    return this.getById(targetUserId);
  }

  async validateEmployee(cardNumber: string, unit: $Enums.Unit) {
    const apiPedertractorEmployee = new ApiPedertractorEmployee();
    const employeeApi = await apiPedertractorEmployee.getEmployee({
      cardNumber,
      unit,
    });
    if (!employeeApi.status) {
      throw new HttpError(
        'Colaborador não está ativo no diretório corporativo',
        400,
      );
    }
    const userRepository = new UserPrismaRepository(prisma);
    const existing = await userRepository.findByUnitAndCardNumber({
      cardNumber: employeeApi.cardNumber,
      unit: employeeApi.unit as $Enums.Unit,
    });
    if (existing) {
      throw new HttpError(
        'Já existe um usuário cadastrado com este cartão e unidade',
        400,
      );
    }
    return {
      name: employeeApi.name,
      status: employeeApi.status,
    };
  }
}
