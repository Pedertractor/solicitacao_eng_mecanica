/** Item retornado por GET /sector/list da API base (PederTractor) */
export interface ApiBaseSectorListItem {
  id: string;
  name: string;
  costCenter: string;
  normalizedName: string;
  operationId: number;
  leaderDayId: number;
  leaderNightId: number;
  supervisorDayId: number;
  supervisorNightId: number;
  managerId: number;
  createdAt: string;
  updatedAt: string;
}

export type ApiBaseSectorListResponse = ApiBaseSectorListItem[];
