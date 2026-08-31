import { $Enums } from '../generated/prisma/client.js';

export const CYCLE_STATUS_LABELS: Record<$Enums.CycleStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberto',
  CALCULATED: 'Calculado',
  UNDER_REVIEW: 'Em revisão',
  HOMOLOGATED: 'Homologado',
  LOCKED: 'Bloqueado',
};

export const ACCIDENT_STATUS_LABELS: Record<$Enums.AccidentStatus, string> = {
  IMPORTED: 'Importado',
  PENDING_REVIEW: 'Pendente',
  VALIDATED: 'Validado',
  REJECTED: 'Rejeitado',
  CANCELLED: 'Cancelado',
};

export function cycleStatusLabel(status: $Enums.CycleStatus | string): string {
  return (
    CYCLE_STATUS_LABELS[status as $Enums.CycleStatus] ?? String(status)
  );
}

export function accidentStatusLabel(
  status: $Enums.AccidentStatus | string,
): string {
  return (
    ACCIDENT_STATUS_LABELS[status as $Enums.AccidentStatus] ?? String(status)
  );
}
