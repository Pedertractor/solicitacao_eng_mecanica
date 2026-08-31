import api from '@/utils/axiosConfig';

const BASE = '/p5';

export type CycleStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'CALCULATED'
  | 'UNDER_REVIEW'
  | 'HOMOLOGATED'
  | 'LOCKED';

export type AccidentStatus =
  | 'IMPORTED'
  | 'PENDING_REVIEW'
  | 'VALIDATED'
  | 'REJECTED'
  | 'CANCELLED';

export type AccidentType = 'WITH_LEAVE' | 'WITHOUT_LEAVE' | 'FREQUENCY';

export interface ProgramYear {
  id: string;
  year: number;
  name: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  cyclesCount?: number;
  pillars?: Array<{
    id: string;
    code: string;
    name: string;
    maxPoints: number;
    active: boolean;
  }>;
}

export interface ProgramYearOverview {
  programYear: {
    id: string;
    year: number;
    name: string;
    active: boolean;
  };
  monthlyBasePoints: number;
  annualBasePoints: number;
  cyclesCount: number;
  cyclesExpected: number;
  statusCounts: Record<string, number>;
  scoredCyclesCount: number;
  annualFactoryScore: number;
  annualFactoryScoreMax: number;
  isPartial: boolean;
  pillars: Array<{
    code: string;
    name: string;
    maxPointsMonthly: number;
    maxPointsAnnual: number;
    averageMonthlyPoints: number | null;
    annualPoints: number | null;
    available: boolean;
  }>;
  cycles: Array<{
    id: string;
    month: number;
    year: number;
    status: CycleStatus;
  participantsCount: number;
  accidentsCount: number | null;
  openedAt: string | null;
  calculatedAt: string | null;
  safetyPoints: number | null;
  factoryScore: number | null;
    isPartial: boolean | null;
  }>;
}

