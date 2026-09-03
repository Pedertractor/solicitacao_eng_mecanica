import { env } from '../env/index.js';
import { HttpError } from '../https/errors/index.js';
import type { $Enums } from '../generated/prisma/client.js';
import type { PedertractorEmployee } from '../types/pedertractor-employee.js';

export class ApiPedertractorEmployee {
  async getEmployee({
    cardNumber,
    unit,
  }: {
    cardNumber: string;
    unit: $Enums.Unit;
  }): Promise<PedertractorEmployee> {
    const response = await fetch(
      `${env.API_PEDERTRACTOR_URL}/employee/get/${cardNumber}/${unit}`,
      {
        method: 'GET',
        headers: {
          nameapplication: env.APPNAME,
          key: env.APPKEY,
        },
      },
    );

    if (response.status !== 200) {
      throw new HttpError(
        `Não foi possível buscar o colaborador na API corporativa. Status: ${response.status}`,
        response.status,
      );
    }

    const data = await response.json();
    return data as PedertractorEmployee;
  }
}
