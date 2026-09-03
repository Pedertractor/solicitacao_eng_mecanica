import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import {
  deleteMyKairoCredential,
  getMyKairoCredential,
  listMyKairoTags,
  listMyKairoTeams,
  putMyKairoCredential,
} from '../controllers/kairo-controller.js';

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
} as const;

export async function kairoRoutes(app: FastifyInstance) {
  app.get(
    '/',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['kairo'],
        summary: 'Status do vínculo Kairo do usuário autenticado',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              linked: { type: 'boolean' },
              keyPrefix: { type: 'string' },
              linkedAt: { type: 'string', format: 'date-time' },
              lastValidatedAt: { type: ['string', 'null'], format: 'date-time' },
            },
          },
          401: errorResponseSchema,
        },
      },
    },
    getMyKairoCredential,
  );

  app.put(
    '/',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['kairo'],
        summary: 'Vincular chave de API do Kairo',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['apiKey'],
          properties: {
            apiKey: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              linked: { type: 'boolean' },
              keyPrefix: { type: 'string' },
              linkedAt: { type: 'string', format: 'date-time' },
              lastValidatedAt: { type: ['string', 'null'], format: 'date-time' },
            },
          },
          400: errorResponseSchema,
        },
      },
    },
    putMyKairoCredential,
  );

  app.delete(
    '/',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['kairo'],
        summary: 'Desvincular chave de API do Kairo',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              linked: { type: 'boolean' },
            },
          },
        },
      },
    },
    deleteMyKairoCredential,
  );

  app.get(
    '/teams',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['kairo'],
        summary: 'Listar times do usuário no Kairo',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              teams: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: ['string', 'null'] },
                    active: { type: 'boolean' },
                  },
                },
              },
            },
          },
          400: errorResponseSchema,
        },
      },
    },
    listMyKairoTeams,
  );

  app.get(
    '/teams/:teamId/tags',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['kairo'],
        summary: 'Listar etiquetas de um time no Kairo',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['teamId'],
          properties: {
            teamId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              tags: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    teamId: { type: 'string' },
                    name: { type: 'string' },
                    color: { type: 'string' },
                  },
                },
              },
            },
          },
          400: errorResponseSchema,
        },
      },
    },
    listMyKairoTags,
  );
}
