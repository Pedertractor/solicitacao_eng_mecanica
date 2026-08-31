import { $Enums } from '../generated/prisma/client.js';
import type { ScopedPillarCodes } from './pillar-scope-service.js';

/** Eventos de ciclo/programa visíveis a qualquer responsável P5 autenticado. */
export const GLOBAL_CYCLE_AUDIT_ACTIONS = new Set<string>([
  'CYCLE_OPEN',
  'CYCLE_CALCULATE',
  'CYCLE_SUBMIT_REVIEW',
  'CYCLE_HOMOLOGATE',
  'CYCLE_LOCK',
  'PARTICIPANTS_SYNC',
  'CYCLES_ENSURE_YEAR',
  'CYCLES_RESET_ALL',
]);

export const GLOBAL_PROGRAM_AUDIT_ACTIONS = new Set<string>([
  'PROGRAM_YEAR_CREATE',
  'SCORING_RULES_UPDATE',
]);

const SAFETY_ENTITY_TYPES = new Set<string>([
  'SafetyAccident',
  'CipaAccidentMutation',
]);

const SAFETY_ACTION_PREFIX = 'SAFETY_';
const CIPA_ACTION_PREFIX = 'CIPA_';

export function resolveAuditPillarCode(input: {
  action: string;
  entityType: string;
  metadata?: unknown;
}): $Enums.PillarCode | null {
  if (input.metadata && typeof input.metadata === 'object' && input.metadata !== null) {
    const pillarCode = (input.metadata as { pillarCode?: unknown }).pillarCode;
    if (typeof pillarCode === 'string') {
      return pillarCode as $Enums.PillarCode;
    }
  }

  if (
    input.entityType === 'IndicatorConfig' ||
    input.action === 'INDICATOR_UPDATE'
  ) {
    if (input.metadata && typeof input.metadata === 'object' && input.metadata !== null) {
      const pillarCode = (input.metadata as { pillarCode?: unknown }).pillarCode;
      if (typeof pillarCode === 'string') {
        return pillarCode as $Enums.PillarCode;
      }
    }
    return null;
  }

  if (
    SAFETY_ENTITY_TYPES.has(input.entityType) ||
    input.action.startsWith(SAFETY_ACTION_PREFIX) ||
    input.action.startsWith(CIPA_ACTION_PREFIX)
  ) {
    return $Enums.PillarCode.SAFETY;
  }

  if (input.action.startsWith('ABSENTEEISM_')) {
    return $Enums.PillarCode.ABSENTEEISM;
  }

  if (
    GLOBAL_CYCLE_AUDIT_ACTIONS.has(input.action) ||
    GLOBAL_PROGRAM_AUDIT_ACTIONS.has(input.action) ||
    input.action === 'EMPLOYEES_SYNC' ||
    input.action === 'EMPLOYEES_SECTORS_PURGE'
  ) {
    return null;
  }

  return null;
}

export function isAuditLogVisible(
  log: {
    action: string;
    entityType: string;
    metadata?: unknown;
  },
  allowedPillarCodes: ScopedPillarCodes,
): boolean {
  if (allowedPillarCodes === null) return true;

  const pillarCode = resolveAuditPillarCode(log);
  if (pillarCode === null) {
    return (
      GLOBAL_CYCLE_AUDIT_ACTIONS.has(log.action) ||
      GLOBAL_PROGRAM_AUDIT_ACTIONS.has(log.action)
    );
  }

  return allowedPillarCodes.includes(pillarCode);
}