export interface MonthlyCycle {
  id: string;
  programYearId: string;
  programName: string;
  programYear?: number;
  month: number;
  year: number;
  status: CycleStatus;
  basePointsPerEmployee?: number;
  annualBasePointsIfFullYear?: number;
  participantsCount: number;
  accidentsCount: number | null;
  openedAt: string | null;
  calculatedAt: string | null;
  recalculating?: boolean;
  submittedAt: string | null;
  homologatedAt: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyAccident {
  id: string;
  cycleId: string;
  sourceSystem: string;
  externalId: string;
  employeeId: string | null;
  employeeName: string | null;
  sectorId: string;
  sectorName: string;
  accidentType: AccidentType;
  occurredAt: string;
  daysAway: number | null;
  description: string | null;
  status: AccidentStatus;
  reviewedAt: string | null;
  reviewedByName: string | null;
  rejectionReason: string | null;
}

export interface SafetyResults {
  isPartial: boolean;
  calculatedPillars: string[];
  pendingPillars: string[];
  accidentCounts: {
    pending: number;
    validated: number;
    rejected: number;
    imported: number;
    cancelled: number;
  };
  /** Média interna do pilar Segurança na fábrica (0–100), calculada nos indivíduos. */
  factoryInternalAvg?: number | null;
  /** Média P5 do pilar Segurança na fábrica (0–20 = % do P5 mensal), calculada nos indivíduos. */
  factoryWeightedP5Avg?: number | null;
  recalculating?: boolean;
  sectors: Array<{
    sectorId: string;
    sectorName: string;
    costCenter: string | null;
    withLeave: number;
    withoutLeave: number;
    frequencyInternal: number;
    frequencyPending: boolean;
    internalTotal: number;
    weightedP5: number;
    participantsCount: number;
  }>;
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  indicatorResults: Array<{
    id: string;
    indicatorCode: string;
    indicatorName: string;
    sectorId: string | null;
    sectorName: string | null;
    preservedInternalPoints: number;
    weightedP5Points: number;
    calculationDetails: unknown;
    calculatedAt: string;
  }>;
}

export interface PillarWithIndicators {
  id: string;
  programYearId: string;
  code: string;
  name: string;
  maxPoints: number;
  active: boolean;
  indicators: Array<{
    id: string;
    code: string;
    name: string;
    scope: string;
    calculationType: string;
    maxInternalPoints: number;
    target: number | null;
    sourceSystem: string;
    ruleConfig: unknown;
    active: boolean;
  }>;
}

export interface SafetyEmployeeLossDetail {
  participantId: string;
  employeeId: string;
  cardNumber: string;
  name: string;
  withLeave: number;
  withoutLeave: number;
  internalScore: number | null;
  weightedP5: number | null;
  scoringRuleVersion?: 1 | 2;
  /** Legado 50/30/20 */
  isRecidivist?: boolean;
  withLeaveDeduction?: number;
  withoutLeaveDeduction?: number;
  frequencyDeduction?: number;
  rawInternal?: number;
  flooredAtZero?: boolean;
  /** V2 coletivo */
  factoryDeductionP5?: number;
  individualDeductionP5?: number;
  factoryBalanceP5?: number;
  factoryZeroed?: boolean;
  zeroedBy?: 'factory_threshold' | 'individual_threshold' | null;
  zeroBelowPercent?: number;
  floorP5?: number;
  withLeaveCount?: number;
  withoutLeaveCount?: number;
}

export type ScoringPillarCode =
  | 'SAFETY'
  | 'PRODUCTIVITY'
  | 'QUALITY_5S'
  | 'ABSENTEEISM'
  | 'REVENUE';

export type AccidentTypePenaltyConfig = {
  individualPenaltyP5: number;
  factoryDeductionP5: number;
};

export type ScoringConfigV2 = {
  version: 2;
  globalZeroBelowPercent: number;
  pillars: Record<ScoringPillarCode, { zeroBelowPercent: number | null }>;
  safety: {
    withLeave: AccidentTypePenaltyConfig;
    withoutLeave: AccidentTypePenaltyConfig;
  };
  absenteeism: AccidentTypePenaltyConfig;
};

export type ScoringConfigV1Legacy = {
  version: 1;
  legacy: true;
  rule: string;
  safety: {
    withLeaveInternalPenalty: number;
    withoutLeaveInternalPenalty: number;
    frequencyInternalPenalty: number;
    note: string;
  };
};

export type ScoringConfig = ScoringConfigV2 | ScoringConfigV1Legacy;

export type ProgramYearScoringRules = {
  config: ScoringConfig;
  editableCycle: {
    id: string;
    month: number;
    year: number;
    status: CycleStatus;
  } | null;
  source: 'cycle' | 'program';
};

export type CycleScoringRules = {
  cycleId: string;
  month: number;
  year: number;
  status: CycleStatus;
  config: ScoringConfig;
  readOnly: true;
};

export interface AbsenteeismScoreDetails {
  absenteeism: number | null;
  individualPreserved: number;
  individualDeducted: boolean;
  sectorPreserved: number;
  partial: boolean;
  warning: string | null;
  scoringRuleVersion?: 1 | 2;
  factoryOccurrenceCount?: number;
  factoryDeductionP5?: number;
  factoryBalanceP5?: number;
  individualDeductionP5?: number;
  factoryZeroed?: boolean;
  zeroedBy?: 'factory_threshold' | 'individual_threshold' | null;
  zeroBelowPercent?: number | null;
  floorP5?: number;
}

export interface AbsenteeismResults {
  cycleId: string;
  month: number;
  year: number;
  p5Max: number;
  scoredParticipants: number;
  penalizedCount: number;
  isPartial: boolean;
  factoryInternalAvg: number | null;
  factoryWeightedP5Avg: number | null;
  calculatedAt: string | null;
  recalculating: boolean;
  sectors?: AbsenteeismSectorSummary[];
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface AbsenteeismSectorSummary {
  sectorId: string;
  sectorName: string;
  costCenter: string | null;
  participantsCount: number;
  scoredCount: number;
  penalizedCount: number;
  internalAvg: number | null;
  weightedP5Avg: number | null;
  isPartial: boolean;
}

export interface AbsenteeismEmployeeDetail {
  participantId: string;
  employeeId: string;
  cardNumber: string;
  name: string;
  sectorId: string;
  sectorName: string;
  costCenter: string | null;
  absenteeism: number | null;
  individualPreserved: number;
  individualDeducted: boolean;
  sectorPreserved: number;
  internalScore: number | null;
  weightedP5: number | null;
  partial: boolean;
  warning: string | null;
  scoringRuleVersion?: 1 | 2;
  factoryOccurrenceCount?: number;
  factoryDeductionP5?: number;
  factoryBalanceP5?: number;
  individualDeductionP5?: number;
  factoryZeroed?: boolean;
  zeroedBy?: 'factory_threshold' | 'individual_threshold' | null;
  zeroBelowPercent?: number | null;
  floorP5?: number;
}

export interface CycleParticipant {
  id: string;
  cardNumber: string;
  employeeNameSnapshot: string;
  sectorNameSnapshot: string;
  unitSnapshot: string;
  activeInCycle: boolean;
  monthlyScore: {
    totalPoints: number;
    isPartial: boolean;
    calculatedPillars: unknown;
    pendingPillars: unknown;
  } | null;
  pillarScores: Array<{
    pillarCode: string;
    pillarName: string;
    internalScore: number;
    weightedPoints: number;
    absenteeism?: AbsenteeismScoreDetails | null;
  }>;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  metadata: unknown;
}

export interface SafetyAccidentHistoryItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  cycleId: string | null;
  before: unknown;
  after: unknown;
  metadata: {
    actor?: {
      externalId: string;
      name: string;
      identifier: string;
    };
    actorType?: string;
    externalId?: string;
    sourceChangedAt?: string;
    receivedAt?: string;
    previousNature?: string | null;
    nature?: string | null;
    changedFields?: string[];
    reason?: string | null;
  } | null;
  userId: string | null;
  userName: string | null;
  createdAt: string;
}

export interface P5EmployeeOption {
  id: string;
  name: string;
  cardNumber: string;
  unit: 'PEDERTRACTOR' | 'TRACTOR';
  costCenter: string;
  sectorName: string;
}

export interface SimulationAccident {
  id: string;
  externalId: string;
  employeeName: string | null;
  cardNumber: string | null;
  unit: 'PEDERTRACTOR' | 'TRACTOR' | null;
  sectorName: string;
  accidentType: AccidentType;
  daysAway: number | null;
  occurredAt: string;
  status: AccidentStatus;
  sourceSystem: string;
  simulated: boolean;
  canRemove: boolean;
}

export interface SimulationAccidentsResponse {
  cycle: {
    id: string;
    month: number;
    year: number;
    status: CycleStatus;
    label: string;
    statusLabel: string;
    editable: boolean;
  } | null;
  accidents: SimulationAccident[];
}

export const p5Api = {
  async listActiveEmployees() {
    const { data } = await api.get<{ employees: P5EmployeeOption[] }>(
      `${BASE}/employees`,
    );
    return data.employees;
  },

  async syncEmployees() {
    const { data } = await api.post<{ summary: unknown }>(
      `${BASE}/employees/sync`,
    );
    return data.summary;
  },

  async purgeEmployeesAndSectors() {
    const { data } = await api.post<{
      summary: {
        monthlyScores: number;
        pillarScores: number;
        participants: number;
        accidents: number;
        indicatorResults: number;
        employees: number;
        sectors: number;
      };
    }>(`${BASE}/employees/purge`);
    return data.summary;
  },

  async listProgramYears() {
    const { data } = await api.get<{ programYears: ProgramYear[] }>(
      `${BASE}/program-years`,
    );
    return data.programYears;
  },

  async getProgramYearScoringRules(programYearId: string) {
    const { data } = await api.get<ProgramYearScoringRules>(
      `${BASE}/program-years/${programYearId}/scoring-rules`,
    );
    return data;
  },

  async updateProgramYearScoringRules(
    programYearId: string,
    config: ScoringConfigV2,
  ) {
    const { data } = await api.put<ProgramYearScoringRules>(
      `${BASE}/program-years/${programYearId}/scoring-rules`,
      config,
    );
    return data;
  },

  async getCycleScoringRules(cycleId: string) {
    const { data } = await api.get<CycleScoringRules>(
      `${BASE}/cycles/${cycleId}/scoring-rules`,
    );
    return data;
  },

  async getProgramYearOverview(programYearId: string) {
    const { data } = await api.get<{ overview: ProgramYearOverview }>(
      `${BASE}/program-years/${programYearId}/overview`,
    );
    return data.overview;
  },

  async listCycles(params?: { programYearId?: string; year?: number }) {
    const { data } = await api.get<{ cycles: MonthlyCycle[] }>(
      `${BASE}/cycles`,
      { params },
    );
    return data.cycles;
  },

  async createCycle(payload: {
    programYearId: string;
    month?: number;
    year?: number;
  }) {
    const { data } = await api.post(
      `${BASE}/cycles`,
      payload,
    );
    return data;
  },

  async ensureYearCycles(programYearId: string) {
    const { data } = await api.post<{
      created: number;
      total: number;
      monthlyBasePoints: number;
      annualBasePoints: number;
      cycles: MonthlyCycle[];
    }>(`${BASE}/program-years/${programYearId}/cycles/ensure`);
    return data;
  },

  async getCycle(cycleId: string) {
    const { data } = await api.get<{ cycle: MonthlyCycle }>(
      `${BASE}/cycles/${cycleId}`,
    );
    return data.cycle;
  },

  async openCycle(cycleId: string) {
    const { data } = await api.post<{
      cycle: MonthlyCycle;
      sync: {
        employeeSync: {
          sectorsReceived: number;
          sectorsCreated: number;
          sectorsUpdated: number;
          received: number;
          created: number;
          updated: number;
          deactivated: number;
          ignored: number;
          unmatchedSector: number;
        } | null;
        participantsUpserted: number;
        participantsDeactivated: number;
      };
    }>(`${BASE}/cycles/${cycleId}/open`);
    return data;
  },

  async calculateCycle(cycleId: string) {
    const { data } = await api.post<{ cycle: MonthlyCycle }>(
      `${BASE}/cycles/${cycleId}/calculate`,
    );
    return data;
  },

  async submitReview(cycleId: string) {
    const { data } = await api.post<{ cycle: MonthlyCycle }>(
      `${BASE}/cycles/${cycleId}/submit-review`,
    );
    return data.cycle;
  },

  async homologate(cycleId: string) {
    const { data } = await api.post<{ cycle: MonthlyCycle }>(
      `${BASE}/cycles/${cycleId}/homologate`,
    );
    return data.cycle;
  },

  async lock(cycleId: string) {
    const { data } = await api.post<{ cycle: MonthlyCycle }>(
      `${BASE}/cycles/${cycleId}/lock`,
    );
    return data.cycle;
  },

  async listCycleSectors(
    cycleId: string,
    params?: {
      page?: number;
      pageSize?: number;
      name?: string;
      costCenter?: string;
    },
  ) {
    const { data } = await api.get<{
      cycle: {
        id: string;
        month: number;
        year: number;
        status: CycleStatus;
        programName: string;
      };
      monthlyBasePoints: number;
      factory: {
        employeesCount: number;
        totalPoints: number;
        averagePoints: number;
        sectorsCount: number;
      };
      sectors: Array<{
        sectorId: string;
        sectorName: string;
        costCenter: string | null;
        employeesCount: number;
        totalPoints: number;
        averagePoints: number;
        scoredCount: number;
        usingBasePointsCount: number;
        basePointsPerEmployee: number;
      }>;
      pagination?: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
      };
    }>(`${BASE}/cycles/${cycleId}/sectors`, { params });
    return data;
  },

