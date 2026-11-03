import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  CheckCircle2,
  Compass,
  ClipboardList,
  FlaskConical,
  Layers3,
  Wrench,
  ShieldCheck,
} from 'lucide-react';
import {
  AppPageContainer,
  ListEmptyState,
  ListErrorState,
  ListLoadingState,
  PageHero,
  PageSectionHeader,
} from '@/components/layout';
import { SolicitationStatusBadge } from '@/components/SolicitationStatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkflowTimeline } from '@/components/workflow/WorkflowTimeline';
import {
  solicitationApi,
  SOLICITATION_CLIENT_LABELS,
  WORKFLOW_STAGE_LABELS,
  type Solicitation,
} from '@/services/solicitation';
import { solicitationDetailPath } from '@/routes/constants';
import { useAuth } from '@/contexts/useAuth';
import { isProcessEngineeringLead } from '@/config/permissions';
import { cn } from '@/lib/utils';
import { surfaceStyles } from '@/lib/surface-styles';
import { EngineeringQueue } from './EngineeringQueue';
import {
  ComercialFilters,
  EMPTY_COMERCIAL_FILTERS,
  filterComercialItems,
  type ComercialFilterState,
} from './comercial-filters';

const STAGE_APPEARANCE = {
  ENGENHARIA: {
    icon: Compass,
    iconClass: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    barClass: 'bg-sky-500',
    glowClass: 'bg-sky-400/10',
  },
  FERRAMENTARIA: {
    icon: Wrench,
    iconClass:
      'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    barClass: 'bg-violet-500',
    glowClass: 'bg-violet-400/10',
  },
  PCP_FERRAMENTARIA: {
    icon: ClipboardList,
    iconClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    barClass: 'bg-amber-500',
    glowClass: 'bg-amber-400/10',
  },
  PCP_AMOSTRA: {
    icon: ClipboardList,
    iconClass: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    barClass: 'bg-orange-500',
    glowClass: 'bg-orange-400/10',
  },
  QUALIDADE: {
    icon: ShieldCheck,
    iconClass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
    barClass: 'bg-cyan-500',
    glowClass: 'bg-cyan-400/10',
  },
  AMOSTRA: {
    icon: FlaskConical,
    iconClass:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    barClass: 'bg-emerald-500',
    glowClass: 'bg-emerald-400/10',
  },
};

