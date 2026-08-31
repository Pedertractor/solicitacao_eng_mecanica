export type FirebirdAbsenteeismRow = {
  EMPRESA?: string | null;
  CRACHA?: number | string | null;
  NOME?: string | null;
  SITUACAO?: string | null;
  DT_REF?: Date | string | null;
  ABSENTEISMO?: number | string | null;
};

export type AbsenteeismRecord = {
  company: string;
  cardNumber: number;
  name: string;
  situation: string;
  referenceDate: string | null;
  absenteeism: number;
};

export type AbsenteeismListResponse = {
  month: string;
  year: string;
  count: number;
  records: AbsenteeismRecord[];
};

function toIsoDate(value: Date | string | null | undefined): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return null;
}

export function mapAbsenteeismRow(
  row: FirebirdAbsenteeismRow,
): AbsenteeismRecord {
  return {
    company: String(row.EMPRESA ?? '').trim(),
    cardNumber: Number(row.CRACHA),
    name: String(row.NOME ?? '').trim(),
    situation: String(row.SITUACAO ?? '').trim(),
    referenceDate: toIsoDate(row.DT_REF),
    absenteeism: Number(row.ABSENTEISMO),
  };
}
