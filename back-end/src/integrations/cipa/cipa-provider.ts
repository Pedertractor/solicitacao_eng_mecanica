export type NormalizedCipaAccident = {
  externalId: string;
  employeeExternalId?: string | null;
  employeeCardNumber?: string | null;
  sectorExternalId: string;
  unit: 'PEDERTRACTOR' | 'TRACTOR';
  accidentType: 'WITH_LEAVE' | 'WITHOUT_LEAVE' | 'FREQUENCY';
  occurredAt: string;
  daysAway?: number | null;
  description?: string | null;
  rawPayload?: unknown;
};

export type ListCipaAccidentsParams = {
  from?: string;
  to?: string;
  cycleYear?: number;
  cycleMonth?: number;
};

export interface CipaProvider {
  listAccidents(
    params: ListCipaAccidentsParams,
  ): Promise<NormalizedCipaAccident[]>;
  getAccidentById(externalId: string): Promise<NormalizedCipaAccident | null>;
}
