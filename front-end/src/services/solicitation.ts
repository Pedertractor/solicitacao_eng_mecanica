import type { Unit, UserDepartment } from '@/types/auth';
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
  | 'CATERPILLAR_GERADORES'
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
  | 'JOHN_DEERE_HORIZONTINA'
  | 'JOHN_DEERE_INDAIATUBA'
  | 'MOTOCANA'
  | 'PEDERTRACTOR'
  | 'PRAMAC'
  | 'SILTOMAC'
  | 'TRACTOR_COMPONENTS'
  | 'TRIVELATO'
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

export type WorkflowStageKind = 'ENGENHARIA' | 'FERRAMENTARIA' | 'AMOSTRA';

export type WorkflowStageStatus =
  | 'PENDING'
  | 'READY'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'CANCELLED';

export interface WorkflowStageItem {
  id: string;
  stage: WorkflowStageKind;
  status: WorkflowStageStatus;
  order: number;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  plannedDurationPercentage: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
  kairoTeamId: string | null;
  kairoCardIds: string | null;
  kairoSyncedAt: string | null;
  kairoSyncedByUserId: string | null;
  completedByUserId: string | null;
}

export interface SolicitationWorkflow {
  requiresTooling: boolean;
  stages: WorkflowStageItem[];
}

export interface WorkflowSummaryStage {
  stage: WorkflowStageKind;
  total: number;
  inProgress: number;
  waiting: number;
  done: number;
}

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
  processInstructionRequester: string | null;
  processInstructionProcess: string | null;
  processInstructionType: string | null;
  processInstructionDeadlineLabel: string | null;
  processInstructionDeadlineDate: string | null;
  deliveryDate: string | null;
  partNumbers: string | null;
  fileLink: string | null;
  kind: SolicitationKind | null;
  client: SolicitationClient | null;
  activityType: SolicitationActivityType | null;
  productType: SolicitationProductType | null;
  priority: SolicitationPriority | null;
  status: SolicitationStatus;
  statusUpdatedAt: string | null;
  statusUpdatedByUserId: string | null;
  kairoCardId: string | null;
  kairoCardIds: string | null;
  kairoTeamId: string | null;
  kairoSyncedAt: string | null;
  kairoSyncedByUserId: string | null;
  deletedAt: string | null;
  deletedByUserId: string | null;
  deletedByName: string | null;
  deletedFrom: SolicitationDeletionSource | null;
  department: UserDepartment;
  requiresTooling: boolean;
  workflow: SolicitationWorkflow | null;
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
  department: UserDepartment;
  client: SolicitationClient | null;
  processInstructionRequester: string | null;
  processInstructionProcess: string | null;
  processInstructionType: string | null;
  processInstructionDeadlineLabel: string | null;
  processInstructionDeadlineDate: string | null;
  deliveryDate: string | null;
  partNumbers: string | null;
  fileLink: string | null;
  createdAt: string;
  statusUpdatedAt: string | null;
  workflow: SolicitationWorkflow | null;
}

export interface ValidateRequesterResponse {
  employeeId: string;
  name: string;
  status: boolean;
  cardNumber: string;
  unit: Unit;
  email: string | null;
}

export interface PartLookup {
  partNumber: string;
  partCode: string | null;
  description: string | null;
  status: boolean | null;
}

export interface SectorByCostCenter {
  id: string;
  name: string;
  costCenter: string;
  normalizedName: string;
  status: boolean;
}

type CreateSolicitationBase = {
  cardNumber: string;
  unit: Unit;
  costCenter: string;
  pillarOrLocation: string;
  requesterEmail: string;
};

export type CreateSolicitationPayload =
  | (CreateSolicitationBase & {
      department: 'ENG_MECANICA';
      title: string;
      description: string;
    })
  | (CreateSolicitationBase & {
      department: 'DESENVOLVIMENTO_PROCESSOS';
      processInstructionRequester: string;
      processInstructionProcess: string;
      processInstructionType: string;
      client: SolicitationClient;
      deliveryDate?: string;
      partNumbers?: string;
      fileLink?: string;
      comments?: string;
      requiresTooling?: boolean;
    });

export interface UpdateSolicitationReviewPayload {
  client?: SolicitationClient | null;
  activityType?: SolicitationActivityType | null;
  productType?: SolicitationProductType | null;
  priority?: SolicitationPriority | null;
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
  onlyWorkflow?: boolean;
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

