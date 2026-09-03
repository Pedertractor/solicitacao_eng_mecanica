import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { HttpError } from './index.js';

export const INTERNAL_SERVER_ERROR_MESSAGE = 'erro interno do servidor';

function sendError(reply: FastifyReply, statusCode: number, error: string) {
  return reply.status(statusCode).send({ error });
}

export function apiErrorHandler(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof HttpError) {
    const message =
      error.statusCode === 500
        ? INTERNAL_SERVER_ERROR_MESSAGE
        : error.message;
    return sendError(reply, error.statusCode, message);
  }

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const message = firstIssue?.message ?? 'Erro de validação';
    return sendError(reply, 400, message);
  }

  console.error('Unhandled error:', error);
  return sendError(reply, 500, INTERNAL_SERVER_ERROR_MESSAGE);
}
