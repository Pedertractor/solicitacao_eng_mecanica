import type { FastifyReply, FastifyRequest } from 'fastify';
import { $Enums } from '../generated/prisma/client.js';
import { HttpError } from '../https/errors/index.js';
import { authMiddleware } from './auth-middleware.js';
import { roleMiddleware } from './auth-role-middleware.js';

export type PillarAccessMode = 'read' | 'write';

export type PillarAccessUser = {
  role: $Enums.UserRole;
  assignedPillarCodes?: $Enums.PillarCode[];
};

export function getScopedPillarCodes(
  user: PillarAccessUser,
): $Enums.PillarCode[] | null {
  if (user.role === $Enums.UserRole.ADMIN) return null;
  return user.assignedPillarCodes ?? [];
}

export function assertCanAccessPillar(
  user: PillarAccessUser,
  pillarCode: $Enums.PillarCode,
  mode: PillarAccessMode,
): void {
  if (user.role === $Enums.UserRole.ADMIN) return;

  if (user.role !== $Enums.UserRole.RESPONSIBLE) {
    throw new HttpError('Sem permissão para realizar esta ação', 403);
  }

  const assigned = user.assignedPillarCodes ?? [];
  if (!assigned.includes(pillarCode)) {
    throw new HttpError('Sem permissão para acessar este pilar', 403);
  }

  if (mode === 'write' && pillarCode === $Enums.PillarCode.SAFETY) {
    throw new HttpError('Sem permissão para editar o pilar Segurança', 403);
  }
}

export function requirePillarAccess(
  pillarCode: $Enums.PillarCode,
  mode: PillarAccessMode,
) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    assertCanAccessPillar(request.user, pillarCode, mode);
  };
}

async function assertResponsibleHasPillars(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  if (request.user.role === $Enums.UserRole.ADMIN) return;

  const assigned = request.user.assignedPillarCodes ?? [];
  if (assigned.length === 0) {
    throw new HttpError('Responsável sem pilares atribuídos', 403);
  }
}

export const p5Reader = {
  preHandler: [
    authMiddleware,
    roleMiddleware([$Enums.UserRole.ADMIN, $Enums.UserRole.RESPONSIBLE]),
    assertResponsibleHasPillars,
  ],
};

export const safetyReader = {
  preHandler: [
    authMiddleware,
    requirePillarAccess($Enums.PillarCode.SAFETY, 'read'),
  ],
};

export const absenteeismReader = {
  preHandler: [
    authMiddleware,
    requirePillarAccess($Enums.PillarCode.ABSENTEEISM, 'read'),
  ],
};
