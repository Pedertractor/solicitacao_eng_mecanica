import { Fragment, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, Clock3, Factory, UserRound, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OfProcess } from '@/services/of';

const UNIT_LABELS: Record<string, string> = {
  PEDERTRACTOR: 'Pedertractor',
  TRACTOR: 'Tractor',
};

type ProcessStepState = 'completed' | 'current' | 'pending';

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return null;
  }
}

/** Prefers API-base BR label (DTH_INI_BR), then ISO fields. */
function formatProcessStart(process: OfProcess | null | undefined): string | null {
  if (!process) return null;
  const br = process.DTH_INI_BR?.trim();
  if (br) return br;
  return (
    formatDateTime(process.DTH_INI) ??
    formatDateTime(process.startedAt) ??
    formatDateTime(process.pointedAt) ??
    formatDateTime(process.processDate)
  );
}

function processMoment(process: OfProcess | null | undefined): string | null {
  if (!process) return null;
  return (
    process.DTH_INI ??
    process.finishedAt ??
    process.startedAt ??
    process.pointedAt ??
    process.processDate ??
    null
  );
}

function formatEmployee(process: OfProcess) {
  if (!process.employeeName && !process.employeeCard) return null;
  if (process.employeeName && process.employeeCard) {
    return `${process.employeeName} (${process.employeeCard})`;
  }
  return process.employeeName ?? process.employeeCard;
}

function formatUnit(unit: string | null) {
  if (!unit) return null;
  return UNIT_LABELS[unit] ?? unit;
}

function sectorLabel(process: OfProcess | null | undefined) {
  if (!process) return null;
  return process.nameSector?.trim() || `CC ${process.costCenter}`;
}

function progressRatio(process: OfProcess) {
  if (!process.QTD || process.QTD <= 0) {
    return process.QTD_APT > 0 ? 1 : 0;
  }
  return Math.min(1, Math.max(0, process.QTD_APT / process.QTD));
}

function stepState(
  process: OfProcess,
  index: number,
  processes: OfProcess[],
): ProcessStepState {
  const ratio = progressRatio(process);
  const status = (process.processStatus ?? '').toLowerCase();

  if (ratio >= 1 || status.includes('conclu') || status.includes('final')) {
    return 'completed';
  }
  if (
    ratio > 0 ||
    status.includes('produz') ||
    status.includes('andamento') ||
    Boolean(process.DTH_INI || process.pointedAt)
  ) {
    return 'current';
  }

  const previousDone = processes
    .slice(0, index)
    .every((item) => progressRatio(item) >= 1);
  if (previousDone) return 'current';
  return 'pending';
}

function stateLabel(state: ProcessStepState, process: OfProcess) {
  if (process.processStatus?.trim()) return process.processStatus.trim();
  if (state === 'completed') return 'Concluído';
  if (state === 'current') return 'Em andamento';
  return 'Pendente';
}

function panelTone(state: ProcessStepState) {
  switch (state) {
    case 'completed':
      return 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/40';
    case 'current':
      return 'border-amber-200 bg-amber-50 shadow-sm dark:border-amber-900 dark:bg-amber-950/40';
    default:
      return 'border-border bg-muted/30';
  }
}

function markerTone(state: ProcessStepState) {
  switch (state) {
    case 'completed':
      return 'bg-emerald-600 text-white';
    case 'current':
      return 'bg-amber-500 text-white ring-4 ring-amber-500/20';
    default:
      return 'bg-background text-muted-foreground ring-1 ring-border';
  }
}

function statusTextTone(state: ProcessStepState) {
  switch (state) {
    case 'completed':
      return 'text-emerald-700 dark:text-emerald-300';
    case 'current':
      return 'text-amber-800 dark:text-amber-300';
    default:
      return 'text-muted-foreground';
  }
}

