import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        root: 'w-fit',
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'flex w-full flex-col gap-4',
        month_caption: 'relative z-0 flex h-9 items-center justify-center',
        caption_label: 'text-sm font-medium',
        /* Nav é irmão anterior ao .month no DOM; sem z-index o caption pinta por cima e rouba os cliques. */
        nav: 'absolute inset-x-0 top-0 z-20 flex w-full items-center justify-between px-1',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'relative z-30 size-8 bg-transparent p-0 opacity-70 hover:opacity-100',
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'relative z-30 size-8 bg-transparent p-0 opacity-70 hover:opacity-100',
        ),
        month_grid: 'mt-4 w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'w-8 text-center text-[0.8rem] font-normal text-muted-foreground',
        week: 'mt-2 flex w-full',
        day: 'relative flex h-8 w-8 items-center justify-center p-0 text-center text-sm',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-8 p-0 font-normal',
        ),
        selected:
          '[&_button]:bg-primary [&_button]:text-primary-foreground [&_button]:hover:bg-primary [&_button]:hover:text-primary-foreground rounded-md',
        range_start:
          '[&_button]:bg-primary [&_button]:text-primary-foreground [&_button]:hover:bg-primary [&_button]:hover:text-primary-foreground rounded-md',
        range_end:
          '[&_button]:bg-primary [&_button]:text-primary-foreground [&_button]:hover:bg-primary [&_button]:hover:text-primary-foreground rounded-md',
        range_middle:
          '[&_button]:bg-accent [&_button]:text-accent-foreground [&_button]:hover:bg-accent [&_button]:hover:text-accent-foreground',
        today: 'rounded-md [&_button]:bg-accent [&_button]:text-accent-foreground',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chClassName, ...rest }) => {
          const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
          return <Icon className={cn('h-4 w-4', chClassName)} {...rest} />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
