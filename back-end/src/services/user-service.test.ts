import { afterEach, describe, expect, it, vi } from 'vitest';
import { $Enums } from '../generated/prisma/client.js';
import {
  UserPrismaRepository,
  type UserWithoutPassword,
} from '../repositories/prisma/user-repository.js';
import { UserService } from './user-service.js';

vi.mock('../lib/prisma.js', () => ({ prisma: {} }));

const targetUser: UserWithoutPassword = {
  id: '22222222-2222-4222-8222-222222222222',
  employeeId: '2',
  name: 'Usuário alvo',
  unit: $Enums.Unit.PEDERTRACTOR,
  cardNumber: '200',
  role: $Enums.UserRole.USER,
  active: true,
  mustChangePassword: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('UserService.updateUserRoleByAdmin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('impede que o administrador altere a própria função', async () => {
    const repositoryFind = vi.spyOn(
      UserPrismaRepository.prototype,
      'findById',
    );
    const repositoryUpdate = vi.spyOn(
      UserPrismaRepository.prototype,
      'updateRole',
    );
    const service = new UserService();

    await expect(
      service.updateUserRoleByAdmin(
        targetUser.id,
        targetUser.id,
        $Enums.UserRole.RESPONSIBLE,
      ),
    ).rejects.toMatchObject({
      message: 'Não é permitido alterar a própria função',
      statusCode: 400,
    });
    expect(repositoryFind).not.toHaveBeenCalled();
    expect(repositoryUpdate).not.toHaveBeenCalled();
  });

  it('permite que o administrador altere a função de outro usuário', async () => {
    const repositoryFind = vi
      .spyOn(UserPrismaRepository.prototype, 'findById')
      .mockResolvedValue(targetUser);
    const repositoryUpdate = vi
      .spyOn(UserPrismaRepository.prototype, 'updateRole')
      .mockResolvedValue({
        ...targetUser,
        role: $Enums.UserRole.RESPONSIBLE,
      });
    const service = new UserService();

    await service.updateUserRoleByAdmin(
      '11111111-1111-4111-8111-111111111111',
      targetUser.id,
      $Enums.UserRole.RESPONSIBLE,
    );

    expect(repositoryFind).toHaveBeenCalledWith(targetUser.id);
    expect(repositoryUpdate).toHaveBeenCalledWith(
      targetUser.id,
      $Enums.UserRole.RESPONSIBLE,
    );
  });
});
