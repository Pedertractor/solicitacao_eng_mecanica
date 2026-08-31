import type { FastifyInstance } from 'fastify';
import { userRoutes } from './user-route.js';
import { employeeRoutes } from './employee-route.js';
import { p5Routes } from './p5-route.js';

export async function mainRoutes(app: FastifyInstance) {
  app.register(userRoutes, { prefix: '/users' });
  app.register(employeeRoutes, { prefix: '/employees' });
  app.register(p5Routes, { prefix: '/p5' });
}
