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
};

function mapUserResponse(user: UserWithoutPassword) {
  return {
    id: user.id,
    name: user.name,
    cardNumber: user.cardNumber,
    unit: user.unit,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
  };
}

export class UserService {
  async register({
    cardNumber,
    unit,
    active,
    role,
  }: RegisterUserInput): Promise<UserWithoutPassword> {
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

    const userRepository = new UserPrismaRepository(prisma);
    return await userRepository.create({
      name: employeeApi.name,
      employeeId: employeeApi.id.toString(),
      unit: employeeApi.unit as $Enums.Unit,
      cardNumber: employeeApi.cardNumber,
      role,
      active,
      passwordHash: hashedPassword,
    });
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
    return users.map(mapUserResponse);
  }

  async resolveSessionPrincipal(userId: string): Promise<{
    id: string;
    role: $Enums.UserRole;
    active: boolean;
    mustChangePassword: boolean;
  }> {
    const userRepository = new UserPrismaRepository(prisma);
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new HttpError('Usuário não encontrado', 401);
    }
    return {
      id: user.id,
      role: user.role,
      active: user.active,
      mustChangePassword: user.mustChangePassword,
    };
  }

  async getById(userId: string) {
    const userRepository = new UserPrismaRepository(prisma);
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new HttpError('Usuário não encontrado', 404);
    }
    return mapUserResponse(user);
  }

  async updateUserRoleByAdmin(
    actingAdminId: string,
    targetUserId: string,
    role: $Enums.UserRole,
  ) {
    if (actingAdminId === targetUserId) {
      throw new HttpError('Não é permitido alterar a própria função', 400);
    }

    const userRepository = new UserPrismaRepository(prisma);
    const target = await userRepository.findById(targetUserId);
    if (!target) {
      throw new HttpError('Usuário não encontrado', 404);
    }

    await userRepository.updateRole(targetUserId, role);
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
