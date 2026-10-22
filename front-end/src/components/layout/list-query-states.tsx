import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { surfaceStyles } from '@/lib/surface-styles';

export function ListLoadingState({
  count = 3,
  heightClass = 'h-44',
  className,
}: {
  count?: number;
  heightClass?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }, (_, key) => (
        <Skeleton key={key} className={cn('rounded-2xl', heightClass)} />
      ))}
    </div>
  );
}

export function ListErrorState({
  children = 'Não foi possível carregar os dados.',
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <div className={cn(surfaceStyles.errorState, className)}>{children}</div>;
}

export function ListEmptyState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(surfaceStyles.emptyState, className)}>{children}</div>;
}
