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
    <Card className='gap-4 py-5'>
      <CardHeader className='gap-1.5'>
        <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
          <Link
            to={solicitationDetailPath(solicitation.id)}
            className='font-mono text-xs font-medium tracking-wide text-muted-foreground hover:text-foreground hover:underline'
          >
            {solicitation.trackingCode}
          </Link>
          <SolicitationStatusBadge status={solicitation.status} />
        </div>
        <CardTitle className='text-base leading-snug'>
          <Link
            to={solicitationDetailPath(solicitation.id)}
            className='hover:underline'
          >
            {solicitation.title}
          </Link>
        </CardTitle>
        {clientLabel ? (
          <p className='text-sm text-muted-foreground'>{clientLabel}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        <WorkflowTimeline workflow={solicitation.workflow} />
      </CardContent>
    </Card>
  );
}

export function WorkflowPage() {
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

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold tracking-tight'>Workflow</h1>
        <p className='text-sm text-muted-foreground'>
          Acompanhe o fluxo Comercial → Engenharia → Ferramentaria → Amostra.
        </p>
      </div>

      <SummaryCards />

      <div className='space-y-3'>
        <h2 className='text-lg font-medium'>Solicitações em workflow</h2>
        {listQuery.isLoading ? (
          <div className='space-y-3'>
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className='h-36 rounded-xl' />
            ))}
          </div>
        ) : listQuery.isError ? (
          <p className='text-sm text-destructive'>
            Não foi possível carregar o workflow.
          </p>
        ) : (listQuery.data?.solicitations.length ?? 0) === 0 ? (
          <p className='text-sm text-muted-foreground'>
            Nenhuma solicitação Comercial em workflow no momento.
          </p>
        ) : (
          <div className='space-y-3'>
            {listQuery.data!.solicitations.map((solicitation) => (
              <WorkflowCard key={solicitation.id} solicitation={solicitation} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
