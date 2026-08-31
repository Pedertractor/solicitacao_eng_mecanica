import * as React from 'react';
import { cn } from '@/lib/utils';

function Progress({
  className,
  value = 0,
  indeterminate = false,
  ...props
}: React.ComponentProps<'div'> & {
  value?: number;
  indeterminate?: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      data-slot='progress'
      role='progressbar'
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-primary/20',
        className,
      )}
      {...props}
    >
      {indeterminate ? (
        <div className='absolute inset-y-0 w-1/3 animate-[progress-indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-primary' />
      ) : (
        <div
          className='h-full rounded-full bg-primary transition-[width] duration-300 ease-out'
          style={{ width: `${clamped}%` }}
        />
      )}
    </div>
  );
}

export { Progress };
