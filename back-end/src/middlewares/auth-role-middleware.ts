import type { FastifyReply, FastifyRequest } from 'fastify';
import type { $Enums } from '../generated/prisma/client.js';
import { HttpError } from '../https/errors/index.js';

export function roleMiddleware(requiredRole: $Enums.UserRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!requiredRole.includes(request.user.role)) {
      throw new HttpError('Sem permissão para realizar esta ação', 403);
    }
  };
}
