import { env } from '../env/index.js';
import { HttpError } from '../https/errors/index.js';
import type { PedertractorPart } from '../types/pedertractor-part.js';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function mapPart(data: unknown, fallbackPartNumber: string): PedertractorPart {
  const root = asRecord(data);
  const nested = root ? asRecord(root.part) ?? asRecord(root.data) : null;
  const record = nested ?? root;
  if (!record) {
    throw new HttpError('Resposta inválida da API de peças', 502);
  }

  const partNumber =
    readString(record, 'partNumber') ??
    readString(record, 'part_number') ??
    fallbackPartNumber;
  const status = record.status;
  if (status === false) {
    throw new HttpError('Part number inativo', 404);
  }

  return {
    partNumber,
    partCode: readString(record, 'partCode'),
    description: readString(record, 'description'),
    status: typeof status === 'boolean' ? status : null,
  };
}

export class ApiPedertractorPart {
  async getByPartNumber(partNumber: string): Promise<PedertractorPart> {
    const trimmed = partNumber.trim();
    if (!trimmed) {
      throw new HttpError('Part number é obrigatório', 400);
    }

    const response = await fetch(
      `${env.API_PEDERTRACTOR_URL}/part/number/${encodeURIComponent(trimmed)}`,
      {
        method: 'GET',
        headers: {
          nameApplication: env.APPNAME,
          key: env.APPKEY,
        },
      },
    );

    if (response.status === 404) {
      throw new HttpError('Part number não encontrado', 404);
    }

    if (response.status !== 200) {
      throw new HttpError(
        `Não foi possível buscar o part number na API corporativa. Status: ${response.status}`,
        response.status,
      );
    }

    const data: unknown = await response.json();
    return mapPart(data, trimmed);
  }
}
