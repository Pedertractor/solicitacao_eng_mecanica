import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { differenceInCalendarDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock } from 'lucide-react';
import { SolicitationStatusBadge } from '@/components/SolicitationStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  WorkflowTimeline,
  workflowHasActiveStage,
} from '@/components/workflow/WorkflowTimeline';
import { cn } from '@/lib/utils';
import { solicitationDetailPath } from '@/routes/constants';
import {
  solicitationApi,
  SOLICITATION_CLIENT_LABELS,
  WORKFLOW_STAGE_STATUS_LABELS,
  type Solicitation,
} from '@/services/solicitation';

type DeadlineTone = 'late' | 'today' | 'soon' | 'normal' | 'none';

function engineeringStage(solicitation: Solicitation) {
  return solicitation.workflow?.stages.find(
    (stage) => stage.stage === 'ENGENHARIA',
  );
}

function deadlineInfo(plannedEndAt: string | null | undefined): {
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
  return {
    label: `Vence em ${days} dias`,
    date,
    tone: days <= 3 ? 'soon' : 'normal',
  };
}

const DEADLINE_TONE_CLASSES: Record<DeadlineTone, string> = {
  late: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
  today:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  soon: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  normal: 'border-border bg-muted/40 text-foreground',
  none: 'border-border bg-muted/40 text-muted-foreground',
};

function EngineeringCard({
  solicitation,
  onOpen,
}: {
  solicitation: Solicitation;
  onOpen: () => void;
}) {
  const stage = engineeringStage(solicitation);
  const deadline = deadlineInfo(stage?.plannedEndAt);
  const clientLabel = solicitation.client
    ? SOLICITATION_CLIENT_LABELS[solicitation.client]
    : null;

  return (
    <button
      type='button'
      onClick={onOpen}
      className='block w-full rounded-xl text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      aria-label={`Ver workflow: ${solicitation.title}`}
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
    </button>
  );
}

function WorkflowDialog({
  solicitation,
  onOpenChange,
}: {
  solicitation: Solicitation | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={solicitation != null} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-3xl'>
        {solicitation ? (
          <>
            <DialogHeader>
              <DialogTitle className='leading-snug'>
                {solicitation.title}
              </DialogTitle>
              <DialogDescription className='font-mono text-xs tracking-wide'>
                {solicitation.trackingCode}
              </DialogDescription>
            </DialogHeader>
            {solicitation.workflow ? (
              <WorkflowTimeline workflow={solicitation.workflow} />
            ) : null}
            <DialogFooter>
              <Button asChild variant='outline'>
                <Link to={solicitationDetailPath(solicitation.id)}>
                  Abrir solicitação
                </Link>
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function EngineeringQueue() {
  const [selected, setSelected] = useState<Solicitation | null>(null);

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

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold tracking-tight'>Workflow</h1>
        <p className='text-sm text-muted-foreground'>
          Projetos sob responsabilidade da Engenharia, do prazo mais próximo
          para o mais distante. Clique em um card para ver o workflow.
        </p>
      </div>

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
      ) : (
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
          {items.map((solicitation) => (
            <EngineeringCard
              key={solicitation.id}
              solicitation={solicitation}
              onOpen={() => setSelected(solicitation)}
            />
          ))}
        </div>
      )}

      <WorkflowDialog
        solicitation={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
