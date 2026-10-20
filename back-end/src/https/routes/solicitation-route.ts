import type { FastifyInstance } from 'fastify';
import { AREA_ADMIN_ROLES } from '../../auth/access-policy.js';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/auth-role-middleware.js';
import {
  createSolicitation,
  deleteSolicitation,
  getPartByNumber,
  getProcessCharts,
  getSectorByCostCenter,
  getSolicitationById,
  getSolicitationByTrackingCode,
  getWorkflowSummary,
  getEngineeringQueue,
  listSolicitations,
  sendSampleToKairo,
  sendToolingToKairo,
  startSolicitationReview,
  updateSolicitationReview,
  updateSolicitationStatus,
  updateSolicitationOf,
  sendSolicitationToKairo,
  syncPendingSolicitationsFromKairo,
  syncSampleFromKairo,
  syncSolicitationFromKairo,
  syncToolingFromKairo,
  validateRequester,
} from '../controllers/solicitation-controller.js';

const unitEnum = ['PEDERTRACTOR', 'TRACTOR'] as const;
const departmentEnum = ['ENG_MECANICA', 'DESENVOLVIMENTO_PROCESSOS'] as const;
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
  'CATERPILLAR_GERADORES',
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
  'JOHN_DEERE_HORIZONTINA',
  'JOHN_DEERE_INDAIATUBA',
  'MOTOCANA',
  'PEDERTRACTOR',
  'PRAMAC',
  'SILTOMAC',
  'TRACTOR_COMPONENTS',
  'TRIVELATO',
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
const workflowStageEnum = ['ENGENHARIA', 'FERRAMENTARIA', 'AMOSTRA'] as const;
const workflowStageStatusEnum = [
  'PENDING',
  'READY',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
] as const;

const workflowStageSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    stage: { type: 'string', enum: workflowStageEnum },
    status: { type: 'string', enum: workflowStageStatusEnum },
    order: { type: 'integer' },
    plannedStartAt: { type: ['string', 'null'], format: 'date-time' },
    plannedEndAt: { type: ['string', 'null'], format: 'date-time' },
    plannedDurationPercentage: { type: ['string', 'null'] },
    actualStartAt: { type: ['string', 'null'], format: 'date-time' },
    actualEndAt: { type: ['string', 'null'], format: 'date-time' },
    kairoTeamId: { type: ['string', 'null'] },
    kairoCardIds: { type: ['string', 'null'] },
    kairoSyncedAt: { type: ['string', 'null'], format: 'date-time' },
    kairoSyncedByUserId: { type: ['string', 'null'] },
    completedByUserId: { type: ['string', 'null'] },
  },
} as const;

