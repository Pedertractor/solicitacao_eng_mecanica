import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export async function healthCheck(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  let dbStatus: 'ok' | 'error' = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error('healthcheck db:', error);
    dbStatus = 'error';
  }

  const checks = {
    api: 'ok' as const,
    db: dbStatus,
  };

  if (dbStatus === 'error') {
    return reply.status(503).send({
      status: 'error',
      checks,
    });
  }

  return reply.status(200).send({
    status: 'ok',
    checks,
  });
}
