import api from '@/utils/axiosConfig';

export type KairoLinkStatus =
  | { linked: false }
  | {
      linked: true;
      keyPrefix: string;
      linkedAt: string;
      lastValidatedAt: string | null;
    };

export interface KairoTeamOption {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface KairoTagOption {
  id: string;
  teamId: string;
  name: string;
  color: string;
}

const BASE = '/me/kairo';

export const kairoApi = {
  async getStatus(): Promise<KairoLinkStatus> {
    const { data } = await api.get<KairoLinkStatus>(BASE);
    return data;
  },

  async link(apiKey: string): Promise<KairoLinkStatus> {
    const { data } = await api.put<KairoLinkStatus>(BASE, { apiKey });
    return data;
  },

  async unlink(): Promise<KairoLinkStatus> {
    const { data } = await api.delete<KairoLinkStatus>(BASE);
    return data;
  },

  async listTeams(): Promise<KairoTeamOption[]> {
    const { data } = await api.get<{ teams: KairoTeamOption[] }>(
      `${BASE}/teams`,
    );
    return data.teams;
  },

  async listTags(teamId: string): Promise<KairoTagOption[]> {
    const { data } = await api.get<{ tags: KairoTagOption[] }>(
      `${BASE}/teams/${encodeURIComponent(teamId)}/tags`,
    );
    return data.tags;
  },
};