  async lookupPartByNumber(partNumber: string): Promise<PartLookup> {
    const { data } = await api.get<{ part: PartLookup }>(
      `${BASE}/part/${encodeURIComponent(partNumber)}`,
      { skipErrorToast: true },
    );
    return data.part;
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
        ...(params.onlyWorkflow ? { onlyWorkflow: 'true' } : {}),
      },
    });
    return data;
  },

  async workflowSummary(): Promise<{ stages: WorkflowSummaryStage[] }> {
    const { data } = await api.get<{ stages: WorkflowSummaryStage[] }>(
      `${BASE}/workflow/summary`,
    );
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

  async sendToolingToKairo(
    id: string,
    payload: {
      teamId: string;
      title?: string;
      description?: string;
      tagId?: string;
    },
  ): Promise<Solicitation> {
    const { data } = await api.post<{ solicitation: Solicitation }>(
      `${BASE}/${id}/workflow/tooling/send-to-kairo`,
      payload,
      { skipErrorToast: true },
    );
    return data.solicitation;
  },

  async syncToolingFromKairo(id: string): Promise<Solicitation> {
    const { data } = await api.post<{ solicitation: Solicitation }>(
      `${BASE}/${id}/workflow/tooling/sync-kairo`,
      {},
      { skipErrorToast: true },
    );
    return data.solicitation;
  },

  async sendSampleToKairo(
    id: string,
    payload: {
      teamId: string;
      title?: string;
      description?: string;
      tagId?: string;
    },
  ): Promise<Solicitation> {
    const { data } = await api.post<{ solicitation: Solicitation }>(
      `${BASE}/${id}/workflow/sample/send-to-kairo`,
      payload,
      { skipErrorToast: true },
    );
    return data.solicitation;
  },

  async syncSampleFromKairo(id: string): Promise<Solicitation> {
    const { data } = await api.post<{ solicitation: Solicitation }>(
      `${BASE}/${id}/workflow/sample/sync-kairo`,
      {},
      { skipErrorToast: true },
    );
    return data.solicitation;
  },
};

export const WORKFLOW_STAGE_LABELS: Record<WorkflowStageKind, string> = {
  ENGENHARIA: 'Engenharia',
  FERRAMENTARIA: 'Ferramentaria',
  AMOSTRA: 'Amostra',
};

export const WORKFLOW_STAGE_STATUS_LABELS: Record<WorkflowStageStatus, string> =
  {
    PENDING: 'Pendente',
    READY: 'Liberada',
    IN_PROGRESS: 'Em andamento',
    DONE: 'Concluída',
    CANCELLED: 'Cancelada',
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
  CATERPILLAR_GERADORES: 'CATERPILLAR - GERADORES',
  CNH_CONTAGEM: 'CNH - CONTAGEM',
  CNH_CURITIBA: 'CNH - CURITIBA',
  CNH_PIRACICABA: 'CNH - PIRACICABA',
  CNH_SOROCABA: 'CNH - SOROCABA',
  CRUCIANELLI: 'CRUCIANELLI - PICCIN',
  DYNAPAC: 'DYNAPAC',
  HYUNDAI: 'HYUNDAI',
  IVECO: 'IVECO',
  JACTO: 'JACTO',
  JCB: 'JCB',
  JOHN_DEERE_CATALAO: 'JOHN DEERE - CATALÃO',
  JOHN_DEERE_HORIZONTINA: 'JOHN DEERE - HORIZONTINA',
  JOHN_DEERE_INDAIATUBA: 'JOHN DEERE - INDAIATUBA',
  MOTOCANA: 'MOTOCANA',
  PEDERTRACTOR: 'PEDERTRACTOR',
  PRAMAC: 'PRAMAC GERADORES',
  SILTOMAC: 'SILTOMAC',
  TRACTOR_COMPONENTS: 'TRACTOR COMPONENTS',
  TRIVELATO: 'TRIVELATO',
  VOLVO: 'VOLVO',
};

export const SOLICITATION_CLIENT_OPTIONS: SolicitationClient[] = [
  'CATERPILLAR',
  'CNH_PIRACICABA',
  'CATERPILLAR_GERADORES',
  'CNH_CONTAGEM',
  'IVECO',
  'CNH_CURITIBA',
  'CNH_SOROCABA',
  'CRUCIANELLI',
  'DYNAPAC',
  'HYUNDAI',
  'JACTO',
  'JCB',
  'JOHN_DEERE_CATALAO',
  'JOHN_DEERE_HORIZONTINA',
  'JOHN_DEERE_INDAIATUBA',
  'PEDERTRACTOR',
  'PRAMAC',
  'SILTOMAC',
  'MOTOCANA',
  'VOLVO',
  'TRIVELATO',
  'TRACTOR_COMPONENTS',
];

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
