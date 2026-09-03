import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export const publicSolicitationCardClass =
  'overflow-hidden rounded-xl border-border/60 bg-card/95 shadow-xl shadow-primary/[0.07] backdrop-blur-sm';

export const publicSolicitationTicketCardClass = publicSolicitationCardClass;

/** Cor de fundo da página — usada nos recortes para efeito vazado. */
export const publicSolicitationBackdropClass =
  'bg-gradient-to-br from-slate-100 via-background to-slate-50/90';

type TicketPerforationProps = {
  className?: string;
};

const TICKET_NOTCH_CLASS = 'relative z-10 h-8 w-4 shrink-0';

function TicketNotch({ side }: { side: 'left' | 'right' }) {
  const isLeft = side === 'left';

  return (
    <div
      className={cn(
        TICKET_NOTCH_CLASS,
        publicSolicitationBackdropClass,
        isLeft ? '-ml-px rounded-r-full' : '-mr-px rounded-l-full',
      )}
      aria-hidden
    />
  );
}

export function TicketPerforation({ className }: TicketPerforationProps) {
  return (
    <div
      className={cn(
        'relative flex h-8 w-full shrink-0 items-center select-none',
        className,
      )}
      aria-hidden
    >
      <TicketNotch side='left' />
      <div className='h-px min-w-0 flex-1 bg-[repeating-linear-gradient(to_right,hsl(var(--border)/0.55)_0,hsl(var(--border)/0.55)_4px,transparent_4px,transparent_8px)]' />
      <TicketNotch side='right' />
    </div>
  );
}

type TicketStubProps = {
  children: React.ReactNode;
  className?: string;
};

export function TicketStub({ children, className }: TicketStubProps) {
  return (
    <div
      className={cn(
        'relative min-w-0 shrink-0 overflow-hidden rounded-b-xl',
        className,
      )}
    >
      <TicketPerforation />
      <div className='relative min-w-0 overflow-hidden px-6 pb-5 pt-2'>
        {children}
      </div>
    </div>
  );
}

function FormFooter() {
  return (
    <p className='relative z-10 mt-3 flex shrink-0 flex-wrap items-center justify-center gap-1 px-2 text-center text-[10px] text-muted-foreground/70 break-words'>
      Pedertractor & Tractor - Powered by Programação e Automação Pedertractor
      <Shield className='size-3 shrink-0' aria-hidden />
    </p>
  );
}

type PublicSolicitationShellProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export function PublicSolicitationShell({
  children,
  className,
  contentClassName,
}: PublicSolicitationShellProps) {
  return (
    <div
      className={cn(
        'relative flex h-svh flex-col overflow-hidden p-4',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0',
          publicSolicitationBackdropClass,
        )}
        aria-hidden
      />
      <div
        className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-5%,hsl(var(--primary)/0.09),transparent_65%)]'
        aria-hidden
      />
      <div
        className='pointer-events-none absolute -left-28 top-[12%] size-[22rem] rounded-full bg-primary/[0.05] blur-3xl'
        aria-hidden
      />
      <div
        className='pointer-events-none absolute -right-20 bottom-[8%] size-[26rem] rounded-full bg-sky-400/[0.07] blur-3xl'
        aria-hidden
      />
      <div
        className='pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.45)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.45)_1px,transparent_1px)] bg-size-[2.5rem_2.5rem] mask-[radial-gradient(ellipse_75%_65%_at_50%_42%,#000_25%,transparent_100%)]'
        aria-hidden
      />

      <div
        className={cn(
          'relative z-10 mx-auto flex min-h-0 min-w-0 w-full max-w-lg flex-1 flex-col overflow-x-hidden overflow-y-auto',
          contentClassName,
        )}
      >
        {children}
      </div>

      <FormFooter />
    </div>
  );
}
