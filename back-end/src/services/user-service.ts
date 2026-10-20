import bcrypt from 'bcrypt';
import {
  type AccessActor,
  canAssignDepartment,
  canAssignRole,
  canManageUser,
  departmentForAssignedRole,
  isAdminOf,
  isPlatformAdmin,
  isSuperAdmin,
} from '../auth/access-policy.js';
import {
  BOOTSTRAP_SUPER_ADMIN_DEPARTMENT,
  BOOTSTRAP_SUPER_ADMIN_ROLE,
  isBootstrapSuperAdmin,
} from '../auth/bootstrap-super-admin.js';
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
  department?: $Enums.UserDepartment | undefined;
};

export type PublicSignupInput = {
  cardNumber: string;
  unit: $Enums.Unit;
  password: string;
  department: $Enums.UserDepartment;
};

function mapUserResponse(user: UserWithoutPassword) {
  return {
    id: user.id,
    name: user.name,
    cardNumber: user.cardNumber,
    unit: user.unit,
    role: user.role,
    department: user.department,
    approvalStatus: user.approvalStatus,
    mustChangePassword: user.mustChangePassword,
    notificationEmail: user.notificationEmail,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
  };
}

export class UserService {
  async register(
    input: RegisterUserInput,
    actor: AccessActor,
  ): Promise<UserWithoutPassword> {
    if (!isPlatformAdmin(actor)) {
      throw new HttpError('Sem permissão para cadastrar usuários', 403);
    }
    if (!canAssignRole(actor, input.role)) {
      throw new HttpError('Você não pode atribuir este papel', 403);
    }

    const role = this.resolveRegisterRole(input);
    const department = this.resolveRegisterDepartment(actor, input);
    this.assertRoleMatchesDepartment(role, department);
    if (!canAssignDepartment(actor, role, department)) {
      throw new HttpError('Você não pode atribuir este departamento', 403);
    }

    const employeeApi = await this.loadActiveEmployee(
      input.cardNumber,
      input.unit,
    );
    await this.assertCardAvailable(
      employeeApi.cardNumber,
      employeeApi.unit as $Enums.Unit,
    );

    const hashedPassword = await bcrypt.hash(employeeApi.cardNumber, 10);
    const userRepository = new UserPrismaRepository(prisma);
    return await userRepository.create({
      name: employeeApi.name,
      employeeId: employeeApi.id.toString(),
      unit: employeeApi.unit as $Enums.Unit,
      cardNumber: employeeApi.cardNumber,
      role,
      department,
      approvalStatus: $Enums.UserApprovalStatus.APPROVED,
      active: input.active,
      mustChangePassword: true,
      passwordHash: hashedPassword,
    });
  }

  async signupPublic(input: PublicSignupInput): Promise<UserWithoutPassword> {
    const employeeApi = await this.loadActiveEmployee(
      input.cardNumber,
      input.unit,
    );
    await this.assertCardAvailable(
      employeeApi.cardNumber,
      employeeApi.unit as $Enums.Unit,
    );

    const isBootstrap = isBootstrapSuperAdmin({
      cardNumber: employeeApi.cardNumber,
      unit: employeeApi.unit as $Enums.Unit,
    });

    const hashedPassword = await bcrypt.hash(input.password, 10);
    const userRepository = new UserPrismaRepository(prisma);
    return await userRepository.create({
      name: employeeApi.name,
      employeeId: employeeApi.id.toString(),
      unit: employeeApi.unit as $Enums.Unit,
      cardNumber: employeeApi.cardNumber,
      role: isBootstrap ? BOOTSTRAP_SUPER_ADMIN_ROLE : $Enums.UserRole.USER,
      department: isBootstrap
        ? BOOTSTRAP_SUPER_ADMIN_DEPARTMENT
        : input.department,
      approvalStatus: isBootstrap
        ? $Enums.UserApprovalStatus.APPROVED
        : $Enums.UserApprovalStatus.PENDING,
      active: isBootstrap,
      mustChangePassword: false,
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

    const synced = await this.syncBootstrapSuperAdminIfNeeded(user);

    if (synced.approvalStatus === $Enums.UserApprovalStatus.PENDING) {
      throw new HttpError(
        'Cadastro aguardando aprovação da sua área',
        403,
      );
    }

    if (synced.approvalStatus === $Enums.UserApprovalStatus.REJECTED) {
      throw new HttpError(
        'Cadastro recusado. Entre em contato com o administrador da sua área',
        403,
      );
    }

    if (!synced.active) {
      throw new HttpError('Usuário inativo', 401);
    }

    return {
      id: synced.id,
      name: synced.name,
      cardNumber: synced.cardNumber,
      unit: synced.unit,
      role: synced.role,
      department: synced.department,
      approvalStatus: synced.approvalStatus,
      mustChangePassword: synced.mustChangePassword,
    };
  }

  async listAll(actor: AccessActor) {
    if (!isPlatformAdmin(actor)) {
      throw new HttpError('Sem permissão para listar usuários', 403);
    }

    const userRepository = new UserPrismaRepository(prisma);
    const users = await userRepository.findAll(
      isSuperAdmin(actor.role)
        ? undefined
        : isAdminOf(actor, $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS)
          ? {
              department: {
                in: [
                  $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS,
                  $Enums.UserDepartment.FERRAMENTARIA,
                  $Enums.UserDepartment.AMOSTRA,
                ],
              },
              role: { not: $Enums.UserRole.SUPER_ADMIN },
            }
          : {
              department: actor.department,
              role: { not: $Enums.UserRole.SUPER_ADMIN },
            },
    );
    const synced = await Promise.all(
      users.map((user) => this.syncBootstrapSuperAdminIfNeeded(user)),
    );
    return synced.map(mapUserResponse);
  }

  async resolveSessionPrincipal(userId: string): Promise<{
    id: string;
    role: $Enums.UserRole;
    department: $Enums.UserDepartment;
    cardNumber: string;
    unit: $Enums.Unit;
    approvalStatus: $Enums.UserApprovalStatus;
    active: boolean;
    mustChangePassword: boolean;
  }> {
    const userRepository = new UserPrismaRepository(prisma);
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new HttpError('Usuário não encontrado', 401);
    }
    const synced = await this.syncBootstrapSuperAdminIfNeeded(user);
    return {
      id: synced.id,
      role: synced.role,
      department: synced.department,
      cardNumber: synced.cardNumber,
      unit: synced.unit,
      approvalStatus: synced.approvalStatus,
      active: synced.active,
      mustChangePassword: synced.mustChangePassword,
    };
  }

  async getById(userId: string) {
    const userRepository = new UserPrismaRepository(prisma);
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new HttpError('Usuário não encontrado', 404);
    }
    const synced = await this.syncBootstrapSuperAdminIfNeeded(user);
    return mapUserResponse(synced);
  }

