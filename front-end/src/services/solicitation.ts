import type { Unit } from '@/types/auth';
import api from '@/utils/axiosConfig';

export type SolicitationStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DELETED';

export type SolicitationDeletionSource = 'SOLICITATION_APP' | 'KAIRO';

export type SolicitationClient =
  | 'CATERPILLAR'
  | 'CNH_CONTAGEM'
  | 'CNH_CURITIBA'
  | 'CNH_PIRACICABA'
  | 'CNH_SOROCABA'
  | 'CRUCIANELLI'
  | 'DYNAPAC'
  | 'HYUNDAI'
  | 'IVECO'
  | 'JACTO'
  | 'JCB'
  | 'JOHN_DEERE_CATALAO'
  | 'JOHN_DEERE_INDAIATUBA'
  | 'PEDERTRACTOR'
  | 'PRAMAC'
  | 'SILTOMAC'
  | 'TRACTOR_COMPONENTS'
  | 'VOLVO';

export type SolicitationActivityType =
  | 'ANALISE_TECNICA'
  | 'DESENHO_2D'
  | 'DISP_ELEVACAO'
  | 'INSPECAO_CADASTRO'
  | 'LEVANTAMENTO_DE_CUSTO'
  | 'NR12'
  | 'NR13'
  | 'NAO_CLASSIFICADA'
  | 'PROJETO_INDUSTRIAL'
  | 'PROJETO_MELHORIA'
  | 'REUNIAO'
  | 'VALIDACAO_ESTRUTURAL';

export type SolicitationProductType =
  | 'AMOSTRA'
  | 'PRODUCAO'
  | 'PROTOTIPO'
  | 'SEM_CLASSIFICACAO';

export type SolicitationPriority =
  | 'BAIXA'
  | 'NORMAL'
  | 'SEM_CLASSIFICACAO'
  | 'URGENTE';

export type SolicitationKind = 'PROJETO' | 'ATIVIDADE';

