import type { FastifyInstance } from 'fastify';
import {
  approveUser,
  changePasswordFirstLogin,
  getMe,
  getUserById,
  listUsers,
  login,
  register,
  rejectUser,
  resetUserPasswordByAdmin,
  signup,
  updateMyNotificationEmail,
  updateUserByAdmin,
  validateEmployee,
} from '../controllers/user-controller.js';
import { AREA_ADMIN_ROLES } from '../../auth/access-policy.js';
import { authMiddleware } from '../../middlewares/auth-middleware.js';
import { roleMiddleware } from '../../middlewares/auth-role-middleware.js';

const unitEnum = ['PEDERTRACTOR', 'TRACTOR'] as const;
const userRoleEnum = [
  'SUPER_ADMIN',
  'ADMIN',
  'USER',
  'COMERCIAL',
] as const;
const departmentEnum = [
  'ENG_MECANICA',
  'DESENVOLVIMENTO_PROCESSOS',
  'FERRAMENTARIA',
  'AMOSTRA',
] as const;
const approvalStatusEnum = ['PENDING', 'APPROVED', 'REJECTED'] as const;

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid', description: 'ID do usuário' },
    cardNumber: { type: 'string', description: 'Número do cartão' },
    unit: { type: 'string', enum: unitEnum, description: 'Unidade' },
    name: { type: 'string', description: 'Nome do usuário' },
    role: {
      type: 'string',
      enum: userRoleEnum,
      description: 'Papel do usuário',
    },
    department: {
      anyOf: [
        { type: 'string', enum: departmentEnum },
        { type: 'null' },
      ],
      description: 'Departamento (null para SUPER_ADMIN)',
    },
    approvalStatus: {
      type: 'string',
      enum: approvalStatusEnum,
      description: 'Situação da aprovação do cadastro',
    },
    mustChangePassword: {
      type: 'boolean',
      description: 'Se o usuário precisa trocar a senha no próximo login',
    },
    notificationEmail: {
      type: ['string', 'null'],
      description: 'E-mail para notificações de novas solicitações',
    },
    active: {
      type: 'boolean',
      description: 'Usuário ativo no sistema',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'Data de criação do registro',
    },
  },
} as const;

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string', description: 'Mensagem de erro' },
  },
} as const;

