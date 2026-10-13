import { Fragment } from 'react';
import { Check, ChevronRight, Compass, FlaskConical, Wrench, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type {
  SolicitationWorkflow,
  WorkflowStageItem,
  WorkflowStageKind,
  WorkflowStageStatus,
} from '@/services/solicitation';
import {
  WORKFLOW_STAGE_LABELS,
  WORKFLOW_STAGE_STATUS_LABELS,
} from '@/services/solicitation';

type TimelineStepState =
  | 'completed'
  | 'current'
  | 'upcoming'
  | 'cancelled'
  | 'waiting';

const STAGE_ICONS: Record<WorkflowStageKind, typeof Compass> = {
  ENGENHARIA: Compass,
  FERRAMENTARIA: Wrench,
  AMOSTRA: FlaskConical,
};

function formatDate(value: string | null) {
  if (!value) return null;
  try {
    return format(new Date(value), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return null;
  }
}

function isLate(stage: WorkflowStageItem) {
  if (!stage.plannedEndAt) return false;
  if (stage.status === 'DONE' || stage.status === 'CANCELLED') return false;
  return new Date(stage.plannedEndAt).getTime() < Date.now();
}

function formatShare(value: string | null) {
  if (!value) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const label = Number.isInteger(amount)
    ? String(amount)
    : amount.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${label}%`;
}

function displayStatus(stage: WorkflowStageItem, stages: WorkflowStageItem[]): {
  label: string;
  state: TimelineStepState;
} {
  if (stage.status === 'DONE') {
    return { label: WORKFLOW_STAGE_STATUS_LABELS.DONE, state: 'completed' };
  }
  if (stage.status === 'CANCELLED') {
    return { label: WORKFLOW_STAGE_STATUS_LABELS.CANCELLED, state: 'cancelled' };
  }
  if (stage.status === 'IN_PROGRESS') {
    return {
      label: WORKFLOW_STAGE_STATUS_LABELS.IN_PROGRESS,
      state: 'current',
    };
  }
  if (stage.status === 'READY') {
    return { label: WORKFLOW_STAGE_STATUS_LABELS.READY, state: 'current' };
  }

  const eng = stages.find((item) => item.stage === 'ENGENHARIA');
  const tooling = stages.find((item) => item.stage === 'FERRAMENTARIA');

  if (stage.stage === 'FERRAMENTARIA' && stage.status === 'PENDING') {
    if (eng?.status === 'DONE') {
      return { label: 'Aguardando Ferramentaria', state: 'waiting' };
    }
    return { label: 'Aguardando Engenharia', state: 'upcoming' };
  }

  if (stage.stage === 'AMOSTRA' && stage.status === 'PENDING') {
    if (tooling && tooling.status !== 'DONE' && tooling.status !== 'CANCELLED') {
      return { label: 'Aguardando Ferramentaria', state: 'upcoming' };
    }
    if (eng && eng.status !== 'DONE' && eng.status !== 'CANCELLED') {
      return { label: 'Aguardando Engenharia', state: 'upcoming' };
    }
    return { label: 'Aguardando Amostra', state: 'waiting' };
  }

  if (stage.status === 'PENDING') {
    return { label: WORKFLOW_STAGE_STATUS_LABELS.PENDING, state: 'current' };
  }

  return { label: WORKFLOW_STAGE_STATUS_LABELS.PENDING, state: 'upcoming' };
}

function panelTone(state: TimelineStepState, late: boolean) {
  if (late && state !== 'completed' && state !== 'cancelled') {
    return 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40';
  }
  switch (state) {
    case 'completed':
      return 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/40';
    case 'current':
      return 'border-amber-200 bg-amber-50 shadow-sm dark:border-amber-900 dark:bg-amber-950/40';
    case 'waiting':
      return 'border-violet-200 bg-violet-50/80 dark:border-violet-900 dark:bg-violet-950/40';
    case 'cancelled':
      return 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30';
    default:
      return 'border-border bg-muted/40';
  }
}

function markerTone(state: TimelineStepState, late: boolean) {
  if (late && state !== 'completed' && state !== 'cancelled') {
    return 'bg-rose-600 text-white ring-4 ring-rose-600/15';
  }
  switch (state) {
    case 'completed':
      return 'bg-emerald-600 text-white';
    case 'current':
      return 'bg-amber-500 text-white ring-4 ring-amber-500/20';
    case 'waiting':
      return 'bg-violet-600 text-white ring-4 ring-violet-600/15';
    case 'cancelled':
      return 'bg-rose-600 text-white';
    default:
      return 'bg-background text-muted-foreground ring-1 ring-border';
  }
}

function statusTextTone(state: TimelineStepState, late: boolean) {
  if (late && state !== 'completed' && state !== 'cancelled') {
    return 'text-rose-700 dark:text-rose-300';
  }
  switch (state) {
    case 'completed':
      return 'text-emerald-700 dark:text-emerald-300';
    case 'current':
      return 'text-amber-800 dark:text-amber-300';
    case 'waiting':
      return 'text-violet-700 dark:text-violet-300';
    case 'cancelled':
      return 'text-rose-700 dark:text-rose-300';
    default:
      return 'text-muted-foreground';
  }
}

export function WorkflowTimeline({
  workflow,
  className,
}: {
  workflow: SolicitationWorkflow;
  className?: string;
}) {
  const stages = [...workflow.stages].sort((a, b) => a.order - b.order);

  return (
    <div className={cn('@container w-full', className)}>
      <div
        className='flex flex-col gap-2 @3xl:flex-row @3xl:items-stretch'
        role='list'
      >
        {stages.map((stage, index) => {
          const Icon = STAGE_ICONS[stage.stage];
          const { label, state } = displayStatus(stage, stages);
          const late = isLate(stage);
          const due = formatDate(stage.plannedEndAt);
          const share = formatShare(stage.plannedDurationPercentage);
          const isLast = index === stages.length - 1;
          const isFocus = state === 'current' || state === 'waiting';

          return (
            <Fragment key={stage.id}>
              <article
                role='listitem'
                aria-current={isFocus ? 'step' : undefined}
                className={cn(
                  'flex min-w-0 flex-1 items-start gap-3 rounded-xl border px-3.5 py-3',
                  panelTone(state, late),
                )}
              >
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full',
                    markerTone(state, late),
                  )}
                >
                  {state === 'completed' ? (
                    <Check className='size-4' />
                  ) : state === 'cancelled' ? (
                    <X className='size-4' />
                  ) : (
                    <Icon className='size-4' />
                  )}
                </div>
                <div className='min-w-0 space-y-1'>
                  <p className='text-sm font-semibold leading-none'>
                    {WORKFLOW_STAGE_LABELS[stage.stage]}
                  </p>
                  <p
                    className={cn(
                      'text-xs font-medium leading-snug',
                      statusTextTone(state, late),
                    )}
                  >
                    {late ? `Atrasada · ${label}` : label}
                  </p>
                  {due ? (
                    <p className='text-xs leading-snug text-muted-foreground'>
                      Prazo {due}
                      {share ? ` · ${share}` : ''}
                    </p>
                  ) : null}
                </div>
              </article>
              {!isLast ? (
                <div
                  className='hidden shrink-0 items-center @3xl:flex'
                  aria-hidden
                >
                  <ChevronRight className='size-4 text-muted-foreground/50' />
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

export function workflowHasActiveStage(
  workflow: SolicitationWorkflow | null | undefined,
): boolean {
  return Boolean(
    workflow?.stages.some((stage) => stage.status === 'IN_PROGRESS'),
  );
}

export type { WorkflowStageStatus };
