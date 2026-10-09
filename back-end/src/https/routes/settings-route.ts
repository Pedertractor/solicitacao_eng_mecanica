import type { FastifyInstance } from 'fastify';
import { $Enums } from '../../generated/prisma/client.js';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/auth-role-middleware.js';
import {
  getEmailCc,
  updateEmailCc,
} from '../controllers/settings-controller.js';

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
} as const;

const emailCcResponseSchema = {
  type: 'object',
  properties: {
    emails: {
      type: 'array',
      items: { type: 'string', format: 'email' },
    },
  },
} as const;

export async function settingsRoutes(app: FastifyInstance) {
  app.get(
    '/email-cc',
    {
      preHandler: [authMiddleware, roleMiddleware([$Enums.UserRole.SUPER_ADMIN])],
      schema: {
        tags: ['settings'],
        summary: 'Listar e-mails em cópia (super admin)',
        security: [{ bearerAuth: [] }],
        response: {
          200: emailCcResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    getEmailCc,
  );

  app.put(
    '/email-cc',
    {
      preHandler: [authMiddleware, roleMiddleware([$Enums.UserRole.SUPER_ADMIN])],
      schema: {
        tags: ['settings'],
        summary: 'Atualizar e-mails em cópia (super admin)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['emails'],
          properties: {
            emails: {
              type: 'array',
              items: { type: 'string', format: 'email' },
            },
          },
        },
        response: {
          200: emailCcResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    updateEmailCc,
  );
}
