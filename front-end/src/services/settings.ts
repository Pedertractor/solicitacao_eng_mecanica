import api from '@/utils/axiosConfig';

const BASE = '/settings';

export const settingsApi = {
  async getEmailCc(): Promise<string[]> {
    const { data } = await api.get<{ emails: string[] }>(`${BASE}/email-cc`);
    return data.emails;
  },

  async updateEmailCc(emails: string[]): Promise<string[]> {
    const { data } = await api.put<{ emails: string[] }>(`${BASE}/email-cc`, {
      emails,
    });
    return data.emails;
  },
};
