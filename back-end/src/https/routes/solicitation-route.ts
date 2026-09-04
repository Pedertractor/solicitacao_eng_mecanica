import type { FastifyInstance } from 'fastify';
import { $Enums } from '../../generated/prisma/client.js';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/auth-role-middleware.js';
import {
  createSolicitation,
  deleteSolicitation,
  getSectorByCostCenter,
  getSolicitationById,
  getSolicitationByTrackingCode,
  listSolicitations,
  startSolicitationReview,
  updateSolicitationReview,
  updateSolicitationStatus,
  sendSolicitationToKairo,
  syncPendingSolicitationsFromKairo,
  syncSolicitationFromKairo,
  validateRequester,
} from '../controllers/solicitation-controller.js';

const unitEnum = ['PEDERTRACTOR', 'TRACTOR'] as const;
const statusEnum = [
  'PENDING',
  'IN_REVIEW',
  'APPROVED',
  'COMPLETED',
  'CANCELLED',
  'DELETED',
] as const;
const deletionSourceEnum = ['SOLICITATION_APP', 'KAIRO'] as const;

const clientEnum = [
  'CATERPILLAR',
  'CNH_CONTAGEM',
  'CNH_CURITIBA',
  'CNH_PIRACICABA',
  'CNH_SOROCABA',
  'CRUCIANELLI',
  'DYNAPAC',
  'HYUNDAI',
  'IVECO',
  'JACTO',
  'JCB',
  'JOHN_DEERE_CATALAO',
  'JOHN_DEERE_INDAIATUBA',
  'PEDERTRACTOR',
  'PRAMAC',
  'SILTOMAC',
  'TRACTOR_COMPONENTS',
  'VOLVO',
] as const;

const activityTypeEnum = [
  'ANALISE_TECNICA',
  'DESENHO_2D',
  'DISP_ELEVACAO',
  'INSPECAO_CADASTRO',
  'LEVANTAMENTO_DE_CUSTO',
  'NR12',
  'NR13',
  'NAO_CLASSIFICADA',
  'PROJETO_INDUSTRIAL',
  'PROJETO_MELHORIA',
  'REUNIAO',
  'VALIDACAO_ESTRUTURAL',
] as const;

const productTypeEnum = [
  'AMOSTRA',
  'PRODUCAO',
  'PROTOTIPO',
  'SEM_CLASSIFICACAO',
] as const;

const priorityEnum = [
  'BAIXA',
  'NORMAL',
  'SEM_CLASSIFICACAO',
  'URGENTE',
] as const;

const kindEnum = ['PROJETO', 'ATIVIDADE'] as const;

const solicitationSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    trackingCode: { type: 'string' },
    employeeId: { type: 'string' },
    requesterName: { type: 'string' },
    requesterEmail: { type: ['string', 'null'] },
    cardNumber: { type: 'string' },
    unit: { type: 'string', enum: unitEnum },
    costCenter: { type: 'string' },
    sectorId: { type: 'string' },
    sectorName: { type: 'string' },
    pillarOrLocation: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    client: { type: ['string', 'null'], enum: [...clientEnum, null] },
    kind: { type: ['string', 'null'], enum: [...kindEnum, null] },
    activityType: {
      type: ['string', 'null'],
      enum: [...activityTypeEnum, null],
    },
    productType: {
      type: ['string', 'null'],
      enum: [...productTypeEnum, null],
    },
    priority: { type: ['string', 'null'], enum: [...priorityEnum, null] },
    status: { type: 'string', enum: statusEnum },
    statusUpdatedAt: { type: ['string', 'null'], format: 'date-time' },
    statusUpdatedByUserId: { type: ['string', 'null'] },
    kairoCardId: { type: ['string', 'null'] },
    kairoTeamId: { type: ['string', 'null'] },
    kairoSyncedAt: { type: ['string', 'null'], format: 'date-time' },
    kairoSyncedByUserId: { type: ['string', 'null'] },
    deletedAt: { type: ['string', 'null'], format: 'date-time' },
    deletedByUserId: { type: ['string', 'null'] },
    deletedByName: { type: ['string', 'null'] },
    deletedFrom: {
      type: ['string', 'null'],
      enum: [...deletionSourceEnum, null],
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const publicTicketSchema = {
  type: 'object',
  properties: {
    trackingCode: { type: 'string' },
    status: { type: 'string', enum: statusEnum },
    title: { type: 'string' },
    description: { type: 'string' },
    requesterName: { type: 'string' },
    sectorName: { type: 'string' },
    pillarOrLocation: { type: 'string' },
    unit: { type: 'string', enum: unitEnum },
    createdAt: { type: 'string', format: 'date-time' },
    statusUpdatedAt: { type: ['string', 'null'], format: 'date-time' },
  },
} as const;

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
} as const;

