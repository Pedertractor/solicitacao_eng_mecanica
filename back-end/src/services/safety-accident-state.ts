import { $Enums } from '../generated/prisma/client.js';

export type OccurrenceNature = 'ACT' | 'CONDITION';
export type PreviousNature = OccurrenceNature | null;

export type ExternalActorSnapshot = {
  externalId: string;
  name: string;
  identifier: string;
};

export type SafetyAccidentSnapshot = {
  id: string;
  externalId: string;
  sourceSystem: $Enums.SourceSystem;
  cycleId: string;
  cycleYear: number | null;
  cycleMonth: number | null;
  employeeId: string | null;
  employeeName: string | null;
  cardNumber: string | null;
  unit: string | null;
  sectorId: string;
  sectorName: string | null;
  costCenter: string | null;
  accidentType: $Enums.AccidentType;
  status: $Enums.AccidentStatus;
  occurredAt: string;
  daysAway: number | null;
  description: string | null;
  sourceChangedAt: string | null;
  cancelledAt: string | null;
};

export type SyncOperation =
  | 'CREATED'
  | 'UPDATED'
  | 'RECLASSIFIED_TO_ACT'
  | 'RECLASSIFIED_TO_CONDITION'
  | 'RESTORED'
  | 'CANCELLED'
  | 'IGNORED_CONDITION'
  | 'UNCHANGED';

export type ComparableAccidentState = {
  cycleId: string;
  employeeId: string | null;
  sectorId: string;
  accidentType: $Enums.AccidentType;
  status: $Enums.AccidentStatus;
  occurredAt: string;
  daysAway: number | null;
  description: string | null;
};

const SCOREABLE_TYPES = new Set<$Enums.AccidentType>([
  $Enums.AccidentType.WITH_LEAVE,
  $Enums.AccidentType.WITHOUT_LEAVE,
]);

export function isScoreableAccidentType(type: $Enums.AccidentType) {
  return SCOREABLE_TYPES.has(type);
}

export function isVisibleSafetyOccurrence(input: {
  status: $Enums.AccidentStatus;
}) {
  return input.status !== $Enums.AccidentStatus.CANCELLED;
}

export function isScoreableSafetyOccurrence(input: {
  status: $Enums.AccidentStatus;
  accidentType: $Enums.AccidentType;
}) {
  return (
    input.status === $Enums.AccidentStatus.VALIDATED &&
    isScoreableAccidentType(input.accidentType)
  );
}

export function isRealAccidentCount(input: {
  status: $Enums.AccidentStatus;
  accidentType: $Enums.AccidentType;
}) {
  return (
    isVisibleSafetyOccurrence(input) &&
    input.accidentType !== $Enums.AccidentType.FREQUENCY
  );
}

export function shouldIgnoreConditionEvent(input: {
  nature: OccurrenceNature;
  previousNature: PreviousNature;
}) {
  return (
    input.nature === 'CONDITION' &&
    (input.previousNature === null || input.previousNature === 'CONDITION')
  );
}

export function toComparableState(
  snapshot: SafetyAccidentSnapshot,
): ComparableAccidentState {
  return {
    cycleId: snapshot.cycleId,
    employeeId: snapshot.employeeId,
    sectorId: snapshot.sectorId,
    accidentType: snapshot.accidentType,
    status: snapshot.status,
    occurredAt: snapshot.occurredAt,
    daysAway: snapshot.daysAway,
    description: snapshot.description,
  };
}

const SAFETY_SCORE_FIELDS = new Set<keyof ComparableAccidentState>([
  'cycleId',
  'employeeId',
  'sectorId',
  'accidentType',
  'status',
  'occurredAt',
  'daysAway',
]);

export function safetyScoreFieldsChanged(changed: string[]): boolean {
  return changed.some((field) =>
    SAFETY_SCORE_FIELDS.has(field as keyof ComparableAccidentState),
  );
}

export function diffAccidentStates(
  before: ComparableAccidentState | null,
  after: ComparableAccidentState | null,
): string[] {
  if (!before || !after) return [];
  const fields: Array<keyof ComparableAccidentState> = [
    'cycleId',
    'employeeId',
    'sectorId',
    'accidentType',
    'status',
    'occurredAt',
    'daysAway',
    'description',
  ];
  return fields.filter((field) => before[field] !== after[field]);
}

export function classifyActOperation(input: {
  existing: SafetyAccidentSnapshot | null;
  next: ComparableAccidentState;
  previousNature: PreviousNature;
}): SyncOperation {
  if (!input.existing) {
    return input.previousNature === 'CONDITION'
      ? 'RECLASSIFIED_TO_ACT'
      : 'CREATED';
  }

  if (input.existing.status === $Enums.AccidentStatus.CANCELLED) {
    return 'RESTORED';
  }

  const before = toComparableState(input.existing);
  const changed = diffAccidentStates(before, input.next);
  if (changed.length === 0) {
    return 'UNCHANGED';
  }

  return 'UPDATED';
}

export function classifyConditionOperation(input: {
  existing: SafetyAccidentSnapshot | null;
  previousNature: PreviousNature;
}): SyncOperation {
  if (shouldIgnoreConditionEvent({
    nature: 'CONDITION',
    previousNature: input.previousNature,
  })) {
    return 'IGNORED_CONDITION';
  }

  if (!input.existing) {
    return 'IGNORED_CONDITION';
  }

  if (
    input.existing.status === $Enums.AccidentStatus.CANCELLED &&
    input.previousNature === 'ACT'
  ) {
    return 'UNCHANGED';
  }

  return 'RECLASSIFIED_TO_CONDITION';
}

export function compareSourceChangedAt(
  stored: Date | null | undefined,
  incoming: Date,
): 'APPLY' | 'UNCHANGED' | 'STALE' | 'CONFLICT' {
  if (!stored) return 'APPLY';
  const storedMs = stored.getTime();
  const incomingMs = incoming.getTime();
  if (incomingMs > storedMs) return 'APPLY';
  if (incomingMs < storedMs) return 'STALE';
  return 'UNCHANGED';
}

export function auditActionForOperation(operation: SyncOperation): string | null {
  switch (operation) {
    case 'CREATED':
      return 'CIPA_ACCIDENT_CREATE';
    case 'UPDATED':
      return 'CIPA_ACCIDENT_UPDATE';
    case 'RECLASSIFIED_TO_ACT':
      return 'CIPA_ACCIDENT_RECLASSIFY_TO_ACT';
    case 'RECLASSIFIED_TO_CONDITION':
      return 'CIPA_ACCIDENT_RECLASSIFY_TO_CONDITION';
    case 'RESTORED':
      return 'CIPA_ACCIDENT_RESTORE';
    case 'CANCELLED':
      return 'CIPA_ACCIDENT_CANCEL';
    default:
      return null;
  }
}

export const CIPA_ACCIDENT_AUDIT_ACTIONS = [
  'CIPA_ACCIDENT_CREATE',
  'CIPA_ACCIDENT_UPDATE',
  'CIPA_ACCIDENT_RECLASSIFY_TO_ACT',
  'CIPA_ACCIDENT_RECLASSIFY_TO_CONDITION',
  'CIPA_ACCIDENT_CANCEL',
  'CIPA_ACCIDENT_RESTORE',
  'CIPA_ACCIDENT_CHANGE_REJECTED',
] as const;

export function normalizeActor(actor: ExternalActorSnapshot): ExternalActorSnapshot {
  return {
    externalId: actor.externalId.trim(),
    name: actor.name.trim(),
    identifier: actor.identifier.trim(),
  };
}
