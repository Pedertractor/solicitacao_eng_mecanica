import type { FastifyInstance } from 'fastify';
import { AREA_ADMIN_ROLES } from '../../auth/access-policy.js';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/auth-role-middleware.js';
import { getOfProcesses } from '../controllers/of-controller.js';

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
} as const;

const ofProcessSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    OF: { type: 'number' },
    OP: { type: 'number' },
    QTD: { type: 'number' },
    QTD_APT: { type: 'number' },
    DTH_INI: { type: ['string', 'null'] },
    DTH_INI_BR: { type: ['string', 'null'] },
    employeeName: { type: ['string', 'null'] },
    employeeCard: { type: ['string', 'null'] },
    employeeUnit: { type: ['string', 'null'] },
    employeeId: { type: ['number', 'null'] },
    costCenter: { type: 'string' },
    nameSector: { type: ['string', 'null'] },
    processDate: { type: ['string', 'null'] },
    pointedAt: { type: ['string', 'null'] },
    startedAt: { type: ['string', 'null'] },
    finishedAt: { type: ['string', 'null'] },
    orderStatus: { type: ['string', 'null'] },
    processStatus: { type: ['string', 'null'] },
    statusDetail: { type: ['string', 'null'] },
    machine: { type: ['string', 'null'] },
    pointedMinutes: { type: ['number', 'null'] },
    totalMinutes: { type: ['number', 'null'] },
  },
} as const;

export async function ofRoutes(app: FastifyInstance) {
  app.get(
    '/:ofNumber/processes',
    {
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
      schema: {
        tags: ['of'],
        summary: 'Listar processos de uma OF (admin)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['ofNumber'],
          properties: {
            ofNumber: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              processes: {
                type: 'array',
                items: ofProcessSchema,
              },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    getOfProcesses,
  );
}
