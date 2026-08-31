import { queryDatabase } from '../config/firebird.js';
import { HttpError } from '../https/errors/index.js';
import {
  mapAbsenteeismRow,
  type AbsenteeismListResponse,
  type FirebirdAbsenteeismRow,
} from '../types/absenteeism.js';

export class AbsenteeismService {
  async listByPeriod(
    month: string,
    year: string,
  ): Promise<AbsenteeismListResponse> {
    try {
      const rows = await queryDatabase<FirebirdAbsenteeismRow>(
        'SELECT e.* FROM SP_PRJ_ABSENTEISMO(?, ?) e',
        [month, year],
      );
      const records = rows.map(mapAbsenteeismRow);
      return {
        month,
        year,
        count: records.length,
        records,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      console.error('AbsenteeismService.listByPeriod:', error);
      throw new HttpError(
        'Não foi possível consultar o absenteísmo no Firebird.',
        502,
      );
    }
  }
}