export interface Solicitation {
  id: string;
  trackingCode: string;
  employeeId: string;
  requesterName: string;
  requesterEmail: string | null;
  cardNumber: string;
  unit: Unit;
  costCenter: string;
  sectorId: string;
  sectorName: string;
  pillarOrLocation: string;
  title: string;
  description: string;
  kind: SolicitationKind | null;
  client: SolicitationClient | null;
  activityType: SolicitationActivityType | null;
  productType: SolicitationProductType | null;
  priority: SolicitationPriority | null;
  status: SolicitationStatus;
  statusUpdatedAt: string | null;
  statusUpdatedByUserId: string | null;
  kairoCardId: string | null;
  kairoTeamId: string | null;
  kairoSyncedAt: string | null;
  kairoSyncedByUserId: string | null;
  deletedAt: string | null;
  deletedByUserId: string | null;
  deletedByName: string | null;
  deletedFrom: SolicitationDeletionSource | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicSolicitationTicket {
  trackingCode: string;
  status: SolicitationStatus;
  title: string;
  description: string;
  requesterName: string;
  sectorName: string;
  pillarOrLocation: string;
  unit: Unit;
  createdAt: string;
  statusUpdatedAt: string | null;
}

export interface ValidateRequesterResponse {
  employeeId: string;
  name: string;
  status: boolean;
  cardNumber: string;
  unit: Unit;
  email: string | null;
}

export interface SectorByCostCenter {
  id: string;
  name: string;
  costCenter: string;
  normalizedName: string;
  status: boolean;
}

export interface CreateSolicitationPayload {
  cardNumber: string;
  unit: Unit;
  costCenter: string;
  pillarOrLocation: string;
  title: string;
  description: string;
  requesterEmail: string;
}

export interface UpdateSolicitationReviewPayload {
  client: SolicitationClient | null;
  activityType: SolicitationActivityType | null;
  productType: SolicitationProductType | null;
  priority: SolicitationPriority | null;
  approve?: boolean;
}

export type SolicitationSortField =
  | 'createdAt'
  | 'requesterName'
  | 'sectorName'
  | 'title'
  | 'status';

export type SortOrder = 'asc' | 'desc';

export interface SolicitationListParams {
  status?: SolicitationStatus;
  page?: number;
  pageSize?: number;
  sortBy?: SolicitationSortField;
  sortOrder?: SortOrder;
}

export interface SolicitationListResponse {
  solicitations: Solicitation[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const BASE = '/solicitations';

export const solicitationApi = {
  async validateRequester(
    cardNumber: string,
    unit: Unit,
  ): Promise<ValidateRequesterResponse> {
    const { data } = await api.post<ValidateRequesterResponse>(
      `${BASE}/validate-requester`,
      { cardNumber, unit },
      { skipErrorToast: true },
    );
    return data;
  },

  async getSectorByCostCenter(
    costCenter: string,
  ): Promise<SectorByCostCenter> {
    const { data } = await api.get<SectorByCostCenter>(
      `${BASE}/sector/${encodeURIComponent(costCenter)}`,
      { skipErrorToast: true },
    );
    return data;
  },

  async create(payload: CreateSolicitationPayload): Promise<Solicitation> {
    const { data } = await api.post<{ solicitation: Solicitation }>(
      BASE,
      payload,
    );
    return data.solicitation;
  },

  async list(
    params: SolicitationListParams = {},
  ): Promise<SolicitationListResponse> {
    const { data } = await api.get<SolicitationListResponse>(BASE, {
      params: {
        ...(params.status ? { status: params.status } : {}),
        ...(params.page ? { page: params.page } : {}),
        ...(params.pageSize ? { pageSize: params.pageSize } : {}),
        ...(params.sortBy ? { sortBy: params.sortBy } : {}),
        ...(params.sortOrder ? { sortOrder: params.sortOrder } : {}),
      },
    });
    return data;
  },

  async getById(id: string): Promise<Solicitation> {
    const { data } = await api.get<{ solicitation: Solicitation }>(
      `${BASE}/${id}`,
    );
    return data.solicitation;
  },

  async getByTrackingCode(
    trackingCode: string,
  ): Promise<PublicSolicitationTicket> {
    const { data } = await api.get<{ solicitation: PublicSolicitationTicket }>(
      `${BASE}/track/${encodeURIComponent(trackingCode)}`,
      { skipErrorToast: true },
    );
    return data.solicitation;
  },

  async startReview(id: string): Promise<Solicitation> {
    const { data } = await api.post<{ solicitation: Solicitation }>(
      `${BASE}/${id}/start-review`,
    );
    return data.solicitation;
  },

  async updateReview(
    id: string,
    payload: UpdateSolicitationReviewPayload,
  ): Promise<Solicitation> {
    const { data } = await api.patch<{ solicitation: Solicitation }>(
      `${BASE}/${id}/review`,
      payload,
    );
    return data.solicitation;
  },

  async updateStatus(
    id: string,
    status: SolicitationStatus,
  ): Promise<Solicitation> {
    const { data } = await api.patch<{ solicitation: Solicitation }>(
      `${BASE}/${id}/status`,
      { status },
    );
    return data.solicitation;
  },

  async sendToKairo(
    id: string,
    payload: {
      teamId: string;
      kind: SolicitationKind;
      title: string;
      description: string;
      tagId?: string;
      estimatedHours?: number;
    },
  ): Promise<Solicitation> {
    const { data } = await api.post<{ solicitation: Solicitation }>(
      `${BASE}/${id}/send-to-kairo`,
      payload,
      { skipErrorToast: true },
    );
    return data.solicitation;
  },

  async syncFromKairo(id: string): Promise<Solicitation> {
    const { data } = await api.post<{ solicitation: Solicitation }>(
      `${BASE}/${id}/sync-kairo`,
      {},
      { skipErrorToast: true },
    );
    return data.solicitation;
  },

  async syncPendingFromKairo(): Promise<{
    checked: number;
    completed: number;
    deleted: number;
  }> {
    const { data } = await api.post<{
      checked: number;
      completed: number;
      deleted: number;
    }>(`${BASE}/sync-kairo-pending`, {}, { skipErrorToast: true });
    return data;
  },

  async delete(id: string): Promise<Solicitation> {
    const { data } = await api.delete<{ solicitation: Solicitation }>(
      `${BASE}/${id}`,
    );
    return data.solicitation;
  },
};

export const SOLICITATION_STATUS_LABELS: Record<SolicitationStatus, string> = {
  PENDING: 'Pendente',
  IN_REVIEW: 'Em análise',
  APPROVED: 'Aprovado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelada',
  DELETED: 'Excluída',
};

export const SOLICITATION_DELETION_SOURCE_LABELS: Record<
  SolicitationDeletionSource,
  string
> = {
  SOLICITATION_APP: 'Sistema de solicitações',
  KAIRO: 'Kairo',
};

export const SOLICITATION_CLIENT_LABELS: Record<SolicitationClient, string> = {
  CATERPILLAR: 'CATERPILLAR',
  CNH_CONTAGEM: 'CNH CONTAGEM',
  CNH_CURITIBA: 'CNH CURITIBA',
  CNH_PIRACICABA: 'CNH PIRACICABA',
  CNH_SOROCABA: 'CNH SOROCABA',
  CRUCIANELLI: 'CRUCIANELLI',
  DYNAPAC: 'DYNAPAC',
  HYUNDAI: 'HYUNDAI',
  IVECO: 'IVECO',
  JACTO: 'JACTO',
  JCB: 'JCB',
  JOHN_DEERE_CATALAO: 'JOHN DEERE CATALAO',
  JOHN_DEERE_INDAIATUBA: 'JOHN DEERE INDAIATUBA',
  PEDERTRACTOR: 'PEDERTRACTOR',
  PRAMAC: 'PRAMAC',
  SILTOMAC: 'SILTOMAC',
  TRACTOR_COMPONENTS: 'TRACTOR COMPONENTS',
  VOLVO: 'VOLVO',
};

export const SOLICITATION_ACTIVITY_TYPE_LABELS: Record<
  SolicitationActivityType,
  string
> = {
  ANALISE_TECNICA: 'Analise Tecnica',
  DESENHO_2D: 'Desenho 2D',
  DISP_ELEVACAO: 'Disp. Elevacao',
  INSPECAO_CADASTRO: 'Inspecao - Cadastro',
  LEVANTAMENTO_DE_CUSTO: 'Levantamento de Custo',
  NR12: 'NR12',
  NR13: 'NR13',
  NAO_CLASSIFICADA: 'Nao Classificada',
  PROJETO_INDUSTRIAL: 'Projeto Industrial',
  PROJETO_MELHORIA: 'Projeto Melhoria',
  REUNIAO: 'Reuniao',
  VALIDACAO_ESTRUTURAL: 'Validacao Estrutural',
};

export const SOLICITATION_PRODUCT_TYPE_LABELS: Record<
  SolicitationProductType,
  string
> = {
  AMOSTRA: 'Amostra',
  PRODUCAO: 'Produção',
  PROTOTIPO: 'Protótipo',
  SEM_CLASSIFICACAO: 'Sem Classificação',
};

export const SOLICITATION_KIND_LABELS: Record<SolicitationKind, string> = {
  PROJETO: 'Projeto',
  ATIVIDADE: 'Atividade',
};

export const SOLICITATION_PRIORITY_LABELS: Record<
  SolicitationPriority,
  string
> = {
  BAIXA: 'Baixa',
  NORMAL: 'Normal',
  SEM_CLASSIFICACAO: 'Sem Classificação',
  URGENTE: 'Urgente',
};
