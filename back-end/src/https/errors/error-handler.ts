import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { RECEIPT_FILE_TOO_LARGE_MESSAGE } from '../../constants/receipt-upload-limits.js';
import { HttpError } from './index.js';

export const INTERNAL_SERVER_ERROR_MESSAGE = 'erro interno do servidor';

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

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

  const code = getErrorCode(error);
  if (code === 'FST_REQ_FILE_TOO_LARGE') {
    return sendError(reply, 400, RECEIPT_FILE_TOO_LARGE_MESSAGE);
  }

  if (code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    return sendError(
      reply,
      413,
      'O corpo da requisição excede o tamanho máximo permitido.',
    );
  }

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const message = firstIssue?.message ?? 'Erro de validação';
    return sendError(reply, 400, message);
  }

  console.error('Unhandled error:', error);
  return sendError(reply, 500, INTERNAL_SERVER_ERROR_MESSAGE);
}