  async updateNotificationEmail(
    userId: string,
    email: string | null | '',
  ) {
    const userRepository = new UserPrismaRepository(prisma);
    const existing = await userRepository.findById(userId);
    if (!existing) {
      throw new HttpError('Usuário não encontrado', 404);
    }

    const trimmed = typeof email === 'string' ? email.trim() : '';
    const notificationEmail = trimmed.length > 0 ? trimmed.toLowerCase() : null;
    const updated = await userRepository.updateNotificationEmail(
      userId,
      notificationEmail,
    );
    return mapUserResponse(updated);
  }

  async listAreaAdminsWithNotificationEmail(
    department: $Enums.UserDepartment,
  ) {
    const userRepository = new UserPrismaRepository(prisma);
    return userRepository.findAreaAdminsWithNotificationEmail(department);
  }

  async getManagedById(actor: AccessActor, userId: string) {
    await this.requireManagedUser(actor, userId);
    return this.getById(userId);
  }

  async updateUserRoleByAdmin(
    actor: AccessActor,
    targetUserId: string,
    role: $Enums.UserRole,
    departmentInput?: $Enums.UserDepartment,
  ) {
    if (actor.id === targetUserId) {
      throw new HttpError('Não é permitido alterar a própria função', 400);
    }

    const target = await this.requireManagedUser(actor, targetUserId);
    this.assertBootstrapSuperAdminImmutable(target);
    if (!canAssignRole(actor, role)) {
      throw new HttpError('Você não pode atribuir este papel', 403);
    }

    const department = departmentForAssignedRole(
      role,
      target.department,
      departmentInput,
    );
    this.assertRoleMatchesDepartment(role, department);
    if (!canAssignDepartment(actor, role, department)) {
      throw new HttpError('Você não pode atribuir este departamento', 403);
    }

    const userRepository = new UserPrismaRepository(prisma);
    await userRepository.updateRole(targetUserId, role, department);
    return this.getById(targetUserId);
  }

  async approveUser(actor: AccessActor, targetUserId: string) {
    const target = await this.requireManagedUser(actor, targetUserId);
    if (target.approvalStatus !== $Enums.UserApprovalStatus.PENDING) {
      throw new HttpError('Este cadastro não está aguardando aprovação', 400);
    }

    const userRepository = new UserPrismaRepository(prisma);
    await userRepository.updateApproval(targetUserId, {
      approvalStatus: $Enums.UserApprovalStatus.APPROVED,
      active: true,
    });
    return this.getById(targetUserId);
  }

