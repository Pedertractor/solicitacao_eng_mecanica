import type { FastifyReply, FastifyRequest } from 'fastify';
import { HttpError } from '../https/errors/index.js';
import { UserService } from '../services/user-service.js';

export async function authMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  try {
    await request.jwtVerify();
  } catch {
    throw new HttpError('Não autorizado', 401);
  }

  const userService = new UserService();
  const principal = await userService.resolveSessionPrincipal(request.user.sub);

  if (!principal.active) {
    throw new HttpError('Usuário inativo', 401);
  }

  const routeUrl = request.routeOptions.url ?? request.url;
  const isPasswordChangeRoute = routeUrl.endsWith('/users/me/change-password');
  const isCurrentUserRoute = routeUrl.endsWith('/users/me');

  if (
    principal.mustChangePassword &&
    !isPasswordChangeRoute &&
    !isCurrentUserRoute
  ) {
    throw new HttpError('Altere sua senha para continuar', 403);
  }

  request.user = {
    sub: principal.id,
    role: principal.role,
    assignedPillarCodes: principal.assignedPillarCodes,
  };
}