  async getCycleSector(cycleId: string, sectorId: string) {
    const { data } = await api.get<{
      cycle: {
        id: string;
        month: number;
        year: number;
        status: CycleStatus;
        programName: string;
      };
      sector: {
        sectorId: string;
        sectorName: string;
        costCenter: string | null;
        employeesCount: number;
        totalPoints: number;
        averagePoints: number;
        basePointsPerEmployee: number;
      };
      employees: Array<{
        participantId: string;
        employeeId: string;
        name: string;
        costCenter: string | null;
        totalPoints: number;
        pointsSource: 'CALCULATED' | 'BASE';
        isPartial: boolean;
        pillarScores: Array<{
          pillarCode: string;
          pillarName: string;
          weightedPoints: number;
          absenteeism?: AbsenteeismScoreDetails | null;
        }>;
      }>;
    }>(`${BASE}/cycles/${cycleId}/sectors/${sectorId}`);
    return data;
  },

  async listParticipants(
    cycleId: string,
    params?: {
      page?: number;
      pageSize?: number;
      cardNumber?: string;
      unit?: string;
    },
  ) {
    const { data } = await api.get<{
      participants: CycleParticipant[];
      pagination?: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
      };
    }>(`${BASE}/cycles/${cycleId}/participants`, { params });
    return data;
  },

  async syncParticipants(cycleId: string, refreshFromApi = true) {
    const { data } = await api.post(
      `${BASE}/cycles/${cycleId}/participants/sync`,
      { refreshFromApi },
    );
    return data;
  },

  async listAudit(cycleId: string) {
    const { data } = await api.get<{ auditLogs: AuditLog[] }>(
      `${BASE}/cycles/${cycleId}/audit`,
    );
    return data.auditLogs;
  },

  async listSafetyHistory(
    cycleId: string,
    params?: {
      page?: number;
      pageSize?: number;
      externalId?: string;
      action?: string;
    },
  ) {
    const { data } = await api.get<{
      items: SafetyAccidentHistoryItem[];
      pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
      };
    }>(`${BASE}/cycles/${cycleId}/safety/history`, { params });
    return data;
  },

  async listAccidents(cycleId: string) {
    const { data } = await api.get<{ accidents: SafetyAccident[] }>(
      `${BASE}/cycles/${cycleId}/safety/accidents`,
    );
    return data.accidents;
  },

  async reviewAccident(
    accidentId: string,
    payload: { status: 'VALIDATED' | 'REJECTED'; rejectionReason?: string },
  ) {
    const { data } = await api.patch(
      `${BASE}/safety/accidents/${accidentId}/review`,
      payload,
    );
    return data;
  },

  async getSafetyResults(
    cycleId: string,
    params?: { page?: number; pageSize?: number; costCenter?: string },
  ) {
    const { data } = await api.get<{ results: SafetyResults }>(
      `${BASE}/cycles/${cycleId}/safety/results`,
      { params },
    );
    return data.results;
  },

  async getAbsenteeismResults(
    cycleId: string,
    params?: { page?: number; pageSize?: number; costCenter?: string },
  ) {
    const { data } = await api.get<{ results: AbsenteeismResults }>(
      `${BASE}/cycles/${cycleId}/absenteeism/results`,
      { params },
    );
    return {
      ...data.results,
      sectors: data.results.sectors ?? [],
    };
  },

  async getAbsenteeismSectorDetail(
    cycleId: string,
    sectorId: string,
    params?: { page?: number; pageSize?: number },
  ) {
    const { data } = await api.get<{
      cycle: {
        id: string;
        month: number;
        year: number;
        status: CycleStatus;
      };
      sector: AbsenteeismSectorSummary;
      employees: AbsenteeismEmployeeDetail[];
      pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
      };
    }>(`${BASE}/cycles/${cycleId}/absenteeism/sectors/${sectorId}`, {
      params,
    });
    return data;
  },

  async getAbsenteeismParticipantDetail(
    cycleId: string,
    participantId: string,
  ) {
    const { data } = await api.get<{
      cycle: {
        id: string;
        month: number;
        year: number;
        status: CycleStatus;
      };
      employee: AbsenteeismEmployeeDetail;
    }>(
      `${BASE}/cycles/${cycleId}/absenteeism/participants/${participantId}`,
    );
    return data;
  },

  async getSafetySectorDetail(
    cycleId: string,
    sectorId: string,
    params?: { page?: number; pageSize?: number },
  ) {
    const { data } = await api.get<{
      cycle: {
        id: string;
        month: number;
        year: number;
        status: CycleStatus;
      };
      sector: {
        sectorId: string;
        sectorName: string;
        costCenter: string | null;
        participantsCount: number;
        withLeave: number;
        withoutLeave: number;
        recidivismCount: number;
        internalAvg: number;
        weightedP5Avg: number;
      };
      employees: SafetyEmployeeLossDetail[];
      occurrences: Array<{
        id: string;
        accidentType: AccidentType;
        occurredAt: string;
        daysAway: number | null;
        description: string | null;
        status: AccidentStatus;
        pointsLost: number;
        employeeName: string;
      }>;
      pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
      };
    }>(`${BASE}/cycles/${cycleId}/safety/sectors/${sectorId}`, { params });
    return data;
  },

  async getSafetyParticipantDetail(cycleId: string, participantId: string) {
    const { data } = await api.get<{
      cycle: {
        id: string;
        month: number;
        year: number;
        status: CycleStatus;
      };
      employee: SafetyEmployeeLossDetail;
      occurrences: Array<{
        id: string;
        accidentType: AccidentType;
        occurredAt: string;
        daysAway: number | null;
        description: string | null;
        status: AccidentStatus;
        pointsLost: number;
      }>;
    }>(`${BASE}/cycles/${cycleId}/safety/participants/${participantId}`);
    return data;
  },

  async calculateSafety(cycleId: string) {
    const { data } = await api.post(
      `${BASE}/cycles/${cycleId}/safety/calculate`,
    );
    return data;
  },

  async simulateAccident(payload: {
    accidentType: 'WITH_LEAVE' | 'WITHOUT_LEAVE';
    daysAway?: number | null;
    costCenter?: string;
    cardNumber: string;
    unit: 'PEDERTRACTOR' | 'TRACTOR';
  }) {
    const { data } = await api.post<{
      created: boolean;
      recalculated: boolean;
      simulation: {
        costCenter: string;
        cardNumber: string;
        unit: string;
        accidentType: string;
        employeeName: string;
        sectorName: string;
        cycleId: string;
        cycleLabel: string;
      };
      accident: {
        id: string;
        externalId: string;
        accidentType: string;
        status: string;
      };
      impact?: {
        employee: {
          name: string;
          internalTotal: number | null;
          weightedP5: number | null;
        };
        sector: {
          name: string;
          weightedP5Avg: number | null;
          participantsCount: number;
        };
        factory: {
          cycleLabel: string;
          weightedP5Avg: number | null;
          participantsCount: number;
        };
      };
    }>(`${BASE}/dev/simulate-accident`, payload);
    return data;
  },

  async listSimulationAccidents() {
    const { data } = await api.get<SimulationAccidentsResponse>(
      `${BASE}/dev/simulation-accidents`,
    );
    return data;
  },

  async cancelSimulatedAccident(accidentId: string) {
    const { data } = await api.post<{
      operation: string;
      changed: boolean;
      recalculated: boolean;
      simulation: {
        accidentId: string;
        externalId: string;
        cycleId: string;
        cycleLabel: string;
        employeeName: string | null;
      };
    }>(`${BASE}/dev/cancel-accident`, { accidentId });
    return data;
  },

  async simulateAbsenteeism(payload: {
    absenteeism: number;
    costCenter: string;
    cardNumber: string;
    unit: 'PEDERTRACTOR' | 'TRACTOR';
  }) {
    const { data } = await api.post<{
      simulation: {
        costCenter: string;
        cardNumber: string;
        unit: string;
        absenteeism: number;
        employeeName: string;
        sectorName: string;
        cycleId: string;
        cycleLabel: string;
        participantId: string;
      };
      score: {
        absenteeism: number | null;
        individualPreserved: number;
        sectorPreserved: number;
        internalTotal: number;
        weightedP5: number;
        individualDeducted: boolean;
        scoringRuleVersion?: 1 | 2;
        factoryOccurrenceCount?: number;
        factoryDeductionP5?: number;
        factoryBalanceP5?: number;
        individualDeductionP5?: number;
        zeroedBy?: 'factory_threshold' | 'individual_threshold' | null;
      };
    }>(`${BASE}/dev/simulate-absenteeism`, payload);
    return data;
  },

  async forceCalculateAbsenteeism(payload: { month: number; year: number }) {
    const { data } = await api.post<{
      result: {
        status: 'applied';
        targetCycleId: string;
        targetMonth: number;
        targetYear: number;
        participantsScored: number;
        penalizedCount: number;
        unmatchedProcedureRows: number;
        partial: boolean;
        cycleLabel: string;
        cycleStatus: CycleStatus;
      };
    }>(`${BASE}/dev/calculate-absenteeism`, payload);
    return data.result;
  },

  async setFrequencyResult(
    cycleId: string,
    payload: { sectorId: string; preservedInternalPoints: number },
  ) {
    const { data } = await api.patch(
      `${BASE}/cycles/${cycleId}/safety/frequency-result`,
      payload,
    );
    return data;
  },

  async listPillars(programYearId: string) {
    const { data } = await api.get<{ pillars: PillarWithIndicators[] }>(
      `${BASE}/program-years/${programYearId}/pillars`,
    );
    return data.pillars;
  },

  async updateIndicator(
    indicatorId: string,
    payload: { active?: boolean; name?: string },
  ) {
    const { data } = await api.patch(
      `${BASE}/indicators/${indicatorId}`,
      payload,
    );
    return data;
  },
};
