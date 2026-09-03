import '@fastify/jwt';
import type { $Enums } from '../generated/prisma/client.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      /** @deprecated Legacy tokens may include role; auth middleware always loads role from DB. */
      role?: $Enums.UserRole;
    };
    user: {
      sub: string;
      role: $Enums.UserRole;
    };
  }
}
