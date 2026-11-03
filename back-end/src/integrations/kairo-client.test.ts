import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../env/index.js', () => ({ env: { KAIRO_API_URL: 'http://localhost:3000/api' } }));
import { KairoClient } from './kairo-client.js';

afterEach(() => vi.unstubAllGlobals());
describe('Kairo request bodies', () => {
  it.each(['cancelActivity', 'cancelProject', 'deleteActivity', 'deleteProject'] as const)(
    '%s sends no JSON content type when there is no body', async (method) => {
      const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ dados: {} }) });
      vi.stubGlobal('fetch', fetch);
      await new KairoClient('qa-key')[method]('team', 'card');
      const init = fetch.mock.calls[0]![1];
      expect(init.body).toBeUndefined();
      expect(init.headers).not.toHaveProperty('Content-Type');
      expect(init.headers.Authorization).toBe('Bearer qa-key');
    },
  );
  it('declares JSON for activity creation', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ dados: { activity: { id: 'card' } } }) });
    vi.stubGlobal('fetch', fetch);
    await new KairoClient('qa-key').createActivity('team', { title: 'QA' });
    expect(fetch.mock.calls[0]![1].headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ title: 'QA' });
  });
  it('reports a rejected Kairo key without expiring the Pederflow session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401, json: async () => ({ mensagem: 'Não autorizado' }),
    }));
    await expect(new KairoClient('revoked').listTeams()).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('chave de API do Kairo'),
    });
  });
});
