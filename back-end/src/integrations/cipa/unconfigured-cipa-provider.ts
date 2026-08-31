import { HttpError } from '../../https/errors/index.js';
import { env } from '../../env/index.js';
import type {
  CipaProvider,
  ListCipaAccidentsParams,
  NormalizedCipaAccident,
} from './cipa-provider.js';

/**
 * Provider usado enquanto não há documentação oficial da API CIPA.
 * Não inventa URL, auth nem payload — exige configuração real.
 */
export class UnconfiguredCipaProvider implements CipaProvider {
  async listAccidents(
    _params: ListCipaAccidentsParams,
  ): Promise<NormalizedCipaAccident[]> {
    throw this.notConfigured();
  }

  async getAccidentById(
    _externalId: string,
  ): Promise<NormalizedCipaAccident | null> {
    throw this.notConfigured();
  }

  private notConfigured(): HttpError {
    const hasUrl = Boolean(env.CIPA_API_URL?.trim());
    const hasKey = Boolean(env.CIPA_API_KEY?.trim());
    return new HttpError(
      hasUrl && hasKey
        ? 'Integração CIPA ainda não implementada: aguardando documentação oficial da API'
        : 'Integração CIPA não configurada. Defina CIPA_API_URL e CIPA_API_KEY quando a documentação oficial estiver disponível. Use POST /p5/cycles/:cycleId/safety/import para importar payload normalizado em desenvolvimento.',
      501,
    );
  }
}

export function createCipaProvider(): CipaProvider {
  return new UnconfiguredCipaProvider();
}
