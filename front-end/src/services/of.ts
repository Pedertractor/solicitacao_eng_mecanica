import api from '@/utils/axiosConfig';

export type OfProcess = {
  OF: number;
  OP: number;
  QTD: number;
  QTD_APT: number;
  /** Início do processo (ISO), vindo da API base. */
  DTH_INI?: string | null;
  /** Início do processo formatado (ex.: 15/10/2026 11:40). */
  DTH_INI_BR?: string | null;
  employeeName: string | null;
  employeeCard: string | null;
  employeeUnit: string | null;
  employeeId: number | null;
  costCenter: string;
  nameSector: string | null;
  processDate?: string | null;
  pointedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  orderStatus?: string | null;
  processStatus?: string | null;
  statusDetail?: string | null;
  machine?: string | null;
  pointedMinutes?: number | null;
  totalMinutes?: number | null;
};

const BASE = '/of';

export const ofApi = {
  async getProcesses(ofNumber: string): Promise<OfProcess[]> {
    const trimmed = ofNumber.trim();
    const { data } = await api.get<{ processes: OfProcess[] }>(
      `${BASE}/${encodeURIComponent(trimmed)}/processes`,
    );
    return data.processes;
  },
};
