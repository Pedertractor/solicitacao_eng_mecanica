import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, Compass, FolderKanban } from 'lucide-react';
import {
  AppPageContainer,
  ListEmptyState,
  ListErrorState,
  PageHero,
  PageSectionHeader,
} from '@/components/layout';
import { SolicitationStatusBadge } from '@/components/SolicitationStatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { workflowHasActiveStage } from '@/components/workflow/WorkflowTimeline';
import { cn } from '@/lib/utils';
import { surfaceStyles } from '@/lib/surface-styles';
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
      className='group block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      aria-label={`Abrir chamado: ${solicitation.title}`}
    >
      <Card
        className={cn(
          'h-full gap-3 py-4',
          surfaceStyles.interactiveCard,
          'group-hover:-translate-y-0.5 group-hover:border-foreground/15 group-hover:shadow-lg',
        )}
      >
        <CardHeader className='grid-cols-[1fr_auto] gap-1.5 px-4'>
          <div className='min-w-0 space-y-1.5'>
            <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
              <span className={surfaceStyles.monoCode}>
                {solicitation.trackingCode}
              </span>
              <SolicitationStatusBadge status={solicitation.status} />
            </div>
            <CardTitle className='text-base leading-snug transition-colors group-hover:text-foreground'>
              {solicitation.title}
            </CardTitle>
            {clientLabel ? (
              <p className='text-sm text-muted-foreground'>{clientLabel}</p>
            ) : null}
          </div>
          <div className='flex size-8 items-center justify-center rounded-full border bg-background text-muted-foreground transition-all group-hover:border-foreground/20 group-hover:bg-foreground group-hover:text-background'>
            <ArrowUpRight className='size-3.5' />
          </div>
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
    <AppPageContainer>
      <PageHero
        eyebrow='Fila de engenharia'
        eyebrowIcon={Compass}
        title='Operação Comercial'
        description='Projetos sob responsabilidade da Engenharia, do prazo mais próximo para o mais distante.'
      />

      <ComercialFilters
        mode='engineering'
        value={filters}
        onChange={setFilters}
      />

      <div className='space-y-4'>
        <PageSectionHeader
          icon={FolderKanban}
          title='Projetos'
          description='Priorizados por proximidade de prazo'
          badge={
            !queueQuery.isLoading && !queueQuery.isError
              ? `${visible.length} ${visible.length === 1 ? 'projeto' : 'projetos'}`
              : undefined
          }
        />

        {queueQuery.isLoading ? (
          <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className='h-40 rounded-2xl' />
            ))}
          </div>
        ) : queueQuery.isError ? (
          <ListErrorState>
            Não foi possível carregar os projetos.
          </ListErrorState>
        ) : items.length === 0 ? (
          <ListEmptyState>
            Nenhum projeto com etapa de Engenharia em aberto.
          </ListEmptyState>
        ) : visible.length === 0 ? (
          <ListEmptyState>
            Nenhum projeto corresponde aos filtros.
          </ListEmptyState>
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
    </AppPageContainer>
  );
}