const workflowSchema = {
  type: 'object',
  properties: {
    requiresTooling: { type: 'boolean' },
    stages: { type: 'array', items: workflowStageSchema },
  },
} as const;

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
    processInstructionRequester: { type: ['string', 'null'] },
    processInstructionProcess: { type: ['string', 'null'] },
    processInstructionType: { type: ['string', 'null'] },
    processInstructionDeadlineLabel: { type: ['string', 'null'] },
    processInstructionDeadlineDate: { type: ['string', 'null'] },
    deliveryDate: { type: ['string', 'null'] },
    partNumbers: { type: ['string', 'null'] },
    fileLink: { type: ['string', 'null'] },
    ofNumber: { type: ['string', 'null'] },
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
    kairoCardIds: { type: ['string', 'null'] },
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
    department: {
      type: 'string',
      enum: ['ENG_MECANICA', 'DESENVOLVIMENTO_PROCESSOS'],
    },
    requiresTooling: { type: 'boolean' },
    workflow: { anyOf: [workflowSchema, { type: 'null' }] },
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
    department: { type: 'string', enum: departmentEnum },
    client: { type: ['string', 'null'], enum: [...clientEnum, null] },
    processInstructionRequester: { type: ['string', 'null'] },
    processInstructionProcess: { type: ['string', 'null'] },
    processInstructionType: { type: ['string', 'null'] },
    processInstructionDeadlineLabel: { type: ['string', 'null'] },
    processInstructionDeadlineDate: { type: ['string', 'null'] },
    deliveryDate: { type: ['string', 'null'] },
    partNumbers: { type: ['string', 'null'] },
    fileLink: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
    statusUpdatedAt: { type: ['string', 'null'], format: 'date-time' },
    workflow: { anyOf: [workflowSchema, { type: 'null' }] },
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

  app.get(
    '/part/:partNumber',
    {
      schema: {
        tags: ['solicitations'],
        summary: 'Buscar part number na API base (público)',
        params: {
          type: 'object',
          required: ['partNumber'],
          properties: {
            partNumber: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              part: {
                type: 'object',
                properties: {
                  partNumber: { type: 'string' },
                  partCode: { type: ['string', 'null'] },
                  description: { type: ['string', 'null'] },
                  status: { type: ['boolean', 'null'] },
                },
              },
            },
          },
          404: errorResponseSchema,
        },
      },
    },
    getPartByNumber,
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
            'requesterEmail',
            'department',
          ],
          properties: {
            cardNumber: { type: 'string', minLength: 1 },
            unit: { type: 'string', enum: unitEnum },
            costCenter: { type: 'string', minLength: 1 },
            pillarOrLocation: { type: 'string', minLength: 1 },
            title: { type: 'string' },
            description: { type: 'string' },
            requesterEmail: { type: 'string', format: 'email' },
            department: { type: 'string', enum: departmentEnum },
            processInstructionRequester: { type: 'string' },
            processInstructionProcess: { type: 'string' },
            processInstructionType: { type: 'string' },
            client: { type: 'string', enum: clientEnum },
            deliveryDate: { type: 'string' },
            partNumbers: { type: 'string' },
            fileLink: { type: 'string' },
            comments: { type: 'string' },
            requiresTooling: { type: 'boolean' },
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
      preHandler: [authMiddleware],
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
            onlyWorkflow: { type: 'string', enum: ['true', 'false', '1', '0'] },
            createdFrom: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            createdTo: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            q: { type: 'string', maxLength: 120 },
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

  app.get(
    '/workflow/summary',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['solicitations'],
        summary: 'Resumo do workflow Comercial',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              stages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    stage: { type: 'string', enum: workflowStageEnum },
                    total: { type: 'integer' },
                    inProgress: { type: 'integer' },
                    waiting: { type: 'integer' },
                    done: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    getWorkflowSummary,
  );

  app.get(
    '/workflow/engineering',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['solicitations'],
        summary: 'Projetos com etapa de Engenharia aberta, por prazo mais próximo',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              solicitations: {
                type: 'array',
                items: solicitationSchema,
              },
            },
            required: ['solicitations'],
          },
          403: errorResponseSchema,
        },
      },
    },
    getEngineeringQueue,
  );

  app.post(
    '/:id/workflow/tooling/send-to-kairo',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['solicitations'],
        summary: 'Enviar etapa de ferramentaria ao Kairo',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['teamId'],
          properties: {
            teamId: { type: 'string', minLength: 1 },
            title: { type: 'string' },
            description: { type: 'string' },
            tagId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { solicitation: solicitationSchema },
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    sendToolingToKairo,
  );

  app.post(
    '/:id/workflow/tooling/sync-kairo',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['solicitations'],
        summary: 'Sincronizar etapa de ferramentaria com o Kairo',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { solicitation: solicitationSchema },
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    syncToolingFromKairo,
  );

  app.post(
    '/:id/workflow/sample/send-to-kairo',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['solicitations'],
        summary: 'Enviar etapa de amostra ao Kairo',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['teamId'],
          properties: {
            teamId: { type: 'string', minLength: 1 },
            title: { type: 'string' },
            description: { type: 'string' },
            tagId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { solicitation: solicitationSchema },
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    sendSampleToKairo,
  );

  app.post(
    '/:id/workflow/sample/sync-kairo',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['solicitations'],
        summary: 'Sincronizar etapa de amostra com o Kairo',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { solicitation: solicitationSchema },
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    syncSampleFromKairo,
  );

  app.post(
    '/sync-kairo-pending',
    {
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
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
    '/process-charts',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['solicitations'],
        summary: 'Indicadores de pedidos por time (admin de processos)',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['teamId'],
          properties: {
            teamId: { type: 'string', minLength: 1 },
            period: { type: 'string', enum: ['year', 'month', 'week'] },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['period', 'teamId', 'byClient', 'byActivityType', 'byResponsible'],
            properties: {
              period: { type: 'string', enum: ['year', 'month', 'week'] },
              teamId: { type: 'string' },
              byClient: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['key', 'label', 'count'],
                  properties: {
                    key: { type: 'string' },
                    label: { type: 'string' },
                    count: { type: 'integer' },
                  },
                },
              },
              byActivityType: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['key', 'label', 'count'],
                  properties: {
                    key: { type: 'string' },
                    label: { type: 'string' },
                    count: { type: 'integer' },
                  },
                },
              },
              byResponsible: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['key', 'label', 'count'],
                  properties: {
                    key: { type: 'string' },
                    label: { type: 'string' },
                    count: { type: 'integer' },
                  },
                },
              },
            },
          },
          403: errorResponseSchema,
        },
      },
    },
    getProcessCharts,
  );

  app.get(
    '/:id',
    {
      preHandler: [authMiddleware],
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
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
      schema: {
        tags: ['solicitations'],
        summary: 'Excluir solicitação (admin)',
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
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
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
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
      schema: {
        tags: ['solicitations'],
        summary: 'Aprovar solicitação em revisão',
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
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
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

  app.patch(
    '/:id/of',
    {
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
      schema: {
        tags: ['solicitations'],
        summary: 'Vincular número de OF à solicitação (admin)',
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
          required: ['ofNumber'],
          properties: {
            ofNumber: { type: ['string', 'null'] },
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
    updateSolicitationOf,
  );

  app.post(
    '/:id/send-to-kairo',
    {
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
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
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
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
