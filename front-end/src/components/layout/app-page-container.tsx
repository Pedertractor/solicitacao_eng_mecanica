import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { surfaceStyles } from '@/lib/surface-styles';

export function AppPageContainer({
  children,
  className,
  width = 'default',
}: {
  children: ReactNode;
  className?: string;
  width?: 'default' | 'narrow' | 'form';
}) {
  return (
    <div
      className={cn(
        width === 'narrow'
          ? surfaceStyles.containerNarrow
          : width === 'form'
            ? surfaceStyles.containerForm
            : surfaceStyles.container,
        className,
      )}
    >
      {children}
    </div>
  );
}
