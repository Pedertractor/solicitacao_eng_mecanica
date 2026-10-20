import z from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { actorFromSession } from '../../auth/access-policy.js';
import { UserService } from '../../services/user-service.js';
import { $Enums } from '../../generated/prisma/client.js';

const departmentEnum = z.enum($Enums.UserDepartment);

export async function register(request: FastifyRequest, reply: FastifyReply) {
  const userService = new UserService();
  const bodySchema = z.object({
    unit: z.enum($Enums.Unit),
    cardNumber: z.string().min(1, 'Cartão é obrigatório'),
    active: z.boolean().default(true),
    role: z.enum($Enums.UserRole),
    department: departmentEnum.optional(),
  });

  const body = bodySchema.parse(request.body);
  const user = await userService.register(body, actorFromSession(request.user));
  const fullUser = await userService.getById(user.id);

  return reply.status(201).send({
    user: fullUser,
  });
}

export async function signup(request: FastifyRequest, reply: FastifyReply) {
  const userService = new UserService();
  const bodySchema = z
    .object({
      unit: z.enum($Enums.Unit),
      cardNumber: z.string().min(1, 'Cartão é obrigatório'),
      password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
      confirmPassword: z.string().min(6, 'Confirme a senha'),
      department: departmentEnum,
    })
    .refine((body) => body.password === body.confirmPassword, {
      message: 'As senhas não coincidem',
      path: ['confirmPassword'],
    });

  const body = bodySchema.parse(request.body);
  await userService.signupPublic({
    cardNumber: body.cardNumber,
    unit: body.unit,
    password: body.password,
    department: body.department,
  });

  return reply.status(201).send({
    message:
      'Cadastro enviado. Aguarde a aprovação do administrador da área escolhida.',
  });
}

export async function login(request: FastifyRequest, reply: FastifyReply) {
  const userService = new UserService();
  const bodySchema = z.object({
    unit: z.enum($Enums.Unit),
    cardNumber: z.string().min(1, 'Cartão é obrigatório'),
    password: z.string().min(1, 'Senha deve ter no mínimo 1 caracteres'),
  });

  const { unit, cardNumber, password } = bodySchema.parse(request.body);
  const user = await userService.login({ cardNumber, password, unit });
  const token = await reply.jwtSign({ sub: user.id });
  const fullUser = await userService.getById(user.id);

  return reply.status(200).send({
    user: fullUser,
    token,
  });
}

export async function changePasswordFirstLogin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userService = new UserService();
  const bodySchema = z.object({
    newPassword: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  });
  const { newPassword } = bodySchema.parse(request.body);
  const user = await userService.changePasswordFirstLogin(
    request.user.sub,
    newPassword,
  );
  return reply.status(200).send({ user });
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
    actorFromSession(request.user),
    userId,
  );
  return reply.status(200).send({ user });
}

export async function getMe(request: FastifyRequest, reply: FastifyReply) {
  const userService = new UserService();
  const user = await userService.getById(request.user.sub);
  return reply.status(200).send({ user });
}

export async function updateMyNotificationEmail(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const bodySchema = z.object({
    email: z.union([z.email('E-mail inválido'), z.literal(''), z.null()]),
  });
  const { email } = bodySchema.parse(request.body);
  const userService = new UserService();
  const user = await userService.updateNotificationEmail(
    request.user.sub,
    email,
  );
  return reply.status(200).send({ user });
}

export async function listUsers(request: FastifyRequest, reply: FastifyReply) {
  const userService = new UserService();
  const users = await userService.listAll(actorFromSession(request.user));
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
  const user = await userService.getManagedById(
    actorFromSession(request.user),
    userId,
  );
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
    department: z.enum($Enums.UserDepartment).optional(),
  });

  const { userId } = paramsSchema.parse(request.params);
  const body = bodySchema.parse(request.body);

  const userService = new UserService();
  const user = await userService.updateUserRoleByAdmin(
    actorFromSession(request.user),
    userId,
    body.role,
    body.department,
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

export async function approveUser(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    userId: z.string().uuid('ID de usuário inválido'),
  });
  const { userId } = paramsSchema.parse(request.params);
  const userService = new UserService();
  const user = await userService.approveUser(
    actorFromSession(request.user),
    userId,
  );
  return reply.status(200).send({ user });
}

export async function rejectUser(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const paramsSchema = z.object({
    userId: z.string().uuid('ID de usuário inválido'),
  });
  const { userId } = paramsSchema.parse(request.params);
  const userService = new UserService();
  const user = await userService.rejectUser(
    actorFromSession(request.user),
    userId,
  );
  return reply.status(200).send({ user });
}