export function OfProcessTimeline({ processes }: { processes: OfProcess[] }) {
  const ordered = useMemo(
    () => [...processes].sort((a, b) => a.OP - b.OP),
    [processes],
  );

  const summary = useMemo(() => {
    const completed = ordered.filter(
      (item, index) => stepState(item, index, ordered) === 'completed',
    ).length;

    const lastActiveProcess = [...ordered]
      .filter(
        (item) =>
          Boolean(processMoment(item)) || progressRatio(item) > 0,
      )
      .sort((a, b) => {
        const aTime = processMoment(a)
          ? new Date(processMoment(a)!).getTime()
          : 0;
        const bTime = processMoment(b)
          ? new Date(processMoment(b)!).getTime()
          : 0;
        if (aTime !== bTime) return bTime - aTime;
        return b.OP - a.OP;
      })[0];

    const pendingProcess =
      ordered.find(
        (item, index) => stepState(item, index, ordered) !== 'completed',
      ) ?? null;

    const lastEmployee = lastActiveProcess
      ? formatEmployee(lastActiveProcess)
      : null;

    return {
      total: ordered.length,
      completed,
      lastActiveProcess,
      lastSector: sectorLabel(lastActiveProcess),
      lastCostCenter: lastActiveProcess?.costCenter ?? null,
      lastMoment: processMoment(lastActiveProcess),
      lastStartedLabel: formatProcessStart(lastActiveProcess),
      lastEmployee,
      lastQty:
        lastActiveProcess != null
          ? `${lastActiveProcess.QTD_APT}/${lastActiveProcess.QTD}`
          : null,
      pendingProcess,
      pendingSector: sectorLabel(pendingProcess),
      pendingCostCenter: pendingProcess?.costCenter ?? null,
      allDone: pendingProcess == null && ordered.length > 0,
    };
  }, [ordered]);

  return (
    <div className='space-y-5'>
      <div className='grid gap-3 sm:grid-cols-3'>
        <div className='rounded-xl border bg-card px-4 py-3'>
          <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
            Operações
          </p>
          <p className='mt-1 text-2xl font-semibold tabular-nums'>
            {summary.completed}
            <span className='text-base font-normal text-muted-foreground'>
              /{summary.total}
            </span>
          </p>
          <p className='mt-0.5 text-xs text-muted-foreground'>concluídas</p>
        </div>
        <div className='rounded-xl border bg-card px-4 py-3'>
          <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
            Última operação
          </p>
          {summary.lastActiveProcess ? (
            <>
              <p className='mt-1 text-sm font-semibold leading-snug'>
                {summary.lastSector}
              </p>
              <p className='mt-0.5 text-xs tabular-nums text-muted-foreground'>
                {summary.lastStartedLabel
                  ? `Início: ${summary.lastStartedLabel}`
                  : 'Data/hora não informada'}
              </p>
              <p className='mt-1 text-xs text-muted-foreground'>
                CC {summary.lastCostCenter}
                {summary.lastQty ? ` · ${summary.lastQty} pcs` : ''}
                {summary.lastEmployee ? ` · ${summary.lastEmployee}` : ''}
              </p>
            </>
          ) : (
            <>
              <p className='mt-1 text-sm font-semibold leading-snug'>
                Sem operação registrada
              </p>
              <p className='mt-0.5 text-xs text-muted-foreground'>
                nenhuma data/hora disponível ainda
              </p>
            </>
          )}
        </div>
        <div
          className={cn(
            'rounded-xl border px-4 py-3',
            summary.allDone
              ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/40'
              : 'border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/40',
          )}
        >
          <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
            {summary.allDone ? 'Situação atual' : 'Pendente agora'}
          </p>
          {summary.allDone ? (
            <>
              <p className='mt-1 text-sm font-semibold leading-snug text-emerald-800 dark:text-emerald-300'>
                OF concluída
              </p>
              <p className='mt-0.5 text-xs text-muted-foreground'>
                todos os processos foram apontados
              </p>
            </>
          ) : summary.pendingProcess ? (
            <>
              <p className='mt-1 text-sm font-semibold leading-snug'>
                {summary.pendingSector}
              </p>
              <p className='mt-0.5 text-xs text-muted-foreground'>
                aguardando apontamento
                {summary.pendingCostCenter
                  ? ` · CC ${summary.pendingCostCenter}`
                  : ''}
              </p>
              <p className='mt-1 text-xs text-muted-foreground'>
                {summary.pendingProcess.QTD_APT}/{summary.pendingProcess.QTD}{' '}
                pcs
                {summary.lastSector
                  ? ` · veio de ${summary.lastSector}`
                  : ''}
              </p>
            </>
          ) : (
            <>
              <p className='mt-1 text-sm font-semibold leading-snug'>—</p>
              <p className='mt-0.5 text-xs text-muted-foreground'>
                sem processo pendente
              </p>
            </>
          )}
        </div>
      </div>

      <div className='relative space-y-0' role='list'>
        {ordered.map((process, index) => {
          const state = stepState(process, index, ordered);
          const ratio = progressRatio(process);
          const percent = Math.round(ratio * 100);
          const employee = formatEmployee(process);
          const unit = formatUnit(process.employeeUnit);
          const startedLabel = formatProcessStart(process);
          const finishedAt = formatDateTime(process.finishedAt);
          const isLast = index === ordered.length - 1;

          return (
            <Fragment key={`${process.OF}-${process.OP}-${process.costCenter}`}>
              <article
                role='listitem'
                aria-current={state === 'current' ? 'step' : undefined}
                className='relative flex gap-4 pb-6 last:pb-0'
              >
                <div className='relative flex w-10 shrink-0 flex-col items-center'>
                  <div
                    className={cn(
                      'z-10 flex size-10 items-center justify-center rounded-full',
                      markerTone(state),
                    )}
                  >
                    {state === 'completed' ? (
                      <Check className='size-4' />
                    ) : state === 'current' ? (
                      <Factory className='size-4' />
                    ) : (
                      <Clock3 className='size-4' />
                    )}
                  </div>
                  {!isLast ? (
                    <div
                      className={cn(
                        'absolute top-10 bottom-0 w-px',
                        state === 'completed'
                          ? 'bg-emerald-400/70'
                          : 'bg-border',
                      )}
                      aria-hidden
                    />
                  ) : null}
                </div>

                <div
                  className={cn(
                    'min-w-0 flex-1 rounded-xl border px-4 py-3.5',
                    panelTone(state),
                  )}
                >
                  <div className='flex flex-wrap items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      <p className='text-sm font-semibold'>
                        {process.nameSector?.trim() ||
                          `CC ${process.costCenter}`}
                      </p>
                      <p
                        className={cn(
                          'mt-1 text-xs font-medium',
                          statusTextTone(state),
                        )}
                      >
                        {stateLabel(state, process)}
                        {process.statusDetail
                          ? ` · ${process.statusDetail}`
                          : ''}
                      </p>
                      <p className='mt-1 text-xs tabular-nums text-muted-foreground'>
                        {startedLabel ? (
                          <span>Início: {startedLabel}</span>
                        ) : (
                          <span>Data/hora não informada</span>
                        )}
                      </p>
                    </div>
                    <div className='text-right text-xs tabular-nums text-muted-foreground'>
                      <p>
                        {process.QTD_APT}/{process.QTD} pcs
                      </p>
                      <p className='font-medium text-foreground'>{percent}%</p>
                    </div>
                  </div>

                  <div className='mt-3 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10'>
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width]',
                        state === 'completed'
                          ? 'bg-emerald-500'
                          : state === 'current'
                            ? 'bg-amber-500'
                            : 'bg-muted-foreground/40',
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <dl className='mt-3 grid gap-2 text-xs sm:grid-cols-2'>
                    <div className='flex items-start gap-2'>
                      <Clock3 className='mt-0.5 size-3.5 shrink-0 text-muted-foreground' />
                      <div>
                        <dt className='text-muted-foreground'>Início</dt>
                        <dd className='font-medium tabular-nums text-foreground'>
                          {startedLabel ?? 'Data/hora não informada'}
                        </dd>
                      </div>
                    </div>

                    {finishedAt ? (
                      <div className='flex items-start gap-2'>
                        <Check className='mt-0.5 size-3.5 shrink-0 text-muted-foreground' />
                        <div>
                          <dt className='text-muted-foreground'>Fim</dt>
                          <dd className='font-medium tabular-nums text-foreground'>
                            {finishedAt}
                          </dd>
                        </div>
                      </div>
                    ) : null}

                    <div className='flex items-start gap-2'>
                      <UserRound className='mt-0.5 size-3.5 shrink-0 text-muted-foreground' />
                      <div>
                        <dt className='text-muted-foreground'>Colaborador</dt>
                        <dd className='font-medium text-foreground'>
                          {employee ?? '—'}
                          {unit ? ` · ${unit}` : ''}
                        </dd>
                      </div>
                    </div>

                    <div className='flex items-start gap-2'>
                      <Wrench className='mt-0.5 size-3.5 shrink-0 text-muted-foreground' />
                      <div>
                        <dt className='text-muted-foreground'>
                          Centro / máquina
                        </dt>
                        <dd className='font-medium text-foreground'>
                          CC {process.costCenter}
                          {process.machine ? ` · ${process.machine}` : ''}
                        </dd>
                      </div>
                    </div>
                  </dl>

                  {(process.pointedMinutes != null ||
                    process.totalMinutes != null) && (
                    <p className='mt-3 text-xs text-muted-foreground'>
                      Tempo apontado:{' '}
                      <span className='font-medium text-foreground'>
                        {process.pointedMinutes ?? 0} min
                      </span>
                      {process.totalMinutes != null
                        ? ` de ${process.totalMinutes} min`
                        : ''}
                    </p>
                  )}
                </div>
              </article>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
