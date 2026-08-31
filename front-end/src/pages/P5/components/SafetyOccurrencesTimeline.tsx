import { useState } from 'react';
import { ChevronDown, Shield } from 'lucide-react';
import type { AccidentStatus, AccidentType } from '@/services/p5';
import { accidentTypeLabel } from '@/utils/status-labels';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type SafetyOccurrenceItem = {
  id: string;
  accidentType: AccidentType;
  occurredAt: string;
  daysAway: number | null;
  description: string | null;
  status: AccidentStatus;
  pointsLost: number;
  employeeName?: string;
};

type SafetyOccurrencesTimelineProps = {
  occurrences: SafetyOccurrenceItem[];
  isLoading?: boolean;
  className?: string;
  /** When false, the timeline starts collapsed. Default true. */
  defaultOpen?: boolean;
};

export function SafetyOccurrencesTimeline({
  occurrences,
  isLoading = false,
  className,
  defaultOpen = true,
}: SafetyOccurrencesTimelineProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn('space-y-3', className)}>
      <div className='flex items-center justify-between gap-2'>
        <h3 className='text-sm font-medium'>Linha do tempo das ocorrências</h3>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          {open ? 'Ocultar' : 'Mostrar'}
          <ChevronDown
            className={cn(
              'size-4 transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </Button>
      </div>
      {open ? (
        isLoading ? (
          <p className='text-sm text-muted-foreground'>Carregando…</p>
        ) : occurrences.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            Nenhuma ocorrência registrada neste ciclo.
          </p>
        ) : (
          <ol className='relative ml-2 space-y-0 border-l border-border'>
            {occurrences.map((occurrence) => (
              <li
                key={occurrence.id}
                className='relative flex items-center gap-3 pb-4 pl-5 pr-3 last:pb-0'
              >
                <span
                  className='absolute top-1.5 left-0 size-2.5 -translate-x-1/2 rounded-full bg-foreground'
                  aria-hidden
                />
                <div className='min-w-0 flex-1'>
                  <span className='inline-flex min-w-0 items-center gap-1.5'>
                    <Shield
                      className='size-3.5 shrink-0 text-[#08751a]'
                      aria-hidden
                    />
                    <span className='text-sm font-medium'>Segurança</span>
                  </span>
                  <p className='text-xs text-muted-foreground'>
                    {new Date(occurrence.occurredAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' · '}
                    {accidentTypeLabel(occurrence.accidentType).toLowerCase()}
                    {occurrence.employeeName ? (
                      <>
                        {' · '}
                        {occurrence.employeeName}
                      </>
                    ) : null}
                  </p>
                  {occurrence.description ? (
                    <p className='mt-1 text-xs text-muted-foreground'>
                      {occurrence.description}
                    </p>
                  ) : null}
                </div>
                <span className='shrink-0 text-xs tabular-nums text-destructive'>
                  {occurrence.pointsLost > 0
                    ? `−${occurrence.pointsLost}`
                    : '0'}
                </span>
              </li>
            ))}
          </ol>
        )
      ) : null}
    </section>
  );
}
