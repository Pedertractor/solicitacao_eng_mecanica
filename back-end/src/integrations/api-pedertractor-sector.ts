import { env } from '../env/index.js';
import { HttpError } from '../https/errors/index.js';
import type {
  ApiBaseSectorListResponse,
  ApiBaseSectorUnique,
} from '../types/api-base-sector-list.js';

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

  async getSectorByCostCenter(
    costCenter: string,
  ): Promise<ApiBaseSectorUnique> {
    const encoded = encodeURIComponent(costCenter.trim());
    const response = await fetch(
      `${env.API_PEDERTRACTOR_URL}/sector/unique/${encoded}`,
      {
        method: 'GET',
        headers: {
          nameApplication: env.APPNAME,
          key: env.APPKEY,
        },
      },
    );

    if (response.status === 404) {
      throw new HttpError('Centro de custo não encontrado', 404);
    }

    if (response.status !== 200) {
      throw new HttpError(
        `Não foi possível buscar o setor na API corporativa. Status: ${response.status}`,
        response.status,
      );
    }

    return (await response.json()) as ApiBaseSectorUnique;
  }
}
