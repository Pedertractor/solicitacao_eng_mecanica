import { cn } from '@/lib/utils';

/** Cor de fundo da plataforma — usada nos recortes para efeito vazado. */
export const platformBackdropClass =
  'bg-gradient-to-br from-slate-100 via-background to-slate-50/90';

type PlatformBackdropProps = {
  className?: string;
};

export function PlatformBackdrop({ className }: PlatformBackdropProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        className,
      )}
      aria-hidden
    >
      <div className={cn('absolute inset-0', platformBackdropClass)} />
      <div className='absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-5%,hsl(var(--primary)/0.09),transparent_65%)]' />
      <div className='absolute -left-28 top-[12%] size-[22rem] rounded-full bg-primary/[0.05] blur-3xl' />
      <div className='absolute -right-20 bottom-[8%] size-[26rem] rounded-full bg-sky-400/[0.07] blur-3xl' />
      <div className='absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.45)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.45)_1px,transparent_1px)] bg-size-[2.5rem_2.5rem] mask-[radial-gradient(ellipse_75%_65%_at_50%_42%,#000_25%,transparent_100%)]' />
    </div>
  );
}

type PlatformPageShellProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  overlay?: React.ReactNode;
};

export function PlatformPageShell({
  children,
  className,
  contentClassName,
  overlay,
}: PlatformPageShellProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-svh w-full max-w-full flex-col overflow-x-hidden',
        className,
      )}
    >
      <PlatformBackdrop />
      {overlay}
      <div className={cn('relative z-10 flex min-h-0 flex-1 flex-col', contentClassName)}>
        {children}
      </div>
    </div>
  );
}
