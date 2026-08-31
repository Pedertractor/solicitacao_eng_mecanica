import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { getEmployeeList } from '../controllers/employee-controller.js';

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string', description: 'Mensagem de erro' },
  },
} as const;

const unitEnum = ['PEDERTRACTOR', 'TRACTOR'] as const;

const employeeItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', description: 'ID do colaborador na API base' },
    name: { type: 'string', description: 'Nome' },
    cardNumber: { type: 'string', description: 'Número do cartão' },
    unit: { type: 'string', enum: unitEnum, description: 'Unidade' },
  },
} as const;

export async function employeeRoutes(app: FastifyInstance) {
  app.get('/', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['users'],
      summary: 'Listar colaboradores',
      description: 'Lista colaboradores ativos da API base (PederTractor).',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          description: 'Lista de colaboradores',
          type: 'object',
          properties: {
            employees: {
              type: 'array',
              items: employeeItemSchema,
            },
          },
        },
        401: {
          description: 'Não autorizado',
          ...errorResponseSchema,
        },
      },
    },
    handler: getEmployeeList,
  });
}
