import { env } from '../env/index.js';
import { HttpError } from '../https/errors/index.js';
import type { PedertractorOfProcess } from '../types/pedertractor-of-process.js';

export class ApiPedertractorOf {
  async getProcesses(ofNumber: string): Promise<PedertractorOfProcess[]> {
    const trimmed = ofNumber.trim();
    if (!trimmed) {
      throw new HttpError('Número da OF é obrigatório', 400);
    }

    const response = await fetch(
      `${env.API_PEDERTRACTOR_URL}/of/processes/${encodeURIComponent(trimmed)}`,
      {
        method: 'GET',
        headers: {
          nameApplication: env.APPNAME,
          key: env.APPKEY,
        },
      },
    );

    if (response.status !== 200) {
      throw new HttpError(
        `Não foi possível buscar os processos da OF na API corporativa. Status: ${response.status}`,
        response.status,
      );
    }

    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as PedertractorOfProcess[]) : [];
  }
}
