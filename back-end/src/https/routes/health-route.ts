import type { FastifyInstance } from 'fastify';
import { healthCheck } from '../controllers/health-controller.js';

const checksSchema = {
  type: 'object',
  properties: {
    api: { type: 'string', enum: ['ok'] },
    db: { type: 'string', enum: ['ok', 'error'] },
  },
} as const;

export async function healthRoutes(app: FastifyInstance) {
  app.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Health check',
        description:
          'Returns 200 when the API and database are healthy; 503 if the database is unreachable.',
        response: {
          200: {
            description: 'All checks passed',
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok'] },
              checks: checksSchema,
            },
          },
          503: {
            description: 'One or more checks failed',
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['error'] },
              checks: checksSchema,
            },
          },
        },
      },
    },
    healthCheck,
  );
}
