import type { FastifyInstance } from 'fastify';
import { userRoutes } from './user-route.js';
import { solicitationRoutes } from './solicitation-route.js';
import { kairoRoutes } from './kairo-route.js';
import { settingsRoutes } from './settings-route.js';
import { ofRoutes } from './of-route.js';

export async function mainRoutes(app: FastifyInstance) {
  app.register(userRoutes, { prefix: '/users' });
  app.register(solicitationRoutes, { prefix: '/solicitations' });
  app.register(kairoRoutes, { prefix: '/me/kairo' });
  app.register(settingsRoutes, { prefix: '/settings' });
  app.register(ofRoutes, { prefix: '/of' });
}
