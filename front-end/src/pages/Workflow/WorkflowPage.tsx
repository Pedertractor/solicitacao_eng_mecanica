import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { SolicitationStatusBadge } from '@/components/SolicitationStatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  WorkflowTimeline,
  workflowHasActiveStage,
} from '@/components/workflow/WorkflowTimeline';
import {
  solicitationApi,
  SOLICITATION_CLIENT_LABELS,
  WORKFLOW_STAGE_LABELS,
  type Solicitation,
} from '@/services/solicitation';
import { solicitationDetailPath } from '@/routes/constants';
import { useAuth } from '@/contexts/useAuth';
import { isProcessEngineeringLead } from '@/config/permissions';
import { EngineeringQueue } from './EngineeringQueue';
import {
  ComercialFilters,
  EMPTY_COMERCIAL_FILTERS,
  filterComercialItems,
  type ComercialFilterState,
} from './comercial-filters';

function SummaryCards() {
  const summaryQuery = useQuery({
    queryKey: ['workflow-summary'],
    queryFn: () => solicitationApi.workflowSummary(),
    refetchInterval: 60_000,
  });

  if (summaryQuery.isLoading) {
    return (
      <div className='grid gap-3 sm:grid-cols-3'>
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className='h-28 rounded-xl' />
        ))}
      </div>
    );
  }

  const stages = summaryQuery.data?.stages ?? [];

  return (
    <div className='grid gap-3 sm:grid-cols-3'>
      {stages.map((stage) => (
        <Card key={stage.stage}>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>
              {WORKFLOW_STAGE_LABELS[stage.stage]}
            </CardTitle>
          </CardHeader>
          <CardContent className='grid grid-cols-2 gap-2 text-sm'>
            <div>
              <p className='text-muted-foreground'>Total</p>
              <p className='text-xl font-semibold'>{stage.total}</p>
            </div>
            <div>
              <p className='text-muted-foreground'>Em andamento</p>
              <p className='text-xl font-semibold'>{stage.inProgress}</p>
            </div>
            <div>
              <p className='text-muted-foreground'>Aguardando</p>
              <p className='text-xl font-semibold'>{stage.waiting}</p>
            </div>
            <div>
              <p className='text-muted-foreground'>Concluídas</p>
              <p className='text-xl font-semibold'>{stage.done}</p>
            </div>
          </CardContent>
        </Card>
      ))}
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
      className='block rounded-xl transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      aria-label={`Abrir chamado: ${solicitation.title}`}
    >
      <Card className='gap-4 py-5'>
        <CardHeader className='gap-1.5'>
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
        <CardContent>
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
    refetchInterval: (query) => {
      const items = query.state.data?.solicitations ?? [];
      return items.some((item) => workflowHasActiveStage(item.workflow))
        ? 30_000
        : 60_000;
    },
  });

  const items = listQuery.data?.solicitations ?? [];
  const visible = filterComercialItems(items, filters, 'board');
  const filtersActive =
    filters.query.trim() !== '' ||
    filters.client !== 'ALL' ||
    filters.stage !== 'ALL' ||
    filters.deadline !== 'ALL';

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold tracking-tight'>Comercial</h1>
        <p className='text-sm text-muted-foreground'>
          Acompanhe o fluxo Engenharia → Ferramentaria → Amostra. Clique em um
          card para abrir o chamado.
        </p>
      </div>

      <SummaryCards />

      <ComercialFilters mode='board' value={filters} onChange={setFilters} />

      <div className='space-y-3'>
        <h2 className='text-lg font-medium'>Chamados</h2>
        {listQuery.isLoading ? (
          <div className='space-y-3'>
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className='h-36 rounded-xl' />
            ))}
          </div>
        ) : listQuery.isError ? (
          <p className='text-sm text-destructive'>
            Não foi possível carregar os chamados.
          </p>
        ) : items.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            Nenhuma solicitação Comercial no momento.
          </p>
        ) : visible.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            Nenhum chamado corresponde aos filtros.
          </p>
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
    </div>
  );
}