function SummaryCards() {
  const summaryQuery = useQuery({
    queryKey: ['workflow-summary'],
    queryFn: () => solicitationApi.workflowSummary(),
    refetchInterval: 5_000,
  });

  if (summaryQuery.isLoading) {
    return (
      <div className='grid gap-4 sm:grid-cols-3'>
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className='h-36 rounded-2xl' />
        ))}
      </div>
    );
  }

  const stages = summaryQuery.data?.stages ?? [];

  return (
    <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-6'>
      {stages.map((stage) => {
        const appearance = STAGE_APPEARANCE[stage.stage];
        const Icon = appearance.icon;
        const completion =
          stage.total > 0 ? Math.round((stage.done / stage.total) * 100) : 0;

        return (
          <Card
            key={stage.stage}
            className='group relative gap-4 overflow-hidden rounded-2xl border-border/70 py-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg'
          >
            <div
              className={cn(
                'pointer-events-none absolute -right-8 -top-10 size-32 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-125',
                appearance.glowClass,
              )}
            />
            <CardHeader className='relative flex flex-row items-center justify-between gap-3 px-5'>
              <div className='flex items-center gap-3'>
                <div
                  className={cn(
                    'flex size-10 items-center justify-center rounded-xl',
                    appearance.iconClass,
                  )}
                >
                  <Icon className='size-5' />
                </div>
                <div>
                  <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                    Etapa
                  </p>
                  <CardTitle className='mt-0.5 text-base'>
                    {WORKFLOW_STAGE_LABELS[stage.stage]}
                  </CardTitle>
                </div>
              </div>
              <div className='text-right'>
                <p className='text-3xl font-bold tracking-tight'>
                  {stage.total}
                </p>
                <p className='text-[11px] text-muted-foreground'>no total</p>
              </div>
            </CardHeader>
            <CardContent className='relative space-y-4 px-5'>
              <div
                className='h-1.5 overflow-hidden rounded-full bg-muted'
                role='progressbar'
                aria-label={`${completion}% concluído`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completion}
              >
                <div
                  className={cn('h-full rounded-full', appearance.barClass)}
                  style={{ width: `${completion}%` }}
                />
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <p className='text-lg font-semibold tabular-nums'>
                    {stage.inProgress}
                  </p>
                  <p className='text-xs text-muted-foreground'>Em curso</p>
                </div>
                <div>
                  <p className='text-lg font-semibold tabular-nums'>
                    {stage.waiting}
                  </p>
                  <p className='text-xs text-muted-foreground'>Aguardando</p>
                </div>
                <div>
                  <p className='text-lg font-semibold tabular-nums'>
                    {stage.done}
                  </p>
                  <p className='text-xs text-muted-foreground'>Concluídas</p>
                </div>
                <div>
                  <p className='text-lg font-semibold tabular-nums'>{stage.rejected}</p>
                  <p className='text-xs text-muted-foreground'>Recusadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function WorkflowCard({ solicitation }: { solicitation: Solicitation }) {
  if (!solicitation.workflow) return null;

  const clientLabel = solicitation.client
    ? SOLICITATION_CLIENT_LABELS[solicitation.client]
    : null;

  return (
    <Link
      to={solicitationDetailPath(solicitation.id)}
      state={{ from: 'comercial' }}
      className='group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      aria-label={`Abrir chamado: ${solicitation.title}`}
    >
      <Card
        className={cn(
          'gap-5 py-5',
          surfaceStyles.interactiveCard,
          'group-hover:-translate-y-0.5 group-hover:border-foreground/15 group-hover:shadow-lg',
        )}
      >
        <CardHeader className='grid-cols-[1fr_auto] gap-2 px-5 sm:px-6'>
          <div className='min-w-0 space-y-1.5'>
            <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
              <span className={surfaceStyles.monoCode}>
                {solicitation.trackingCode}
              </span>
              <SolicitationStatusBadge status={solicitation.status} />
            </div>
            <CardTitle className='text-base leading-snug transition-colors group-hover:text-foreground sm:text-lg'>
              {solicitation.title}
            </CardTitle>
            {clientLabel ? (
              <p className='text-sm text-muted-foreground'>{clientLabel}</p>
            ) : null}
          </div>
          <div className='flex size-9 items-center justify-center rounded-full border bg-background text-muted-foreground transition-all group-hover:border-foreground/20 group-hover:bg-foreground group-hover:text-background'>
            <ArrowUpRight className='size-4' />
          </div>
        </CardHeader>
        <CardContent className='px-5 sm:px-6'>
          <WorkflowTimeline workflow={solicitation.workflow} />
        </CardContent>
      </Card>
    </Link>
  );
}

export function WorkflowPage() {
  const { user } = useAuth();

  if (user && isProcessEngineeringLead(user.role, user.department)) {
    return <EngineeringQueue />;
  }

  return <FullWorkflowView />;
}

function FullWorkflowView() {
  const [filters, setFilters] = useState<ComercialFilterState>(
    EMPTY_COMERCIAL_FILTERS,
  );
  const listQuery = useQuery({
    queryKey: ['solicitations', 'workflow'],
    queryFn: () =>
      solicitationApi.list({
        onlyWorkflow: true,
        page: 1,
        pageSize: 50,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    refetchInterval: 5_000,
  });

  const items = listQuery.data?.solicitations ?? [];
  const visible = filterComercialItems(items, filters, 'board');
  const filtersActive =
    filters.query.trim() !== '' ||
    filters.client !== 'ALL' ||
    filters.stage !== 'ALL' ||
    filters.deadline !== 'ALL';

  return (
    <AppPageContainer>
      <PageHero
        eyebrow='Visão geral do fluxo'
        eyebrowIcon={Layers3}
        title='Operação Comercial'
        description='Acompanhe Engenharia, planejamento PCP, Ferramentaria, Qualidade · PPAP e Amostra em cada solicitação.'
      >
        <div className='flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground'>
          <span>Qualidade · PPAP pode iniciar desde a criação, em paralelo às demais frentes. Amostra aguarda a conclusão de todos os pré-requisitos.</span>
        </div>
      </PageHero>

      <SummaryCards />

      <ComercialFilters mode='board' value={filters} onChange={setFilters} />

      <div className='space-y-4'>
        <PageSectionHeader
          icon={CheckCircle2}
          title='Chamados'
          description='Acompanhamento detalhado por solicitação'
          badge={
            !listQuery.isLoading && !listQuery.isError
              ? `${visible.length} ${visible.length === 1 ? 'chamado' : 'chamados'}`
              : undefined
          }
        />
        {listQuery.isLoading ? (
          <ListLoadingState />
        ) : listQuery.isError ? (
          <ListErrorState>
            Não foi possível carregar os chamados.
          </ListErrorState>
        ) : items.length === 0 ? (
          <ListEmptyState>
            Nenhuma solicitação Comercial no momento.
          </ListEmptyState>
        ) : visible.length === 0 ? (
          <ListEmptyState>
            Nenhum chamado corresponde aos filtros.
          </ListEmptyState>
        ) : (
          <div className='space-y-3'>
            {filtersActive ? (
              <p className='text-sm text-muted-foreground'>
                {visible.length} de {items.length}{' '}
                {items.length === 1 ? 'chamado' : 'chamados'}
              </p>
            ) : null}
            {visible.map((solicitation) => (
              <WorkflowCard key={solicitation.id} solicitation={solicitation} />
            ))}
          </div>
        )}
      </div>
    </AppPageContainer>
  );
}
