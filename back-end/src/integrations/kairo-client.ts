import { env } from '../env/index.js';
import { HttpError } from '../https/errors/index.js';

type KairoSuccess<T> = {
  dados: T;
  mensagem?: string;
};

type KairoError = {
  mensagem?: string;
};

export type KairoUser = {
  id: string;
  name: string;
  unit: string;
  cardNumber: string;
};

export type KairoTeam = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

export type KairoTag = {
  id: string;
  teamId: string;
  name: string;
  color: string;
};

export type KairoCardStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'DONE'
  | 'CANCELED';

export type KairoActivity = {
  id: string;
  teamId: string;
  title: string;
  status?: KairoCardStatus;
  deletedAt?: string | null;
  deletedByName?: string | null;
  integrationSource?: string | null;
};

export type KairoProject = {
  id: string;
  teamId: string;
  title: string;
  status?: KairoCardStatus;
  deletedAt?: string | null;
  deletedByName?: string | null;
  integrationSource?: string | null;
};

export const KAIRO_INTEGRATION_SOURCE = 'solicitacao-eng-mecanica';

function requireBaseUrl(): string {
  const base = env.KAIRO_API_URL?.trim();
  if (!base) {
    throw new HttpError('KAIRO_API_URL não configurado', 500);
  }
  return base.replace(/\/$/, '');
}

async function kairoFetch<T>(
  path: string,
  apiKey: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${requireBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => null)) as
    | KairoSuccess<T>
    | KairoError
    | null;

  if (!response.ok) {
    const message =
      body && 'mensagem' in body && typeof body.mensagem === 'string'
        ? body.mensagem
        : `Falha ao comunicar com o Kairo (status ${response.status})`;
    throw new HttpError(message, response.status >= 500 ? 502 : response.status);
  }

  if (!body || !('dados' in body)) {
    throw new HttpError('Resposta inválida do Kairo', 502);
  }

  return body.dados;
}

export class KairoClient {
  constructor(private readonly apiKey: string) {}

  async getMe() {
    return kairoFetch<{ user: KairoUser }>('/integrations/v1/me', this.apiKey);
  }

  async listTeams() {
    return kairoFetch<{ teams: KairoTeam[] }>(
      '/integrations/v1/teams',
      this.apiKey,
    );
  }

  async listTags(teamId: string) {
    return kairoFetch<{ tags: KairoTag[] }>(
      `/integrations/v1/teams/${encodeURIComponent(teamId)}/tags`,
      this.apiKey,
    );
  }

  async getActivity(teamId: string, activityId: string) {
    return kairoFetch<{ activity: KairoActivity }>(
      `/integrations/v1/teams/${encodeURIComponent(teamId)}/activities/${encodeURIComponent(activityId)}`,
      this.apiKey,
    );
  }

  async getProject(teamId: string, projectId: string) {
    return kairoFetch<{ project: KairoProject }>(
      `/integrations/v1/teams/${encodeURIComponent(teamId)}/projects/${encodeURIComponent(projectId)}`,
      this.apiKey,
    );
  }

  async createActivity(
    teamId: string,
    input: {
      title: string;
      description?: string;
      tagId?: string;
      integrationSource?: string;
    },
  ) {
    return kairoFetch<{ activity: KairoActivity }>(
      `/integrations/v1/teams/${encodeURIComponent(teamId)}/activities`,
      this.apiKey,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  }

  async createProject(
    teamId: string,
    input: {
      title: string;
      description?: string;
      estimatedHours?: number;
      integrationSource?: string;
    },
  ) {
    return kairoFetch<{ project: KairoProject }>(
      `/integrations/v1/teams/${encodeURIComponent(teamId)}/projects`,
      this.apiKey,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  }

  async deleteActivity(teamId: string, activityId: string) {
    return kairoFetch<{ activity: KairoActivity }>(
      `/integrations/v1/teams/${encodeURIComponent(teamId)}/activities/${encodeURIComponent(activityId)}`,
      this.apiKey,
      { method: 'DELETE' },
    );
  }

  async deleteProject(teamId: string, projectId: string) {
    return kairoFetch<{ project: KairoProject }>(
      `/integrations/v1/teams/${encodeURIComponent(teamId)}/projects/${encodeURIComponent(projectId)}`,
      this.apiKey,
      { method: 'DELETE' },
    );
  }
}
