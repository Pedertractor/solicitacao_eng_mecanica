import type { FastifyInstance } from 'fastify';
import { $Enums } from '../../generated/prisma/client.js';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/auth-role-middleware.js';
import { p5Reader, safetyReader, absenteeismReader } from '../../middlewares/pillar-access-middleware.js';
import { cipaApiKeyMiddleware } from '../../middlewares/cipa-api-key-middleware.js';
import * as p5 from '../controllers/p5-controller.js';

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
} as const;

const adminOnly = {
  preHandler: [
    authMiddleware,
    roleMiddleware([$Enums.UserRole.ADMIN]),
  ],
};

export async function p5Routes(app: FastifyInstance) {
  app.post(
    '/integrations/cipa/accidents',
    {
      preHandler: [cipaApiKeyMiddleware],
      schema: {
        tags: ['p5'],
        summary:
          'CIPA push: registrar ocorrência (com ou sem afastamento)',
        description:
          'Autenticação via X-CIPA-API-KEY ou Bearer. Cada ocorrência aplica perda coletiva de fábrica (configurável no painel, padrão 2,06 P5 a todos) e perda individual à vítima (padrão 20 P5). Se o saldo da fábrica ficar abaixo do limiar (padrão 70%), o pilar zera para todos no mês. Não envie o tipo FREQUENCY.',
        security: [],
        body: {
          type: 'object',
          required: [
            'externalId',
            'costCenter',
            'unit',
            'cardNumber',
            'accidentType',
            'occurredAt',
          ],
          properties: {
            externalId: { type: 'string' },
            costCenter: { type: 'string' },
            unit: { type: 'string', enum: ['PEDERTRACTOR', 'TRACTOR'] },
            cardNumber: { type: 'string' },
            accidentType: {
              type: 'string',
              enum: ['WITH_LEAVE', 'WITHOUT_LEAVE'],
              description:
                'Com ou sem afastamento; perdas vêm do painel de pontuação do ciclo',
            },
            occurredAt: { type: 'string' },
            daysAway: { type: 'integer', nullable: true },
            description: { type: 'string', nullable: true },
            cycleYear: { type: 'integer' },
            cycleMonth: { type: 'integer', minimum: 1, maximum: 12 },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          201: { type: 'object', additionalProperties: true },
          401: errorResponseSchema,
        },
      },
    },
    p5.ingestCipaAccident,
  );

  app.put(
    '/integrations/cipa/accidents/:externalId',
    {
      preHandler: [cipaApiKeyMiddleware],
      schema: {
        tags: ['p5'],
        summary:
          'CIPA sync: criar, editar, reclassificar ou restaurar acidente',
        description:
          'Autenticação via X-CIPA-API-KEY ou Bearer. Registra somente atos. Condições comuns são ignoradas; transições condição ↔ ato são auditadas.',
        security: [],
        params: {
          type: 'object',
          required: ['externalId'],
          properties: { externalId: { type: 'string' } },
        },
        body: { type: 'object', additionalProperties: true },
        response: {
          200: { type: 'object', additionalProperties: true },
          201: { type: 'object', additionalProperties: true },
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    p5.putCipaAccident,
  );

  app.delete(
    '/integrations/cipa/accidents/:externalId',
    {
      preHandler: [cipaApiKeyMiddleware],
      schema: {
        tags: ['p5'],
        summary: 'CIPA sync: cancelar acidente logicamente',
        security: [],
        params: {
          type: 'object',
          required: ['externalId'],
          properties: { externalId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['sourceChangedAt', 'actor'],
          properties: {
            sourceChangedAt: { type: 'string' },
            reason: { type: 'string', nullable: true },
            actor: { type: 'object', additionalProperties: true },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    p5.deleteCipaAccident,
  );

  app.post(
    '/dev/simulate-accident',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary:
          'Simular acidente CIPA no ciclo em trabalho e recalcular Segurança na hora',
        description:
          'Bate cartão e unidade do colaborador. Informe com ou sem afastamento.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['accidentType', 'cardNumber', 'unit'],
          properties: {
            accidentType: {
              type: 'string',
              enum: ['WITH_LEAVE', 'WITHOUT_LEAVE'],
            },
            daysAway: { type: 'integer', nullable: true, minimum: 0 },
            costCenter: { type: 'string' },
            cardNumber: { type: 'string' },
            unit: { type: 'string', enum: ['PEDERTRACTOR', 'TRACTOR'] },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          201: { type: 'object', additionalProperties: true },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    p5.simulateAccident,
  );

  app.get(
    '/dev/simulation-accidents',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary:
          'Listar ocorrências do ciclo em trabalho para a simulação',
        security: [{ bearerAuth: [] }],
        response: {
          200: { type: 'object', additionalProperties: true },
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    p5.listSimulationAccidents,
  );

  app.post(
    '/dev/cancel-accident',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary:
          'Remover ocorrência do ciclo em trabalho e recalcular Segurança',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['accidentId'],
          properties: {
            accidentId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    p5.cancelSimulatedAccident,
  );

  app.post(
    '/dev/simulate-absenteeism',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary:
          'Simular índice de absenteísmo de um colaborador no ciclo editável mais recente',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['absenteeism'],
          properties: {
            absenteeism: {
              type: 'number',
              description:
                'Índice da procedure. Abaixo de 100 remove 40 pts individuais.',
            },
            costCenter: { type: 'string' },
            cardNumber: { type: 'string' },
            unit: { type: 'string', enum: ['PEDERTRACTOR', 'TRACTOR'] },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    p5.simulateAbsenteeism,
  );

  app.post(
    '/dev/calculate-absenteeism',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary: 'Forçar cálculo de absenteísmo de um mês',
        description:
          'Consulta SP_PRJ_ABSENTEISMO e grava no ciclo do mês. Mês civil atual gera resultado parcial. Ciclo homologado ou bloqueado não é alterado.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['month', 'year'],
          properties: {
            month: {
              type: 'integer',
              minimum: 1,
              maximum: 12,
            },
            year: { type: 'integer', minimum: 2000, maximum: 2100 },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          502: errorResponseSchema,
        },
      },
    },
    p5.forceCalculateAbsenteeism,
  );

  app.get(
    '/employees',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary:
          'Listar colaboradores ativos com setor (para simulação e ferramentas admin)',
        security: [{ bearerAuth: [] }],
        response: {
          200: { type: 'object', additionalProperties: true },
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    p5.listActiveEmployees,
  );

  app.post(
    '/employees/sync',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary:
          'Sincronizar setores (/sector/list) e colaboradores (/employee/get), relacionando pelo sector id',
        security: [{ bearerAuth: [] }],
        response: {
          200: { type: 'object', additionalProperties: true },
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    p5.syncEmployees,
  );

  app.post(
    '/employees/purge',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary:
          'Apagar colaboradores e setores P5 (e dependências). Não remove contas User.',
        security: [{ bearerAuth: [] }],
        response: {
          200: { type: 'object', additionalProperties: true },
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    p5.purgeEmployeesAndSectors,
  );

  app.get(
    '/absenteeism',
    {
      ...absenteeismReader,
      schema: {
        tags: ['p5'],
        summary: 'Consultar absenteísmo no Firebird',
        description:
          'Consulta SP_PRJ_ABSENTEISMO no Firebird. Informe month (1–12) e year. Exige ADMIN ou responsável pelo pilar Absenteísmo.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['month', 'year'],
          properties: {
            month: {
              type: 'string',
              description: 'Mês de 1 a 12 (ex.: 07)',
            },
            year: {
              type: 'string',
              description: 'Ano (ex.: 2026)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              month: { type: 'string' },
              year: { type: 'string' },
              count: { type: 'integer' },
              records: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    company: { type: 'string' },
                    cardNumber: { type: 'number' },
                    name: { type: 'string' },
                    situation: { type: 'string' },
                    referenceDate: { type: 'string', nullable: true },
                    absenteeism: { type: 'number' },
                  },
                },
              },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    p5.listAbsenteeism,
  );

  app.get(
    '/cycles/:cycleId/absenteeism/results',
    {
      ...absenteeismReader,
      schema: {
        tags: ['p5'],
        summary: 'Resultados de Absenteísmo do ciclo (parcial ou fechado)',
        description:
          'Média P5 do pilar (máx. 10). Exige ADMIN ou responsável pelo pilar Absenteísmo. IDs inventados retornam 404.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['cycleId'],
          properties: {
            cycleId: { type: 'string', format: 'uuid' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              description:
                'Quando informado, pagina setores (ordenado por P5 ascendente)',
            },
            pageSize: {
              type: 'integer',
              minimum: 1,
              maximum: 10,
              default: 10,
              description: 'Itens por página (máx. 10)',
            },
            costCenter: {
              type: 'string',
              description: 'Filtro parcial por centro de custo',
            },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    p5.getAbsenteeismResults,
  );

  app.get(
    '/cycles/:cycleId/absenteeism/sectors/:sectorId',
    {
      ...absenteeismReader,
      schema: {
        tags: ['p5'],
        summary: 'Detalhe de Absenteísmo dos colaboradores do setor',
        description:
          'Exige ADMIN ou responsável pelo pilar Absenteísmo. IDs inventados retornam 404.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['cycleId', 'sectorId'],
          properties: {
            cycleId: { type: 'string', format: 'uuid' },
            sectorId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    p5.getAbsenteeismSectorDetail,
  );

  app.get(
    '/cycles/:cycleId/absenteeism/participants/:participantId',
    {
      ...absenteeismReader,
      schema: {
        tags: ['p5'],
        summary: 'Detalhe de Absenteísmo do participante',
        description:
          'Exige ADMIN ou responsável pelo pilar Absenteísmo. IDs inventados retornam 404.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['cycleId', 'participantId'],
          properties: {
            cycleId: { type: 'string', format: 'uuid' },
            participantId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    p5.getAbsenteeismParticipantDetail,
  );

  app.get(
    '/program-years',
    {
      ...p5Reader,
      schema: {
        tags: ['p5'],
        summary: 'Listar programas anuais',
        security: [{ bearerAuth: [] }],
        response: {
          200: { type: 'object', additionalProperties: true },
        },
      },
    },
    p5.listProgramYears,
  );

  app.post(
    '/program-years',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary: 'Criar programa anual',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['year', 'name', 'startsAt', 'endsAt'],
          properties: {
            year: { type: 'integer' },
            name: { type: 'string' },
            startsAt: { type: 'string' },
            endsAt: { type: 'string' },
            active: { type: 'boolean' },
          },
        },
        response: {
          201: { type: 'object', additionalProperties: true },
        },
      },
    },
    p5.createProgramYear,
  );

  app.get(
    '/program-years/:id',
    {
      ...p5Reader,
      schema: {
        tags: ['p5'],
        summary: 'Detalhe do programa anual',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
        },
      },
    },
    p5.getProgramYear,
  );

  app.get(
    '/program-years/:programYearId/overview',
    {
      ...p5Reader,
      schema: {
        tags: ['p5'],
        summary:
          'Visão geral do programa: junção dos ciclos mensais com pontuação acumulada',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['programYearId'],
          properties: { programYearId: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
        },
      },
    },
    p5.getProgramYearOverview,
  );

  app.get(
    '/program-years/:programYearId/pillars',
    {
      ...p5Reader,
      schema: {
        tags: ['p5'],
        summary: 'Listar pilares do programa',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['programYearId'],
          properties: { programYearId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    p5.listPillars,
  );

  app.get(
    '/program-years/:programYearId/scoring-rules',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary:
          'Obter regras de pontuação do programa (template ou snapshot do ciclo editável)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['programYearId'],
          properties: { programYearId: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    p5.getProgramYearScoringRules,
  );

  app.put(
    '/program-years/:programYearId/scoring-rules',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary:
          'Atualizar regras de pontuação do programa e do ciclo editável',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['programYearId'],
          properties: { programYearId: { type: 'string', format: 'uuid' } },
        },
        body: { type: 'object', additionalProperties: true },
        response: {
          200: { type: 'object', additionalProperties: true },
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    p5.updateProgramYearScoringRules,
  );

  app.get(
    '/pillars/:pillarId/indicators',
    {
      ...p5Reader,
      schema: {
        tags: ['p5'],
        summary: 'Listar indicadores do pilar',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['pillarId'],
          properties: { pillarId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    p5.listIndicators,
  );

  app.patch(
    '/indicators/:indicatorId',
    {
      ...p5Reader,
      schema: {
        tags: ['p5'],
        summary: 'Atualizar indicador',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['indicatorId'],
          properties: { indicatorId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    p5.updateIndicator,
  );

  app.get(
    '/cycles',
    {
      ...p5Reader,
      schema: {
        tags: ['p5'],
        summary: 'Listar ciclos mensais',
        security: [{ bearerAuth: [] }],
      },
    },
    p5.listCycles,
  );

  app.post(
    '/cycles',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary:
          'Gerar automaticamente os 12 ciclos mensais do programa (100 pts/mês, 1200/ano)',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['programYearId'],
          properties: {
            programYearId: { type: 'string', format: 'uuid' },
            month: {
              type: 'integer',
              minimum: 1,
              maximum: 12,
              description: 'Opcional/legado: após gerar o ano, retorna este mês',
            },
            year: { type: 'integer' },
          },
        },
      },
    },
    p5.createCycle,
  );

  app.post(
    '/program-years/:programYearId/cycles/ensure',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary:
          'Garante jan–dez do programa (idempotente). Cada mês = 100 pts base por colaborador',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['programYearId'],
          properties: { programYearId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    p5.ensureYearCycles,
  );

  app.get(
    '/cycles/:cycleId',
    {
      ...p5Reader,
      schema: {
        tags: ['p5'],
        summary: 'Detalhe do ciclo',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['cycleId'],
          properties: { cycleId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    p5.getCycle,
  );

  app.get(
    '/cycles/:cycleId/scoring-rules',
    {
      ...p5Reader,
      schema: {
        tags: ['p5'],
        summary:
          'Regras de pontuação do ciclo (somente leitura; pilares escopados para RESPONSIBLE)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['cycleId'],
          properties: { cycleId: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    p5.getCycleScoringRules,
  );

  app.post(
    '/cycles/:cycleId/open',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary:
          'Abrir ciclo (Rascunho → Aberto): sync setores/colaboradores na API base e monta participantes. Qualquer mês em rascunho pode ser aberto (não precisa seguir a ordem do calendário). Exige que não haja ciclo Aberto/Calculado — revise o anterior antes',
        security: [{ bearerAuth: [] }],
      },
    },
    p5.openCycle,
  );

  app.post(
    '/cycles/:cycleId/calculate',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary: 'Calcular ciclo (Segurança) e marcar como Calculado',
        security: [{ bearerAuth: [] }],
      },
    },
    p5.calculateCycle,
  );

  app.post(
    '/cycles/:cycleId/submit-review',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary: 'Enviar ciclo para revisão',
        security: [{ bearerAuth: [] }],
      },
    },
    p5.submitCycleReview,
  );

  app.post(
    '/cycles/:cycleId/homologate',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary:
          'Homologar e bloquear ciclo (ADMIN) — ação irreversível',
        security: [{ bearerAuth: [] }],
      },
    },
    p5.homologateCycle,
  );

  app.post(
    '/cycles/:cycleId/lock',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary:
          'Bloquear ciclo legado em Homologado (ADMIN) — preferir homologate',
        security: [{ bearerAuth: [] }],
      },
    },
    p5.lockCycle,
  );

  app.get(
    '/cycles/:cycleId/participants',
    {
      ...p5Reader,
      schema: {
        tags: ['p5'],
        summary: 'Listar participantes do ciclo',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              description:
                'Quando informado, pagina participantes (ordenado por pontos ascendente)',
            },
            pageSize: {
              type: 'integer',
              minimum: 1,
              maximum: 10,
              default: 10,
              description: 'Itens por página (máx. 10)',
            },
            cardNumber: {
              type: 'string',
              description: 'Filtro parcial por número do cartão',
            },
            unit: {
              type: 'string',
              description: 'Filtro por unidade (ex.: PEDERTRACTOR)',
            },
          },
        },
      },
    },
    p5.listParticipants,
  );

  app.get(
    '/cycles/:cycleId/sectors',
    {
      ...p5Reader,
      schema: {
        tags: ['p5'],
        summary:
          'Listar setores do ciclo com média de pontos (soma / n colaboradores)',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              description:
                'Quando informado, pagina setores (ordenado por média ascendente)',
            },
            pageSize: {
              type: 'integer',
              minimum: 1,
              maximum: 10,
              default: 10,
              description: 'Itens por página (máx. 10)',
            },
            name: {
              type: 'string',
              description: 'Filtro parcial (case-insensitive) pelo nome do setor',
            },
            costCenter: {
              type: 'string',
              description:
                'Filtro parcial (case-insensitive) pelo centro de custo',
            },
          },
        },
      },
    },
    p5.listCycleSectors,
  );

  app.get(
    '/cycles/:cycleId/sectors/:sectorId',
    {
      ...p5Reader,
      schema: {
        tags: ['p5'],
        summary:
          'Colaboradores do setor no ciclo e pontuação de cada um',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['cycleId', 'sectorId'],
          properties: {
            cycleId: { type: 'string', format: 'uuid' },
            sectorId: { type: 'string', format: 'uuid' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: {
              type: 'integer',
              minimum: 1,
              maximum: 10,
              default: 10,
            },
          },
        },
      },
    },
    p5.getCycleSectorEmployees,
  );

  app.post(
    '/cycles/:cycleId/participants/sync',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary: 'Sincronizar participantes do ciclo',
        security: [{ bearerAuth: [] }],
      },
    },
    p5.syncParticipants,
  );

  app.get(
    '/cycles/:cycleId/audit',
    {
      ...p5Reader,
      schema: {
        tags: ['p5'],
        summary: 'Histórico de auditoria do ciclo',
        security: [{ bearerAuth: [] }],
      },
    },
    p5.listCycleAudit,
  );

  app.get(
    '/cycles/:cycleId/safety/history',
    {
      ...safetyReader,
      schema: {
        tags: ['p5'],
        summary: 'Histórico de alterações de acidentes do ciclo',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 10 },
            externalId: { type: 'string' },
            action: { type: 'string' },
          },
        },
      },
    },
    p5.listSafetyHistory,
  );

  app.get(
    '/cycles/:cycleId/safety/accidents',
    {
      ...safetyReader,
      schema: {
        tags: ['p5'],
        summary: 'Listar ocorrências de segurança do ciclo',
        security: [{ bearerAuth: [] }],
      },
    },
    p5.listSafetyAccidents,
  );

  app.post(
    '/cycles/:cycleId/safety/sync',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary: 'Sincronizar ocorrências via CIPA (requer config)',
        security: [{ bearerAuth: [] }],
      },
    },
    p5.syncSafetyFromCipa,
  );

  app.post(
    '/cycles/:cycleId/safety/import',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary: 'Importar payload normalizado de acidentes (dev/teste)',
        security: [{ bearerAuth: [] }],
      },
    },
    p5.importSafetyAccidents,
  );

  app.patch(
    '/safety/accidents/:accidentId/review',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary: 'Validar ou rejeitar ocorrência',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['VALIDATED', 'REJECTED'] },
            rejectionReason: { type: 'string', nullable: true },
          },
        },
      },
    },
    p5.reviewSafetyAccident,
  );

  app.get(
    '/cycles/:cycleId/safety/results',
    {
      ...safetyReader,
      schema: {
        tags: ['p5'],
        summary: 'Resultados de Segurança do ciclo (parciais)',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              description:
                'Quando informado, pagina setores (ordenado por P5 ascendente)',
            },
            pageSize: {
              type: 'integer',
              minimum: 1,
              maximum: 10,
              default: 10,
              description: 'Itens por página (máx. 10)',
            },
            costCenter: {
              type: 'string',
              description: 'Filtro parcial por centro de custo',
            },
          },
        },
      },
    },
    p5.getSafetyResults,
  );

  app.get(
    '/cycles/:cycleId/safety/sectors/:sectorId',
    {
      ...safetyReader,
      schema: {
        tags: ['p5'],
        summary: 'Detalhe de Segurança dos colaboradores do setor',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['cycleId', 'sectorId'],
          properties: {
            cycleId: { type: 'string', format: 'uuid' },
            sectorId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    p5.getSafetySectorDetail,
  );

  app.get(
    '/cycles/:cycleId/safety/participants/:participantId',
    {
      ...safetyReader,
      schema: {
        tags: ['p5'],
        summary: 'Detalhe de perda de pontos de Segurança do participante',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['cycleId', 'participantId'],
          properties: {
            cycleId: { type: 'string', format: 'uuid' },
            participantId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    p5.getSafetyParticipantDetail,
  );

  app.post(
    '/cycles/:cycleId/safety/calculate',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary: 'Recalcular apenas o pilar Segurança',
        security: [{ bearerAuth: [] }],
      },
    },
    p5.calculateSafety,
  );

  app.patch(
    '/cycles/:cycleId/safety/frequency-result',
    {
      ...adminOnly,
      schema: {
        tags: ['p5'],
        summary: 'Definir resultado manual de frequência por setor',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['sectorId', 'preservedInternalPoints'],
          properties: {
            sectorId: { type: 'string', format: 'uuid' },
            preservedInternalPoints: { type: 'number', minimum: 0, maximum: 20 },
          },
        },
      },
    },
    p5.setFrequencyResult,
  );
}
