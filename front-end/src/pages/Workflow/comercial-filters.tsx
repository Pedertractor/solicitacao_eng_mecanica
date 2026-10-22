import { differenceInCalendarDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search } from 'lucide-react';
import { FilterPanel } from '@/components/layout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { surfaceStyles } from '@/lib/surface-styles';
import {
  SOLICITATION_CLIENT_LABELS,
  SOLICITATION_CLIENT_OPTIONS,
  WORKFLOW_STAGE_LABELS,
  WORKFLOW_STAGE_STATUS_LABELS,
  type Solicitation,
  type SolicitationClient,
  type WorkflowStageKind,
  type WorkflowStageStatus,
} from '@/services/solicitation';

const ALL = 'ALL';

export type DeadlineTone = 'late' | 'today' | 'soon' | 'normal' | 'none';
export type DeadlineFilter = 'ALL' | 'late' | 'today' | 'soon' | 'none';
export type StageFilter = 'ALL' | WorkflowStageKind;
export type StageStatusFilter = 'ALL' | 'PENDING' | 'READY' | 'IN_PROGRESS';

export type ComercialFilterState = {
  query: string;
  client: 'ALL' | SolicitationClient;
  stage: StageFilter;
  stageStatus: StageStatusFilter;
  deadline: DeadlineFilter;
};

export const EMPTY_COMERCIAL_FILTERS: ComercialFilterState = {
  query: '',
  client: ALL,
  stage: ALL,
  stageStatus: ALL,
  deadline: ALL,
};

const STAGE_STATUS_OPTIONS: StageStatusFilter[] = [
  'PENDING',
  'READY',
  'IN_PROGRESS',
];

export function deadlineInfo(plannedEndAt: string | null | undefined): {
  label: string;
  date: string | null;
  tone: DeadlineTone;
} {
  if (!plannedEndAt) {
    return { label: 'Sem prazo definido', date: null, tone: 'none' };
  }

  const due = new Date(plannedEndAt);
  const date = format(due, 'dd/MM/yyyy', { locale: ptBR });
  const days = differenceInCalendarDays(due, new Date());

  if (days < 0) {
    const late = Math.abs(days);
    return {
      label: `Atrasado há ${late} ${late === 1 ? 'dia' : 'dias'}`,
      date,
      tone: 'late',
    };
  }
  if (days === 0) return { label: 'Vence hoje', date, tone: 'today' };
  if (days === 1) return { label: 'Vence amanhã', date, tone: 'soon' };
  if (days <= 7) {
    return { label: `Vence em ${days} dias`, date, tone: 'soon' };
  }
  return { label: `Vence em ${days} dias`, date, tone: 'normal' };
}

function engineeringStage(solicitation: Solicitation) {
  return solicitation.workflow?.stages.find(
    (stage) => stage.stage === 'ENGENHARIA',
  );
}

function activeStage(solicitation: Solicitation) {
  const stages = [...(solicitation.workflow?.stages ?? [])].sort(
    (a, b) => a.order - b.order,
  );
  return (
    stages.find(
      (stage) =>
        stage.status === 'IN_PROGRESS' ||
        stage.status === 'READY' ||
        stage.status === 'PENDING',
    ) ?? null
  );
}

