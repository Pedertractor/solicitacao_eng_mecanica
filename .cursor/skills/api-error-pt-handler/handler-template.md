# Handler templates

Project stack: Fastify backend (`HttpError` + `setErrorHandler`), Axios + Sonner frontend.

## Backend — `back-end/src/https/errors/error-handler.ts`

```ts
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import {
  RECEIPT_FILE_TOO_LARGE_MESSAGE,
} from '../../constants/receipt-upload-limits.js';
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
```

### Wire in `app.ts`

Replace the inline `app.setErrorHandler(...)` body with:

```ts
import { apiErrorHandler } from './https/errors/error-handler.js';

app.setErrorHandler(apiErrorHandler);
```

Remove unused imports that only served the old inline handler (`ZodError`,
`HttpError`, receipt constants) from `app.ts` if they are no longer needed there.

## Frontend — resolve message from backend response

In `front-end/src/utils/axiosConfig.ts` (or a shared helper used by it):

```ts
const INTERNAL_SERVER_ERROR_MESSAGE = 'erro interno do servidor';

function resolveApiErrorMessage(
  status: number,
  apiMessage: string | undefined,
): string {
  if (status === 500) {
    return apiMessage?.trim() || INTERNAL_SERVER_ERROR_MESSAGE;
  }
  return apiMessage?.trim() || 'Erro inesperado, verifique a conexão.';
}
```

Use `resolveApiErrorMessage` inside the response error interceptor so toasts and
`Promise.reject({ message, status })` always carry Portuguese text derived from
the backend response (with the 500 rule above).

## Middleware alignment

When touching auth/role/CIPA middlewares, prefer:

```ts
throw new HttpError('Não autorizado', 401);
```

instead of `reply.status(401).send({ error: '...' })`, so every path goes through
the custom handler.

## Anti-patterns

```ts
// BAD — leaks internal details / English
return reply.status(500).send({ error: error.message });
return reply.status(500).send({ error: 'Internal server error' });

// GOOD
return reply.status(500).send({ error: 'erro interno do servidor' });
```