export async function userRoutes(app: FastifyInstance) {
  app.post(
    '/login',
    {
      schema: {
        tags: ['users'],
        summary: 'Login',
        description:
          'Autentica o usuário com cartão, unidade e senha. Retorna o token JWT.',
        body: {
          type: 'object',
          required: ['unit', 'cardNumber', 'password'],
          properties: {
            unit: { type: 'string', enum: unitEnum, description: 'Unidade' },
            cardNumber: { type: 'string', description: 'Número do cartão' },
            password: { type: 'string', minLength: 1, description: 'Senha' },
          },
        },
        response: {
          200: {
            description: 'Login realizado com sucesso',
            type: 'object',
            properties: {
              user: userSchema,
              token: {
                type: 'string',
                description: 'Token JWT para autorização',
              },
            },
          },
          400: {
            description: 'Dados inválidos',
            ...errorResponseSchema,
          },
        },
      },
    },
    login,
  );

  app.post(
    '/signup/validate',
    {
      schema: {
        tags: ['users'],
        summary: 'Validar colaborador no cadastro público',
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
              name: { type: 'string' },
              status: { type: 'boolean' },
            },
          },
          400: errorResponseSchema,
        },
      },
    },
    validateEmployee,
  );

  app.post(
    '/signup',
    {
      schema: {
        tags: ['users'],
        summary: 'Cadastro público aguardando aprovação',
        body: {
          type: 'object',
          required: [
            'unit',
            'cardNumber',
            'password',
            'confirmPassword',
            'department',
          ],
          properties: {
            unit: { type: 'string', enum: unitEnum },
            cardNumber: { type: 'string', minLength: 1 },
            password: { type: 'string', minLength: 6 },
            confirmPassword: { type: 'string', minLength: 6 },
            department: { type: 'string', enum: departmentEnum },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
          400: errorResponseSchema,
        },
      },
    },
    signup,
  );

  app.post(
    '/register',
    {
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
      schema: {
        tags: ['users'],
        summary: 'Registrar usuário',
        description: 'Cria um novo usuário no sistema.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['unit', 'cardNumber', 'role'],
          properties: {
            unit: { type: 'string', enum: unitEnum, description: 'Unidade' },
            cardNumber: {
              type: 'string',
              minLength: 1,
              description: 'Número do cartão',
            },
            active: {
              type: 'boolean',
              default: true,
              description: 'Se o usuário está ativo',
            },
            role: {
              type: 'string',
              enum: userRoleEnum,
              description: 'Papel do usuário',
            },
            department: {
              type: 'string',
              enum: departmentEnum,
              description:
                'Obrigatório para USER/ADMIN/COMERCIAL. Omitir para SUPER_ADMIN.',
            },
          },
        },
        response: {
          201: {
            description: 'Usuário criado com sucesso',
            type: 'object',
            properties: {
              user: userSchema,
            },
          },
          400: {
            description: 'Dados inválidos',
            ...errorResponseSchema,
          },
        },
      },
    },
    register,
  );

  app.get(
    '/me',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['users'],
        summary: 'Usuário autenticado',
        description: 'Retorna os dados do usuário logado (requer token JWT).',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: 'Dados do usuário autenticado',
            type: 'object',
            properties: {
              user: userSchema,
            },
          },
          401: {
            description: 'Não autorizado',
            ...errorResponseSchema,
          },
        },
      },
    },
    getMe,
  );

  app.put(
    '/me/change-password',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['users'],
        summary: 'Trocar senha (primeiro login)',
        description:
          'Define nova senha quando mustChangePassword está ativo. Requer token JWT.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['newPassword'],
          properties: {
            newPassword: {
              type: 'string',
              minLength: 6,
              description: 'Nova senha (mínimo 6 caracteres)',
            },
          },
        },
        response: {
          200: {
            description: 'Senha alterada com sucesso',
            type: 'object',
            properties: {
              user: userSchema,
            },
          },
          400: {
            description: 'Dados inválidos ou troca não permitida',
            ...errorResponseSchema,
          },
          401: {
            description: 'Não autorizado',
            ...errorResponseSchema,
          },
        },
      },
    },
    changePasswordFirstLogin,
  );

  app.put(
    '/me/notification-email',
    {
      preHandler: [authMiddleware],
      schema: {
        tags: ['users'],
        summary: 'Atualizar e-mail de notificação',
        description:
          'Define ou remove o e-mail usado para avisar sobre novas solicitações da área. Requer token JWT.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: ['string', 'null'],
              description:
                'E-mail de notificação. Null ou string vazia remove o endereço.',
            },
          },
        },
        response: {
          200: {
            description: 'E-mail de notificação atualizado',
            type: 'object',
            properties: {
              user: userSchema,
            },
          },
          400: {
            description: 'Dados inválidos',
            ...errorResponseSchema,
          },
          401: {
            description: 'Não autorizado',
            ...errorResponseSchema,
          },
        },
      },
    },
    updateMyNotificationEmail,
  );

  app.get(
    '/',
    {
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
      schema: {
        tags: ['users'],
        summary: 'Listar usuários',
        description: 'Lista todos os usuários do sistema.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: 'Lista de usuários',
            type: 'object',
            properties: {
              users: {
                type: 'array',
                items: userSchema,
              },
            },
          },
          401: {
            description: 'Não autorizado',
            ...errorResponseSchema,
          },
        },
      },
    },
    listUsers,
  );

  app.post(
    '/validate-employee',
    {
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
      schema: {
        tags: ['users'],
        summary: 'Validar colaborador',
        description:
          'Consulta a API corporativa e verifica se o cartão/unidade podem ser cadastrados.',
        security: [{ bearerAuth: [] }],
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
            description: 'Colaborador válido',
            type: 'object',
            properties: {
              name: { type: 'string' },
              status: { type: 'boolean' },
            },
          },
          400: {
            description: 'Colaborador inválido ou já cadastrado',
            ...errorResponseSchema,
          },
        },
      },
    },
    validateEmployee,
  );

  app.get(
    '/:userId',
    {
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
      schema: {
        tags: ['users'],
        summary: 'Buscar usuário por ID',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Usuário encontrado',
            type: 'object',
            properties: {
              user: userSchema,
            },
          },
          404: {
            description: 'Usuário não encontrado',
            ...errorResponseSchema,
          },
        },
      },
    },
    getUserById,
  );

  app.patch(
    '/:userId',
    {
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
      schema: {
        tags: ['users'],
        summary: 'Atualizar papel do usuário',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['role'],
          properties: {
            role: { type: 'string', enum: userRoleEnum },
            department: { type: 'string', enum: departmentEnum },
          },
        },
        response: {
          200: {
            description: 'Usuário atualizado',
            type: 'object',
            properties: {
              user: userSchema,
            },
          },
          400: {
            description: 'Dados inválidos',
            ...errorResponseSchema,
          },
        },
      },
    },
    updateUserByAdmin,
  );

  app.post(
    '/:userId/reset-password',
    {
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
      schema: {
        tags: ['users'],
        summary: 'Resetar senha do usuário',
        description:
          'Redefine a senha para o número do cartão e marca mustChangePassword.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Senha redefinida',
            type: 'object',
            properties: {
              user: userSchema,
            },
          },
          400: {
            description: 'Operação não permitida',
            ...errorResponseSchema,
          },
        },
      },
    },
    resetUserPasswordByAdmin,
  );

  app.post(
    '/:userId/approve',
    {
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
      schema: {
        tags: ['users'],
        summary: 'Aprovar cadastro pendente',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { user: userSchema },
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    approveUser,
  );

  app.post(
    '/:userId/reject',
    {
      preHandler: [authMiddleware, roleMiddleware(AREA_ADMIN_ROLES)],
      schema: {
        tags: ['users'],
        summary: 'Recusar cadastro pendente',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { user: userSchema },
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    rejectUser,
  );
}
