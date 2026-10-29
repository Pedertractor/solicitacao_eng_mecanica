import { Fragment } from 'react';
import { Check, ChevronRight, ChevronDown, ClipboardList, Compass, FlaskConical, ShieldCheck, Wrench, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { workflowPrerequisites } from '@/lib/workflow';
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
  PCP_FERRAMENTARIA: ClipboardList,
  FERRAMENTARIA: Wrench,
  PCP_AMOSTRA: ClipboardList,
  QUALIDADE: ShieldCheck,
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
  if (stage.status === 'DONE' || ['CANCELLED', 'REJECTED'].includes(stage.status)) return false;
  return new Date(stage.plannedEndAt).getTime() < Date.now();
}

function formatShare(value: string | null): {
  label: string;
  amount: number;
} | null {
  if (!value) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const bounded = Math.min(amount, 100);
  const label = Number.isInteger(amount)
    ? String(amount)
    : amount.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return { label: `${label}%`, amount: bounded };
}

function displayStatus(stage: WorkflowStageItem, workflow: SolicitationWorkflow): {
  label: string;
  state: TimelineStepState;
} {
  if (stage.status === 'DONE') {
    return { label: WORKFLOW_STAGE_STATUS_LABELS.DONE, state: 'completed' };
  }
  if (['CANCELLED', 'REJECTED'].includes(stage.status)) {
    return { label: WORKFLOW_STAGE_STATUS_LABELS[stage.status], state: 'cancelled' };
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

  const pending = workflowPrerequisites(workflow, stage.stage).filter((dependency) =>
    !workflow.stages.some((item) => item.stage === dependency && ['DONE', 'REJECTED'].includes(item.status)));
  if (pending.length) return {
    label: `Aguardando ${pending.map((dependency) => WORKFLOW_STAGE_LABELS[dependency]).join(', ')}`,
    state: 'upcoming',
  };
  return { label: WORKFLOW_STAGE_STATUS_LABELS.PENDING, state: 'current' };
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

function barTone(state: TimelineStepState, late: boolean) {
  if (late && state !== 'completed' && state !== 'cancelled') {
    return 'bg-rose-500';
  }
  switch (state) {
    case 'completed':
      return 'bg-emerald-500';
    case 'current':
      return 'bg-amber-500';
    case 'waiting':
      return 'bg-violet-500';
    case 'cancelled':
      return 'bg-rose-500';
    default:
      return 'bg-muted-foreground/40';
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

  const renderStages = (items: WorkflowStageItem[]) => (
      <div
        className='flex flex-col gap-2 @xl:flex-row @xl:items-stretch @xl:gap-0'
        role='list'
      >
        {items.map((stage, index) => {
          const Icon = STAGE_ICONS[stage.stage];
          const { label, state } = displayStatus(stage, workflow);
          const late = isLate(stage);
          const due = formatDate(stage.plannedEndAt);
          const share = formatShare(stage.plannedDurationPercentage);
          const isLast = index === items.length - 1;
          const isFocus = state === 'current' || state === 'waiting';

          return (
            <Fragment key={stage.id}>
              <article
                role='listitem'
                aria-current={isFocus ? 'step' : undefined}
                className={cn(
                  'flex min-w-0 flex-1 flex-col rounded-xl border px-3.5 py-3',
                  panelTone(state, late),
                )}
              >
                <div className='flex items-center gap-2.5'>
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
                  <p className='min-w-0 text-sm font-semibold leading-tight'>
                    {WORKFLOW_STAGE_LABELS[stage.stage]}
                  </p>
                </div>
                <p
                  className={cn(
                    'mt-2.5 text-xs font-medium leading-snug',
                    statusTextTone(state, late),
                  )}
                >
                  {late ? `Atrasada · ${label}` : label}
                </p>
                {stage.status === 'REJECTED' ? (
                  <div className='mt-2 space-y-1 text-xs'>
                    <p className='whitespace-pre-wrap break-words'>{stage.rejectionReason}</p>
                    <p className='text-muted-foreground'>{stage.rejectedByName || stage.rejectedByUserId} · {stage.rejectedAt ? new Date(stage.rejectedAt).toLocaleString('pt-BR') : ''}</p>
                  </div>
                ) : null}
                {due || share ? (
                  <>
                    <div className='min-h-3 flex-1' aria-hidden />
                    <div className='space-y-2 border-t border-black/5 pt-2.5 dark:border-white/10'>
                    {due ? (
                      <p className='text-xs leading-snug text-muted-foreground'>
                        Prazo{' '}
                        <span className='font-medium text-foreground/80'>
                          {due}
                        </span>
                      </p>
                    ) : null}
                    {share ? (
                      <div className='flex items-center gap-2'>
                        <div
                          className='h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10'
                          role='meter'
                          aria-label='Duração planejada'
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(share.amount)}
                        >
                          <div
                            className={cn(
                              'h-full rounded-full',
                              barTone(state, late),
                            )}
                            style={{ width: `${share.amount}%` }}
                          />
                        </div>
                        <span className='shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground'>
                          {share.label}
                        </span>
                      </div>
                    ) : null}
                    </div>
                  </>
                ) : null}
              </article>
              {!isLast ? (
                <div
                  className='relative hidden w-7 shrink-0 items-center @xl:flex'
                  aria-hidden
                >
                  <span className='absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border' />
                  <span className='relative mx-auto flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground'>
                    <ChevronRight className='size-3' />
                  </span>
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
  );
  if (workflow.kind === 'COMMERCIAL_SIMULATION') {
    return <div className={cn('@container w-full space-y-3', className)}>
      {stages.length > 1 && <p className='text-xs font-medium text-muted-foreground'>Em paralelo</p>}
      {stages.map((stage) => <div key={stage.id}>{renderStages([stage])}</div>)}
    </div>;
  }
  const parallel = workflow.requiresTooling && stages.some((stage) => stage.stage === 'PCP_FERRAMENTARIA')
    && stages.some((stage) => stage.stage === 'ENGENHARIA');
  const quality = stages.filter((stage) => stage.stage === 'QUALIDADE');
  const upstream = stages.filter((stage) => !['QUALIDADE', 'AMOSTRA'].includes(stage.stage));
  const renderUpstream = () => parallel ? (
    <div className='space-y-3 rounded-xl border border-dashed p-3'>
      <p className='text-xs font-medium text-muted-foreground'>Em paralelo</p>
      {renderStages(upstream.filter((stage) => stage.stage === 'ENGENHARIA'))}
      {renderStages(upstream.filter((stage) => stage.stage !== 'ENGENHARIA'))}
    </div>
  ) : renderStages(upstream);
  return (
    <div className={cn('@container w-full', className)}>
      {quality.length > 0 ? (
        <div className='space-y-3'>
          {renderUpstream()}
          <div className='space-y-2 rounded-xl border border-dashed p-3'>
            <p className='text-xs font-medium text-muted-foreground'>Frente independente · Disponível desde a criação</p>
            {renderStages(quality)}
          </div>
          <div className='flex items-center justify-center gap-2 text-xs text-muted-foreground'>
            <ChevronDown className='size-4' aria-hidden />
            Amostra após concluir ou recusar as etapas anteriores, incluindo Qualidade · PPAP
          </div>
          {renderStages(stages.filter((stage) => stage.stage === 'AMOSTRA'))}
        </div>
      ) : parallel ? (
        <div className='space-y-3'>
          <div className='space-y-3 rounded-xl border border-dashed p-3'>
            <p className='text-xs font-medium text-muted-foreground'>Em paralelo</p>
            {renderStages(stages.filter((stage) => stage.stage === 'ENGENHARIA'))}
            {renderStages(stages.filter((stage) => !['ENGENHARIA', 'AMOSTRA'].includes(stage.stage)))}
          </div>
          <div className='flex items-center justify-center gap-2 text-xs text-muted-foreground'>
            <ChevronDown className='size-4' aria-hidden />
            Após concluir as duas frentes
          </div>
          {renderStages(stages.filter((stage) => stage.stage === 'AMOSTRA'))}
        </div>
      ) : renderStages(stages)}
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
