export const PILLAR_CODES = [
  'SAFETY',
  'PRODUCTIVITY',
  'QUALITY_5S',
  'ABSENTEEISM',
  'REVENUE',
] as const;

export type PillarCode = (typeof PILLAR_CODES)[number];

export const PILLAR_OPTIONS: ReadonlyArray<{
  value: PillarCode;
  label: string;
}> = [
  { value: 'SAFETY', label: 'Segurança' },
  { value: 'PRODUCTIVITY', label: 'Produtividade' },
  { value: 'QUALITY_5S', label: 'Qualidade 5S' },
  { value: 'ABSENTEEISM', label: 'Absenteísmo' },
  { value: 'REVENUE', label: 'Faturamento' },
];

export function pillarLabel(code: PillarCode): string {
  return PILLAR_OPTIONS.find((option) => option.value === code)?.label ?? code;
}
