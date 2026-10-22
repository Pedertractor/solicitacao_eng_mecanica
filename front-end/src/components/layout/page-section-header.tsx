import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { surfaceStyles } from '@/lib/surface-styles';

export function PageSectionHeader({
  title,
  description,
  icon: Icon,
  badge,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3',
        className,
      )}
    >
      <div className='flex min-w-0 items-center gap-2.5'>
        {Icon ? (
          <div className={surfaceStyles.sectionIcon}>
            <Icon className='size-4' />
          </div>
        ) : null}
        <div className='min-w-0'>
          <h2 className='text-lg font-semibold'>{title}</h2>
          {description ? (
            <p className='text-xs text-muted-foreground'>{description}</p>
          ) : null}
        </div>
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        {badge != null && badge !== '' ? (
          <span className={surfaceStyles.countBadge}>{badge}</span>
        ) : null}
        {actions}
      </div>
    </div>
  );
}
