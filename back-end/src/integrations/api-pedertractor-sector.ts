import { env } from '../env/index.js';
import { HttpError } from '../https/errors/index.js';
import type { ApiBaseSectorListResponse } from '../types/api-base-sector-list.js';

export class ApiPedertractorSector {
  async listSectors(): Promise<ApiBaseSectorListResponse> {
    const response = await fetch(`${env.API_PEDERTRACTOR_URL}/sector/list`, {
      method: 'GET',
      headers: {
        nameApplication: env.APPNAME,
        key: env.APPKEY,
      },
    });

    if (response.status !== 200) {
      throw new HttpError(
        `Não foi possível listar setores na API corporativa. Status: ${response.status}`,
        response.status,
      );
    }

    const data = await response.json();
    return Array.isArray(data) ? (data as ApiBaseSectorListResponse) : [];
  }
}
