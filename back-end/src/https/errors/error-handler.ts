import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { HttpError } from './index.js';

export const INTERNAL_SERVER_ERROR_MESSAGE = 'Erro interno do servidor';

function sendError(reply: FastifyReply, statusCode: number, error: string) {
  return reply.status(statusCode).send({ error });
}

export function apiErrorHandler(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof HttpError) {
    // Mensagens de HttpError são pensadas para o cliente — sempre encaminhar.
    const message = error.message?.trim() || INTERNAL_SERVER_ERROR_MESSAGE;
    return sendError(reply, error.statusCode, message);
  }

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const message = firstIssue?.message ?? 'Erro de validação';
    return sendError(reply, 400, message);
  }

  // Erros de validação do Fastify (schema JSON)
  const fastifyError = error as FastifyError;
  if (fastifyError.validation) {
    const detail =
      fastifyError.validation[0]?.message ??
      fastifyError.message ??
      'Dados inválidos';
    return sendError(reply, 400, detail);
  }

  console.error('Unhandled error:', error);
  return sendError(reply, 500, INTERNAL_SERVER_ERROR_MESSAGE);
}
