import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, XCircle } from 'lucide-react';
import { KairoIcon } from '@/components/kairo-icon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export type KairoSendPhase = 'running' | 'success' | 'error';

const SUCCESS_CLOSE_DELAY_MS = 1500;

export function KairoSendProgressDialog({
  open,
  phase,
  errorMessage,
  onClose,
  onRetry,
}: {
  open: boolean;
  phase: KairoSendPhase;
  errorMessage: string | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || phase !== 'running') return;

    let cancelled = false;
    const startId = window.setTimeout(() => {
      if (!cancelled) setProgress(8);
    }, 0);

    const intervalId = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 90) return current;
        const step = current < 50 ? 6 : current < 75 ? 3 : 1;
        return Math.min(90, current + step);
      });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(startId);
      window.clearInterval(intervalId);
    };
  }, [open, phase]);

  useEffect(() => {
    if (phase !== 'success') return;

    const timeoutId = window.setTimeout(
      () => onCloseRef.current(),
      SUCCESS_CLOSE_DELAY_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [phase]);

  const displayProgress =
    phase === 'success' ? 100 : phase === 'error' ? Math.max(progress, 12) : progress;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && phase !== 'running') onClose();
      }}
    >
      <DialogContent
        className="gap-5 sm:max-w-sm"
        showCloseButton={phase === 'error'}
        onPointerDownOutside={(event) => {
          if (phase === 'running' || phase === 'success') event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (phase === 'running' || phase === 'success') event.preventDefault();
        }}
      >
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2">
            <KairoIcon className="size-6" />
            {phase === 'running' && 'Enviando ao Kairo'}
            {phase === 'success' && 'Enviado com sucesso'}
            {phase === 'error' && 'Falha na integração'}
          </DialogTitle>
          <DialogDescription>
            {phase === 'running' && 'Aguarde enquanto a solicitação é enviada.'}
            {phase === 'success' &&
              'A solicitação foi criada no Kairo e vinculada.'}
            {phase === 'error' &&
              (errorMessage ??
                'Não foi possível concluir o envio. Tente novamente.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3" aria-live="polite">
          {phase === 'success' ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <span className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <Check className="size-7" strokeWidth={2.5} />
              </span>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Tudo certo!
              </p>
            </div>
          ) : phase === 'error' ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <XCircle className="size-7" strokeWidth={2.5} />
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          )}

          <div className="space-y-1.5">
            <Progress value={displayProgress} />
            <p
              className={cn(
                'text-center text-xs tabular-nums',
                phase === 'success'
                  ? 'font-medium text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground',
              )}
            >
              {displayProgress}%
            </p>
          </div>
        </div>

        {phase === 'error' && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onRetry}>
              Tentar novamente
            </Button>
            <Button type="button" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