function matchesQuery(solicitation: Solicitation, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const client = solicitation.client
    ? SOLICITATION_CLIENT_LABELS[solicitation.client]
    : '';
  const haystack = [
    solicitation.title,
    solicitation.trackingCode,
    solicitation.requesterName,
    solicitation.partNumbers ?? '',
    client,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function matchesDeadline(
  solicitation: Solicitation,
  deadline: DeadlineFilter,
  mode: 'engineering' | 'board',
) {
  if (deadline === ALL) return true;
  const stage =
    mode === 'engineering'
      ? engineeringStage(solicitation)
      : activeStage(solicitation);
  return deadlineInfo(stage?.plannedEndAt).tone === deadline;
}

export function filterComercialItems(
  items: Solicitation[],
  filters: ComercialFilterState,
  mode: 'engineering' | 'board',
): Solicitation[] {
  return items.filter((solicitation) => {
    if (!matchesQuery(solicitation, filters.query)) return false;
    if (filters.client !== ALL && solicitation.client !== filters.client) {
      return false;
    }
    if (!matchesDeadline(solicitation, filters.deadline, mode)) return false;

    if (mode === 'engineering') {
      if (filters.stageStatus === ALL) return true;
      return engineeringStage(solicitation)?.status === filters.stageStatus;
    }

    if (filters.stage === ALL) return true;
    return activeStage(solicitation)?.stage === filters.stage;
  });
}

export function ComercialFilters({
  value,
  onChange,
  mode,
}: {
  value: ComercialFilterState;
  onChange: (next: ComercialFilterState) => void;
  mode: 'engineering' | 'board';
}) {
  const activeFilterCount = [
    value.query.trim() !== '',
    value.client !== ALL,
    mode === 'engineering' ? value.stageStatus !== ALL : value.stage !== ALL,
    value.deadline !== ALL,
  ].filter(Boolean).length;

  return (
    <FilterPanel
      description='Refine os resultados da operação'
      activeCount={activeFilterCount}
      onClear={() => onChange(EMPTY_COMERCIAL_FILTERS)}
    >
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <div className='space-y-1.5 sm:col-span-2 xl:col-span-1'>
          <Label htmlFor='comercial-search' className='text-xs font-medium'>
            Busca
          </Label>
          <div className='relative'>
            <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              id='comercial-search'
              className={`${surfaceStyles.field} pl-9`}
              value={value.query}
              placeholder='Título, código ou solicitante'
              onChange={(event) =>
                onChange({ ...value, query: event.target.value })
              }
            />
          </div>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='comercial-client' className='text-xs font-medium'>
            Cliente
          </Label>
          <Select
            value={value.client}
            onValueChange={(client) =>
              onChange({
                ...value,
                client: client as ComercialFilterState['client'],
              })
            }
          >
            <SelectTrigger
              id='comercial-client'
              className={`w-full ${surfaceStyles.field}`}
            >
              <SelectValue placeholder='Cliente' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os clientes</SelectItem>
              {SOLICITATION_CLIENT_OPTIONS.map((client) => (
                <SelectItem key={client} value={client}>
                  {SOLICITATION_CLIENT_LABELS[client]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mode === 'engineering' ? (
          <div className='space-y-1.5'>
            <Label
              htmlFor='comercial-stage-status'
              className='text-xs font-medium'
            >
              Etapa de engenharia
            </Label>
            <Select
              value={value.stageStatus}
              onValueChange={(stageStatus) =>
                onChange({
                  ...value,
                  stageStatus: stageStatus as StageStatusFilter,
                })
              }
            >
              <SelectTrigger
                id='comercial-stage-status'
                className={`w-full ${surfaceStyles.field}`}
              >
                <SelectValue placeholder='Etapa' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os status</SelectItem>
                {STAGE_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {
                      WORKFLOW_STAGE_STATUS_LABELS[
                        status as WorkflowStageStatus
                      ]
                    }
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className='space-y-1.5'>
            <Label htmlFor='comercial-stage' className='text-xs font-medium'>
              Etapa atual
            </Label>
            <Select
              value={value.stage}
              onValueChange={(stage) =>
                onChange({ ...value, stage: stage as StageFilter })
              }
            >
              <SelectTrigger
                id='comercial-stage'
                className={`w-full ${surfaceStyles.field}`}
              >
                <SelectValue placeholder='Etapa' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as etapas</SelectItem>
                {(
                  Object.keys(WORKFLOW_STAGE_LABELS) as WorkflowStageKind[]
                ).map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {WORKFLOW_STAGE_LABELS[stage]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className='space-y-1.5'>
          <Label htmlFor='comercial-deadline' className='text-xs font-medium'>
            Prazo
          </Label>
          <Select
            value={value.deadline}
            onValueChange={(deadline) =>
              onChange({ ...value, deadline: deadline as DeadlineFilter })
            }
          >
            <SelectTrigger
              id='comercial-deadline'
              className={`w-full ${surfaceStyles.field}`}
            >
              <SelectValue placeholder='Prazo' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os prazos</SelectItem>
              <SelectItem value='late'>Atrasados</SelectItem>
              <SelectItem value='today'>Vence hoje</SelectItem>
              <SelectItem value='soon'>Próximos 7 dias</SelectItem>
              <SelectItem value='none'>Sem prazo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </FilterPanel>
  );
}
