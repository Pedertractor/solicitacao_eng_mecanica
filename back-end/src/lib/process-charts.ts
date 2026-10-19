import { $Enums } from '../generated/prisma/client.js';

export type ChartPeriod = 'year' | 'month' | 'week';

export type ProcessChartBucket = {
  key: string;
  label: string;
  count: number;
};

export type ProcessChartSource = {
  client: $Enums.SolicitationClient | null;
  processInstructionType: string | null;
  requesterName: string;
};

const SAO_PAULO_OFFSET_MS = 3 * 60 * 60 * 1000;

const CLIENT_LABELS: Record<$Enums.SolicitationClient, string> = {
  CATERPILLAR: 'CATERPILLAR',
  CATERPILLAR_GERADORES: 'CATERPILLAR - GERADORES',
  CNH_CONTAGEM: 'CNH - CONTAGEM',
  CNH_CURITIBA: 'CNH - CURITIBA',
  CNH_PIRACICABA: 'CNH - PIRACICABA',
  CNH_SOROCABA: 'CNH - SOROCABA',
  CRUCIANELLI: 'CRUCIANELLI - PICCIN',
  DYNAPAC: 'DYNAPAC',
  HYUNDAI: 'HYUNDAI',
  IVECO: 'IVECO',
  JACTO: 'JACTO',
  JCB: 'JCB',
  JOHN_DEERE_CATALAO: 'JOHN DEERE - CATALÃO',
  JOHN_DEERE_HORIZONTINA: 'JOHN DEERE - HORIZONTINA',
  JOHN_DEERE_INDAIATUBA: 'JOHN DEERE - INDAIATUBA',
  MOTOCANA: 'MOTOCANA',
  PEDERTRACTOR: 'PEDERTRACTOR',
  PRAMAC: 'PRAMAC GERADORES',
  SILTOMAC: 'SILTOMAC',
  TRACTOR_COMPONENTS: 'TRACTOR COMPONENTS',
  TRIVELATO: 'TRIVELATO',
  VOLVO: 'VOLVO',
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  'Alteração Cliente': 'Alteração Cliente',
  'Alteração Interna': 'Alteração Interna',
  'Desenvolvimento Amostra': 'Desenv. De Amostras',
  'Desenvolvimento Protótipo': 'Desenv. De Protótipo',
  'Desenvolvimento de Gabarito': 'Desenv. Gabaritos',
  'Desenvolvimento Teste': 'Desenv. Teste',
};

const ACTIVITY_TYPE_ORDER = [
  'Alteração Cliente',
  'Alteração Interna',
  'Desenvolvimento Amostra',
  'Desenvolvimento Protótipo',
  'Desenvolvimento de Gabarito',
  'Desenvolvimento Teste',
];

export function periodRange(period: ChartPeriod, now = new Date()) {
  const local = new Date(now.getTime() - SAO_PAULO_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();

  let startUtcMidnight: Date;
  let endUtcMidnight: Date;

  if (period === 'year') {
    startUtcMidnight = new Date(Date.UTC(year, 0, 1));
    endUtcMidnight = new Date(Date.UTC(year + 1, 0, 1));
  } else if (period === 'month') {
    startUtcMidnight = new Date(Date.UTC(year, month, 1));
    endUtcMidnight = new Date(Date.UTC(year, month + 1, 1));
  } else {
    const mondayOffset = (local.getUTCDay() + 6) % 7;
    startUtcMidnight = new Date(Date.UTC(year, month, day - mondayOffset));
    endUtcMidnight = new Date(startUtcMidnight.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  return {
    start: new Date(startUtcMidnight.getTime() + SAO_PAULO_OFFSET_MS),
    end: new Date(endUtcMidnight.getTime() + SAO_PAULO_OFFSET_MS),
  };
}

export function toChartCase(value: string): string {
  return value
    .toLocaleLowerCase('pt-BR')
    .replace(
      /(^|[\s/-])(\p{L})/gu,
      (_match, separator: string, letter: string) =>
        separator + letter.toLocaleUpperCase('pt-BR'),
    );
}

export function shortPersonName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Sem responsável';
  if (parts.length === 1) return parts[0]!;
  const last = parts[parts.length - 1]!;
  return `${parts[0]} ${last[0]!.toLocaleUpperCase('pt-BR')}.`;
}

function compareBuckets(a: ProcessChartBucket, b: ProcessChartBucket) {
  if (b.count !== a.count) return b.count - a.count;
  return a.label.localeCompare(b.label, 'pt-BR');
}

function bucketsFrom(
  rows: ProcessChartSource[],
  keyOf: (row: ProcessChartSource) => { key: string; label: string },
): ProcessChartBucket[] {
  const counts = new Map<string, ProcessChartBucket>();

  for (const row of rows) {
    const { key, label } = keyOf(row);
    const current = counts.get(key);
    if (current) {
      current.count += 1;
      continue;
    }
    counts.set(key, { key, label, count: 1 });
  }

  return [...counts.values()].sort(compareBuckets);
}

export function buildProcessCharts(rows: ProcessChartSource[]) {
  const byActivityType = bucketsFrom(rows, (row) => {
    const type = row.processInstructionType?.trim() || '';
    if (!type) return { key: 'none', label: 'Sem tipo' };
    return {
      key: type,
      label: ACTIVITY_TYPE_LABELS[type] ?? type,
    };
  }).sort((a, b) => {
    const aOrder = ACTIVITY_TYPE_ORDER.indexOf(a.key);
    const bOrder = ACTIVITY_TYPE_ORDER.indexOf(b.key);
    if (aOrder !== -1 || bOrder !== -1) {
      if (aOrder === -1) return 1;
      if (bOrder === -1) return -1;
      return aOrder - bOrder;
    }
    return compareBuckets(a, b);
  });

  return {
    byClient: bucketsFrom(rows, (row) => {
      if (!row.client) return { key: 'none', label: 'Sem cliente' };
      return {
        key: row.client,
        label: toChartCase(CLIENT_LABELS[row.client]),
      };
    }),
    byActivityType,
    byResponsible: bucketsFrom(rows, (row) => {
      const label = shortPersonName(row.requesterName);
      return { key: label, label };
    }),
  };
}
