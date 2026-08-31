import type {
  AccidentStatus,
  AccidentType,
  CycleStatus,
} from '@/services/p5';

export const CYCLE_STATUS_LABELS: Record<CycleStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberto',
  CALCULATED: 'Calculado',
  UNDER_REVIEW: 'Em revisão',
  HOMOLOGATED: 'Homologado',
  LOCKED: 'Bloqueado',
};

export const ACCIDENT_STATUS_LABELS: Record<AccidentStatus, string> = {
  IMPORTED: 'Importado',
  PENDING_REVIEW: 'Pendente',
  VALIDATED: 'Validado',
  REJECTED: 'Rejeitado',
  CANCELLED: 'Cancelado',
};

export const ACCIDENT_TYPE_LABELS: Record<AccidentType, string> = {
  WITH_LEAVE: 'Com afastamento',
  WITHOUT_LEAVE: 'Sem afastamento',
  FREQUENCY: 'Reincidência',
};

export const RESULT_STATUS_LABELS = {
  PROVISIONAL: 'Provisório',
  VALIDATED: 'Validado',
  HOMOLOGATED: 'Homologado',
} as const;

export const INDICATOR_SCOPE_LABELS = {
  INDIVIDUAL: 'Individual',
  SECTOR: 'Setor',
  COMPANY: 'Empresa',
} as const;

export const CALCULATION_TYPE_LABELS = {
  ZERO_OCCURRENCE: 'Sem ocorrência',
  THRESHOLD: 'Limiar',
  FORMULA: 'Fórmula',
  MANUAL: 'Manual',
} as const;

export const SOURCE_SYSTEM_LABELS = {
  CIPA: 'CIPA',
  MANUAL: 'Manual',
  PEDERTRACTOR: 'Pedertractor',
} as const;

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  PROGRAM_YEAR_CREATE: 'Ano do programa criado',
  INDICATOR_UPDATE: 'Indicador atualizado',
  CYCLES_ENSURE_YEAR: 'Ciclos do ano garantidos',
  PARTICIPANTS_SYNC: 'Participantes sincronizados',
  CYCLE_OPEN: 'Ciclo aberto',
  CYCLES_RESET_ALL: 'Ciclos reiniciados',
  CYCLE_CALCULATE: 'Ciclo calculado',
  CYCLE_SUBMIT_REVIEW: 'Enviado para revisão',
  CYCLE_HOMOLOGATE: 'Ciclo homologado',
  CYCLE_LOCK: 'Ciclo bloqueado',
  EMPLOYEES_SYNC: 'Colaboradores sincronizados',
  EMPLOYEES_SECTORS_PURGE: 'Setores de colaboradores limpos',
  SAFETY_CALCULATE: 'Segurança calculada',
  SAFETY_CIPA_SYNC: 'Sincronização CIPA',
  SAFETY_IMPORT: 'Importação de ocorrências',
  SAFETY_ACCIDENT_VALIDATE: 'Ocorrência validada',
  SAFETY_ACCIDENT_REJECT: 'Ocorrência rejeitada',
  CIPA_ACCIDENT_CREATE: 'Acidente criado',
  CIPA_ACCIDENT_UPDATE: 'Acidente atualizado',
  CIPA_ACCIDENT_RECLASSIFY_TO_ACT: 'Condição virou ato',
  CIPA_ACCIDENT_RECLASSIFY_TO_CONDITION: 'Ato virou condição',
  CIPA_ACCIDENT_CANCEL: 'Acidente cancelado',
  CIPA_ACCIDENT_RESTORE: 'Acidente restaurado',
  CIPA_ACCIDENT_CHANGE_REJECTED: 'Alteração rejeitada',
  ABSENTEEISM_CALCULATE: 'Absenteísmo calculado',
  ABSENTEEISM_SIMULATE: 'Absenteísmo simulado',
};

export const AUDIT_ENTITY_TYPE_LABELS: Record<string, string> = {
  ProgramYear: 'Ano do programa',
  IndicatorConfig: 'Indicador',
  MonthlyCycle: 'Ciclo mensal',
  CycleParticipant: 'Participante',
  SafetyAccident: 'Ocorrência de segurança',
  CipaAccidentMutation: 'Alteração CIPA',
  Employee: 'Colaborador',
};

export function cycleStatusLabel(status: string): string {
  return CYCLE_STATUS_LABELS[status as CycleStatus] ?? status;
}

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function auditEntityTypeLabel(entityType: string): string {
  return AUDIT_ENTITY_TYPE_LABELS[entityType] ?? entityType;
}

export function accidentStatusLabel(status: string): string {
  return ACCIDENT_STATUS_LABELS[status as AccidentStatus] ?? status;
}

export function accidentTypeLabel(type: string): string {
  return ACCIDENT_TYPE_LABELS[type as AccidentType] ?? type;
}

export function indicatorScopeLabel(scope: string): string {
  return (
    INDICATOR_SCOPE_LABELS[scope as keyof typeof INDICATOR_SCOPE_LABELS] ??
    scope
  );
}

export function calculationTypeLabel(type: string): string {
  return (
    CALCULATION_TYPE_LABELS[type as keyof typeof CALCULATION_TYPE_LABELS] ??
    type
  );
}

export function sourceSystemLabel(source: string): string {
  return (
    SOURCE_SYSTEM_LABELS[source as keyof typeof SOURCE_SYSTEM_LABELS] ?? source
  );
}
