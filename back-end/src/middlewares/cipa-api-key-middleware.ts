import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../env/index.js';
import { HttpError } from '../https/errors/index.js';

function extractCipaApiKey(request: FastifyRequest): string | null {
  const headerKey = request.headers['x-cipa-api-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }

  const auth = request.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  return null;
}

export async function cipaApiKeyMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  const configured = env.CIPA_API_KEY?.trim();
  if (!configured) {
    throw new HttpError(
      'Integração CIPA não configurada. Defina CIPA_API_KEY no ambiente do P5.',
      503,
    );
  }

  const provided = extractCipaApiKey(request);
  if (!provided || provided !== configured) {
    throw new HttpError('API key CIPA inválida ou ausente', 401);
  }
}
