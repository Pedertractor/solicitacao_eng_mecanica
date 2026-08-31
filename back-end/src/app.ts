import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { join } from 'node:path';
import {
  MAX_MULTIPART_BODY_BYTES,
  MAX_RECEIPT_FILE_BYTES,
} from './constants/receipt-upload-limits.js';
import { env } from './env/index.js';
import { apiErrorHandler } from './https/errors/error-handler.js';
import { mainRoutes } from './https/routes/main-route.js';
import { healthRoutes } from './https/routes/health-route.js';

export const app = Fastify({
  bodyLimit: MAX_MULTIPART_BODY_BYTES,
});

app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

//preciso posteriormente dividir em outro arquivo essas configurações
app.register(jwt, {
  secret: env.JWT_SECRET,
  sign: {
    expiresIn: env.JWT_EXPIRES_IN,
  },
});

app.register(multipart, {
  limits: {
    fileSize: MAX_RECEIPT_FILE_BYTES,
  },
});

app.register(fastifyStatic, {
  root: join(process.cwd(), 'uploads'),
  prefix: '/uploads/',
});

// Swagger/OpenAPI deve ser registrado ANTES das rotas para descobri-las (https://github.com/fastify/fastify-swagger)
app.register(swagger, {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'Project P5 API',
      description: 'API do Project P5 — autenticação, usuários e Programa P5',
      version: '1.0.0',
    },
    servers: [
      { url: `http://${env.HOST}:${env.PORT}/api`, description: 'API' },
    ],
    tags: [
      { name: 'health', description: 'Health check' },
      { name: 'users', description: 'Autenticação e gestão de usuários' },
      { name: 'p5', description: 'Programa P5 — ciclos, segurança e configurações' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtido no login',
        },
      },
    },
  },
});

app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
  },
});

app.register(healthRoutes);
app.register(mainRoutes, { prefix: '/api' });

app.setErrorHandler(apiErrorHandler);
