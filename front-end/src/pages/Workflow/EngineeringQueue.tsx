import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { SolicitationStatusBadge } from '@/components/SolicitationStatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { workflowHasActiveStage } from '@/components/workflow/WorkflowTimeline';
import { cn } from '@/lib/utils';
import { solicitationDetailPath } from '@/routes/constants';
import {
  solicitationApi,
  SOLICITATION_CLIENT_LABELS,
  WORKFLOW_STAGE_STATUS_LABELS,
  type Solicitation,
} from '@/services/solicitation';
import {
  ComercialFilters,
  deadlineInfo,
  EMPTY_COMERCIAL_FILTERS,
  filterComercialItems,
  type ComercialFilterState,
  type DeadlineTone,
} from './comercial-filters';

function engineeringStage(solicitation: Solicitation) {
  return solicitation.workflow?.stages.find(
    (stage) => stage.stage === 'ENGENHARIA',
  );
}

const DEADLINE_TONE_CLASSES: Record<DeadlineTone, string> = {
  late: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
  today:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  soon: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  normal: 'border-border bg-muted/40 text-foreground',
  none: 'border-border bg-muted/40 text-muted-foreground',
};

function EngineeringCard({ solicitation }: { solicitation: Solicitation }) {
  const stage = engineeringStage(solicitation);
  const deadline = deadlineInfo(stage?.plannedEndAt);
  const clientLabel = solicitation.client
    ? SOLICITATION_CLIENT_LABELS[solicitation.client]
    : null;

  return (
    <Link
      to={solicitationDetailPath(solicitation.id)}
      state={{ from: 'comercial' }}
      className='block w-full rounded-xl text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      aria-label={`Abrir chamado: ${solicitation.title}`}
    >
      <Card className='h-full gap-3 py-4'>
        <CardHeader className='gap-1.5 px-4'>
          <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
            <span className='font-mono text-xs font-medium tracking-wide text-muted-foreground'>
              {solicitation.trackingCode}
            </span>
            <SolicitationStatusBadge status={solicitation.status} />
          </div>
          <CardTitle className='text-base leading-snug'>
            {solicitation.title}
          </CardTitle>
          {clientLabel ? (
            <p className='text-sm text-muted-foreground'>{clientLabel}</p>
          ) : null}
        </CardHeader>
        <CardContent className='space-y-2 px-4'>
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
              DEADLINE_TONE_CLASSES[deadline.tone],
            )}
          >
            <CalendarClock className='size-4 shrink-0' />
            <span className='font-medium'>{deadline.label}</span>
            {deadline.date ? (
              <span className='ml-auto tabular-nums opacity-80'>
                {deadline.date}
              </span>
            ) : null}
          </div>
          {stage ? (
            <p className='text-xs text-muted-foreground'>
              Engenharia · {WORKFLOW_STAGE_STATUS_LABELS[stage.status]}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}

export function EngineeringQueue() {
  const [filters, setFilters] = useState<ComercialFilterState>(
    EMPTY_COMERCIAL_FILTERS,
  );

  const queueQuery = useQuery({
    queryKey: ['solicitations', 'workflow', 'engineering'],
    queryFn: () => solicitationApi.engineeringQueue(),
    refetchInterval: (query) => {
      const items = query.state.data?.solicitations ?? [];
      return items.some((item) => workflowHasActiveStage(item.workflow))
        ? 30_000
        : 60_000;
    },
  });

  const items = queueQuery.data?.solicitations ?? [];
  const visible = filterComercialItems(items, filters, 'engineering');
  const filtersActive =
    filters.query.trim() !== '' ||
    filters.client !== 'ALL' ||
    filters.stageStatus !== 'ALL' ||
    filters.deadline !== 'ALL';

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold tracking-tight'>Comercial</h1>
        <p className='text-sm text-muted-foreground'>
          Projetos sob responsabilidade da Engenharia, do prazo mais próximo
          para o mais distante. Clique em um card para abrir o chamado.
        </p>
      </div>

      <ComercialFilters
        mode='engineering'
        value={filters}
        onChange={setFilters}
      />

      {queueQuery.isLoading ? (
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className='h-40 rounded-xl' />
          ))}
        </div>
      ) : queueQuery.isError ? (
        <p className='text-sm text-destructive'>
          Não foi possível carregar os projetos.
        </p>
      ) : items.length === 0 ? (
        <p className='text-sm text-muted-foreground'>
          Nenhum projeto com etapa de Engenharia em aberto.
        </p>
      ) : visible.length === 0 ? (
        <p className='text-sm text-muted-foreground'>
          Nenhum projeto corresponde aos filtros.
        </p>
      ) : (
        <>
          {filtersActive ? (
            <p className='text-sm text-muted-foreground'>
              {visible.length} de {items.length}{' '}
              {items.length === 1 ? 'projeto' : 'projetos'}
            </p>
          ) : null}
          <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
            {visible.map((solicitation) => (
              <EngineeringCard
                key={solicitation.id}
                solicitation={solicitation}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