export async function solicitationRoutes(app: FastifyInstance) {
  app.post(
    '/validate-requester',
    {
      schema: {
        tags: ['solicitations'],
        summary: 'Validar solicitante (público)',
        body: {
          type: 'object',
          required: ['cardNumber', 'unit'],
          properties: {
            cardNumber: { type: 'string', minLength: 1 },
            unit: { type: 'string', enum: unitEnum },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              employeeId: { type: 'string' },
              name: { type: 'string' },
              status: { type: 'boolean' },
              cardNumber: { type: 'string' },
              unit: { type: 'string', enum: unitEnum },
              email: { type: ['string', 'null'] },
            },
          },
          400: errorResponseSchema,
        },
      },
    },
    validateRequester,
  );

  app.get(
    '/sector/:costCenter',
    {
      schema: {
        tags: ['solicitations'],
        summary: 'Buscar setor por centro de custo (público)',
        params: {
          type: 'object',
          required: ['costCenter'],
          properties: {
            costCenter: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              costCenter: { type: 'string' },
              normalizedName: { type: 'string' },
              status: { type: 'boolean' },
            },
          },
          404: errorResponseSchema,
        },
      },
    },
    getSectorByCostCenter,
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['solicitations'],
        summary: 'Criar solicitação (público)',
        body: {
          type: 'object',
          required: [
            'cardNumber',
            'unit',
            'costCenter',
            'pillarOrLocation',
            'title',
            'description',
            'requesterEmail',
          ],
          properties: {
            cardNumber: { type: 'string', minLength: 1 },
            unit: { type: 'string', enum: unitEnum },
            costCenter: { type: 'string', minLength: 1 },
            pillarOrLocation: { type: 'string', minLength: 1 },
            title: { type: 'string', minLength: 1 },
            description: { type: 'string', minLength: 1 },
            requesterEmail: { type: 'string', format: 'email' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              solicitation: solicitationSchema,
            },
          },
          400: errorResponseSchema,
        },
      },
    },
    createSolicitation,
  );

  app.get(
    '/track/:trackingCode',
    {
      schema: {
        tags: ['solicitations'],
        summary: 'Acompanhar solicitação por protocolo (público)',
        params: {
          type: 'object',
          required: ['trackingCode'],
          properties: {
            trackingCode: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              solicitation: publicTicketSchema,
            },
          },
          404: errorResponseSchema,
        },
      },
    },
    getSolicitationByTrackingCode,
  );

  app.get(
    '/',
    {
      preHandler: [authMiddleware, roleMiddleware([$Enums.UserRole.ADMIN])],
      schema: {
        tags: ['solicitations'],
        summary: 'Listar solicitações (admin)',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: statusEnum },
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
            sortBy: {
              type: 'string',
              enum: [
                'createdAt',
                'requesterName',
                'sectorName',
                'title',
                'status',
              ],
              default: 'createdAt',
            },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              solicitations: {
                type: 'array',
                items: solicitationSchema,
              },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  pageSize: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
                required: ['page', 'pageSize', 'total', 'totalPages'],
              },
            },
            required: ['solicitations', 'pagination'],
          },
        },
      },
    },
    listSolicitations,
  );

  app.post(
    '/sync-kairo-pending',
    {
      preHandler: [authMiddleware, roleMiddleware([$Enums.UserRole.ADMIN])],
      schema: {
        tags: ['solicitations'],
        summary:
          'Sincronizar solicitações pendentes vinculadas ao Kairo (lote)',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              checked: { type: 'number' },
              completed: { type: 'number' },
              deleted: { type: 'number' },
            },
          },
        },
      },
    },
    syncPendingSolicitationsFromKairo,
  );

  app.get(
    '/:id',
    {
      preHandler: [authMiddleware, roleMiddleware([$Enums.UserRole.ADMIN])],
      schema: {
        tags: ['solicitations'],
        summary: 'Detalhe da solicitação (admin)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              solicitation: solicitationSchema,
            },
          },
          404: errorResponseSchema,
        },
      },
    },
    getSolicitationById,
  );

  app.delete(
    '/:id',
    {
      preHandler: [authMiddleware, roleMiddleware([$Enums.UserRole.ADMIN])],
      schema: {
        tags: ['solicitations'],
        summary: 'Excluir solicitação aberta (admin)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              solicitation: solicitationSchema,
            },
          },
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    deleteSolicitation,
  );

  app.post(
    '/:id/start-review',
    {
      preHandler: [authMiddleware, roleMiddleware([$Enums.UserRole.ADMIN])],
      schema: {
        tags: ['solicitations'],
        summary: 'Iniciar revisão (Pendente → Em análise)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              solicitation: solicitationSchema,
            },
          },
          404: errorResponseSchema,
        },
      },
    },
    startSolicitationReview,
  );

  app.patch(
    '/:id/review',
    {
      preHandler: [authMiddleware, roleMiddleware([$Enums.UserRole.ADMIN])],
      schema: {
        tags: ['solicitations'],
        summary: 'Salvar campos de revisão / aprovar',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['client', 'activityType', 'productType', 'priority'],
          properties: {
            client: { type: ['string', 'null'], enum: [...clientEnum, null] },
            activityType: {
              type: ['string', 'null'],
              enum: [...activityTypeEnum, null],
            },
            productType: {
              type: ['string', 'null'],
              enum: [...productTypeEnum, null],
            },
            priority: {
              type: ['string', 'null'],
              enum: [...priorityEnum, null],
            },
            approve: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              solicitation: solicitationSchema,
            },
          },
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    updateSolicitationReview,
  );

  app.patch(
    '/:id/status',
    {
      preHandler: [authMiddleware, roleMiddleware([$Enums.UserRole.ADMIN])],
      schema: {
        tags: ['solicitations'],
        summary: 'Atualizar status (admin)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: [
                'PENDING',
                'IN_REVIEW',
                'APPROVED',
                'COMPLETED',
                'CANCELLED',
              ],
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              solicitation: solicitationSchema,
            },
          },
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    updateSolicitationStatus,
  );

  app.post(
    '/:id/send-to-kairo',
    {
      preHandler: [authMiddleware, roleMiddleware([$Enums.UserRole.ADMIN])],
      schema: {
        tags: ['solicitations'],
        summary: 'Enviar solicitação aprovada ao Kairo',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['teamId', 'kind', 'title', 'description'],
          properties: {
            teamId: { type: 'string', minLength: 1 },
            kind: { type: 'string', enum: kindEnum },
            title: { type: 'string', minLength: 1 },
            description: { type: 'string', minLength: 1 },
            tagId: { type: 'string' },
            estimatedHours: { type: 'number', exclusiveMinimum: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              solicitation: solicitationSchema,
            },
          },
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    sendSolicitationToKairo,
  );

  app.post(
    '/:id/sync-kairo',
    {
      preHandler: [authMiddleware, roleMiddleware([$Enums.UserRole.ADMIN])],
      schema: {
        tags: ['solicitations'],
        summary:
          'Sincronizar status da solicitação com o card correspondente no Kairo',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              solicitation: solicitationSchema,
            },
          },
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    syncSolicitationFromKairo,
  );
}
