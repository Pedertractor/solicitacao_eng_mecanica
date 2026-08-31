import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../https/errors/index.js';

vi.mock('../config/firebird.js', () => ({
  queryDatabase: vi.fn(),
}));

import { queryDatabase } from '../config/firebird.js';
import { AbsenteeismService } from './absenteeism-service.js';

const queryDatabaseMock = vi.mocked(queryDatabase);

describe('AbsenteeismService', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('consulta SP_PRJ_ABSENTEISMO e mapeia o retorno', async () => {
    queryDatabaseMock.mockResolvedValue([
      {
        EMPRESA: 'PEDERTRACTOR',
        CRACHA: 17,
        NOME: 'FULANO',
        SITUACAO: 'Trabalhando',
        DT_REF: new Date('2026-07-01T03:00:00.000Z'),
        ABSENTEISMO: 103.31,
      },
    ]);

    const service = new AbsenteeismService();
    await expect(service.listByPeriod('07', '2026')).resolves.toEqual({
      month: '07',
      year: '2026',
      count: 1,
      records: [
        {
          company: 'PEDERTRACTOR',
          cardNumber: 17,
          name: 'FULANO',
          situation: 'Trabalhando',
          referenceDate: '2026-07-01T03:00:00.000Z',
          absenteeism: 103.31,
        },
      ],
    });
    expect(queryDatabaseMock).toHaveBeenCalledWith(
      'SELECT e.* FROM SP_PRJ_ABSENTEISMO(?, ?) e',
      ['07', '2026'],
    );
  });

  it('lança HttpError em português quando o Firebird falha', async () => {
    queryDatabaseMock.mockRejectedValue(new Error('permission denied'));

    const service = new AbsenteeismService();
    const error = service.listByPeriod('07', '2026');
    await expect(error).rejects.toBeInstanceOf(HttpError);
    await expect(error).rejects.toMatchObject({
      message: 'Não foi possível consultar o absenteísmo no Firebird.',
      statusCode: 502,
    });
  });
});