  async rejectUser(actor: AccessActor, targetUserId: string) {
    const target = await this.requireManagedUser(actor, targetUserId);
    this.assertBootstrapSuperAdminImmutable(target);
    if (target.approvalStatus !== $Enums.UserApprovalStatus.PENDING) {
      throw new HttpError('Este cadastro não está aguardando aprovação', 400);
    }

    const userRepository = new UserPrismaRepository(prisma);
    await userRepository.updateApproval(targetUserId, {
      approvalStatus: $Enums.UserApprovalStatus.REJECTED,
      active: false,
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
    actor: AccessActor,
    targetUserId: string,
  ) {
    if (actor.id === targetUserId) {
      throw new HttpError(
        'Não é permitido redefinir a própria senha por esta ação',
        400,
      );
    }

    const userRepository = new UserPrismaRepository(prisma);
    const target = await this.requireManagedUser(actor, targetUserId);

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

  private resolveRegisterRole(input: RegisterUserInput): $Enums.UserRole {
    if (isBootstrapSuperAdmin(input)) {
      return BOOTSTRAP_SUPER_ADMIN_ROLE;
    }
    return input.role;
  }

  private resolveRegisterDepartment(
    actor: AccessActor,
    input: RegisterUserInput,
  ): $Enums.UserDepartment {
    if (isBootstrapSuperAdmin(input)) {
      return BOOTSTRAP_SUPER_ADMIN_DEPARTMENT;
    }
    const role = this.resolveRegisterRole(input);
    if (role === $Enums.UserRole.COMERCIAL) {
      return $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS;
    }
    if (role === $Enums.UserRole.ADMIN) {
      if (!input.department) {
        throw new HttpError(
          'Informe o departamento do administrador',
          400,
        );
      }
      return input.department;
    }
    if (input.department) {
      return input.department;
    }
    if (!isSuperAdmin(actor.role)) return actor.department;
    throw new HttpError('Informe o departamento', 400);
  }

  private assertBootstrapSuperAdminImmutable(user: {
    cardNumber: string;
    unit: $Enums.Unit;
  }) {
    if (isBootstrapSuperAdmin(user)) {
      throw new HttpError(
        'Este usuário administrador principal não pode ser alterado',
        403,
      );
    }
  }

  private needsBootstrapSuperAdminSync(
    user: Pick<
      UserWithoutPassword,
      | 'cardNumber'
      | 'unit'
      | 'role'
      | 'department'
      | 'approvalStatus'
      | 'active'
    >,
  ): boolean {
    if (!isBootstrapSuperAdmin(user)) return false;
    return (
      user.role !== BOOTSTRAP_SUPER_ADMIN_ROLE ||
      user.department !== BOOTSTRAP_SUPER_ADMIN_DEPARTMENT ||
      user.approvalStatus !== $Enums.UserApprovalStatus.APPROVED ||
      !user.active
    );
  }

  private async syncBootstrapSuperAdminIfNeeded<
    T extends UserWithoutPassword,
  >(user: T): Promise<T> {
    if (!this.needsBootstrapSuperAdminSync(user)) {
      return user;
    }
    const userRepository = new UserPrismaRepository(prisma);
    const updated = await userRepository.applyBootstrapSuperAdminState(user.id);
    return { ...user, ...updated };
  }

  private assertRoleMatchesDepartment(
    role: $Enums.UserRole,
    department: $Enums.UserDepartment,
  ) {
    if (
      role === $Enums.UserRole.COMERCIAL &&
      department !== $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS
    ) {
      throw new HttpError(
        'Comercial precisa do departamento de desenvolvimento de processos',
        400,
      );
    }
    if (role === $Enums.UserRole.ADMIN) {
      const allowed: $Enums.UserDepartment[] = [
        $Enums.UserDepartment.ENG_MECANICA,
        $Enums.UserDepartment.DESENVOLVIMENTO_PROCESSOS,
        $Enums.UserDepartment.FERRAMENTARIA,
        $Enums.UserDepartment.AMOSTRA,
      ];
      if (!allowed.includes(department)) {
        throw new HttpError('Departamento inválido para administrador', 400);
      }
    }
  }

  private async loadActiveEmployee(cardNumber: string, unit: $Enums.Unit) {
    const apiPedertractorEmployee = new ApiPedertractorEmployee();
    const employeeApi = await apiPedertractorEmployee.getEmployee({
      cardNumber,
      unit,
    });
    if (!employeeApi.status) {
      throw new HttpError('Colaborador não está ativo', 400);
    }
    return employeeApi;
  }

  private async assertCardAvailable(cardNumber: string, unit: $Enums.Unit) {
    const existing = await prisma.user.findUnique({
      where: { cardNumber_unit: { cardNumber, unit } },
      select: { id: true },
    });
    if (existing) {
      throw new HttpError('Usuário já existe', 400);
    }
  }

  private async requireManagedUser(actor: AccessActor, targetUserId: string) {
    const userRepository = new UserPrismaRepository(prisma);
    const target = await userRepository.findById(targetUserId);
    if (!target) {
      throw new HttpError('Usuário não encontrado', 404);
    }
    if (!canManageUser(actor, target)) {
      throw new HttpError('Sem permissão para gerenciar este usuário', 403);
    }
    return target;
  }
}
