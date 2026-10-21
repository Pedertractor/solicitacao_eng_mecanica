import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { surfaceStyles } from '@/lib/surface-styles';

export function PageHero({
  title,
  description,
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  children,
  actions,
  className,
  compact = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  eyebrowIcon?: LucideIcon;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        surfaceStyles.hero,
        compact && 'px-5 py-5 sm:px-6 sm:py-6',
        className,
      )}
    >
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,hsl(var(--primary)/0.08),transparent_32%)]' />
      <div className='pointer-events-none absolute -right-16 -top-24 size-64 rounded-full border border-primary/10' />
      <div className='pointer-events-none absolute -right-6 -top-14 size-40 rounded-full border border-primary/10' />
      <div className='relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='min-w-0'>
          {eyebrow ? (
            <div className={surfaceStyles.eyebrow}>
              {EyebrowIcon ? <EyebrowIcon className='size-3.5' /> : null}
              {eyebrow}
            </div>
          ) : null}
          <h1
            className={cn(
              'font-bold tracking-tight',
              compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl',
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                'mt-2 max-w-2xl text-muted-foreground',
                compact ? 'text-sm' : 'text-sm sm:text-base',
              )}
            >
              {description}
            </p>
          ) : null}
          {children ? <div className='mt-5'>{children}</div> : null}
        </div>
        {actions ? (
          <div className='flex shrink-0 flex-wrap items-center gap-2'>
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
