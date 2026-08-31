import z from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { UserService } from '../../services/user-service.js';
import { HttpError } from '../errors/index.js';
import { $Enums } from '../../generated/prisma/client.js';
import { notifyOrion } from '../../integrations/orion-event.js';

export async function register(request: FastifyRequest, reply: FastifyReply) {
  const userService = new UserService();
  try {
    const bodySchema = z.object({
      unit: z.enum($Enums.Unit),
      cardNumber: z.string().min(1, 'Cartão é obrigatório'),
      active: z.boolean().default(true),
      role: z.enum($Enums.UserRole),
      pillarCodes: z.array(z.enum($Enums.PillarCode)).optional(),
    });

    const body = bodySchema.parse(request.body);

    if (
      body.role === $Enums.UserRole.ADMIN &&
      request.user.role !== $Enums.UserRole.ADMIN
    ) {
      throw new HttpError(
        'Apenas administradores podem criar usuários com papel Admin',
        403,
      );
    }

    const user = await userService.register(body);
    const fullUser = await userService.getById(user.id);

    return reply.status(201).send({
      user: fullUser,
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function login(request: FastifyRequest, reply: FastifyReply) {
  const userService = new UserService();

  try {
    const bodySchema = z.object({
      unit: z.enum($Enums.Unit),
      cardNumber: z.string().min(1, 'Cartão é obrigatório'),
      password: z.string().min(1, 'Senha deve ter no mínimo 1 caracteres'),
    });

    const { unit, cardNumber, password } = bodySchema.parse(request.body);

    const user = await userService.login({ cardNumber, password, unit });

    const token = await reply.jwtSign({ sub: user.id });
    const fullUser = await userService.getById(user.id);

    await notifyOrion({
      userId: user.id,
      userName: user.name,
      cardNumberUser: user.cardNumber,
      metadata: { action: 'log' },
    });

    return reply.status(200).send({
      user: fullUser,
      token,
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function changePasswordFirstLogin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userService = new UserService();
  try {
    const bodySchema = z.object({
      newPassword: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    });
    const { newPassword } = bodySchema.parse(request.body);
    const userId = request.user.sub;
    const user = await userService.changePasswordFirstLogin(
      userId,
      newPassword,
    );

    await notifyOrion({
      userId: user.id,
      userName: user.name,
      cardNumberUser: user.cardNumber,
      metadata: { action: 'password_change' },
    });

    return reply.status(200).send({ user });
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function resetUserPasswordByAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    userId: z.string().uuid('ID de usuário inválido'),
  });
  const { userId } = paramsSchema.parse(request.params);

  const userService = new UserService();
  const user = await userService.resetPasswordToCardNumberByAdmin(
    request.user.sub,
    userId,
  );

  await notifyOrion({
    userId: request.user.sub,
    metadata: {
      action: 'password_reset_by_admin',
      targetUserId: user.id,
      targetUserName: user.name,
      targetCardNumber: user.cardNumber,
    },
  });

  return reply.status(200).send({ user });
}

export async function getMe(request: FastifyRequest, reply: FastifyReply) {
  const userService = new UserService();
  const user = await userService.getById(request.user.sub);
  return reply.status(200).send({ user });
}

export async function listUsers(request: FastifyRequest, reply: FastifyReply) {
  const userService = new UserService();
  const users = await userService.listAll();
  return reply.status(200).send({ users });
}

export async function getUserById(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const getUserIdParamsSchema = z.object({
    userId: z.string(),
  });
  const userService = new UserService();
  const { userId } = getUserIdParamsSchema.parse(request.params);
  const user = await userService.getById(userId);
  return reply.status(200).send({ user });
}

export async function updateUserByAdmin(              
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    userId: z.string().uuid('ID de usuário inválido'),
  });
  const bodySchema = z.object({
    role: z.enum($Enums.UserRole),
    pillarCodes: z.array(z.enum($Enums.PillarCode)).optional(),
  });

  const { userId } = paramsSchema.parse(request.params);
  const body = bodySchema.parse(request.body);

  const userService = new UserService();
  const user = await userService.updateUserRoleByAdmin(
    request.user.sub,
    userId,
    body.role,
    body.pillarCodes,
  );

  return reply.status(200).send({ user });
}

export async function validateEmployee(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const bodySchema = z.object({
    cardNumber: z.string().min(1, 'Cartão é obrigatório'),
    unit: z.enum($Enums.Unit),
  });
  const { cardNumber, unit } = bodySchema.parse(request.body);
  const userService = new UserService();
  const result = await userService.validateEmployee(cardNumber, unit);
  return reply.status(200).send(result);
}
