import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

const OPEN_PHASES = [
  { until: 25, label: 'Preparando abertura do ciclo…' },
  { until: 55, label: 'Sincronizando setores e colaboradores na API base…' },
  { until: 80, label: 'Relacionando colaboradores aos setores…' },
  { until: 95, label: 'Montando participantes do ciclo…' },
] as const;

type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

export function useCycleOpenProgress(status: MutationStatus) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');

  useEffect(() => {
    if (status === 'pending') {
      setProgress(6);
      setPhase(OPEN_PHASES[0].label);

      const timer = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 92) return prev;
          const next = prev + Math.max(0.8, (92 - prev) * 0.055);
          const phaseItem =
            OPEN_PHASES.find((p) => next < p.until) ?? OPEN_PHASES.at(-1);
          if (phaseItem) setPhase(phaseItem.label);
          return next;
        });
      }, 350);

      return () => window.clearInterval(timer);
    }

    if (status === 'success') {
      setProgress(100);
      setPhase('Ciclo aberto');
      const timeout = window.setTimeout(() => {
        setProgress(0);
        setPhase('');
      }, 900);
      return () => window.clearTimeout(timeout);
    }

    if (status === 'error' || status === 'idle') {
      setProgress(0);
      setPhase('');
    }

    return undefined;
  }, [status]);

  return {
    progress,
    phase,
    visible: status === 'pending' || progress > 0,
  };
}

type CycleOpenProgressDialogProps = {
  open: boolean;
  progress: number;
  phase: string;
};

export function CycleOpenProgressDialog({
  open,
  progress,
  phase,
}: CycleOpenProgressDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className='sm:max-w-md'
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Abrindo ciclo</DialogTitle>
          <DialogDescription>
            Sincronizando setores e colaboradores com a API base. Aguarde a
            conclusão.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-3 pt-2'>
          <div className='flex items-center justify-between gap-3 text-sm'>
            <span className='text-muted-foreground'>
              {phase || 'Preparando…'}
            </span>
            <span className='shrink-0 font-medium tabular-nums'>
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
