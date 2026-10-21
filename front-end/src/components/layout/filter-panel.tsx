import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { surfaceStyles } from '@/lib/surface-styles';

export function FilterPanel({
  children,
  title = 'Filtros',
  description = 'Refine os resultados',
  activeCount = 0,
  onClear,
  className,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  activeCount?: number;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <section className={cn(surfaceStyles.filterPanel, className)}>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2.5'>
          <div className={surfaceStyles.filterIcon}>
            <SlidersHorizontal className='size-4' />
          </div>
          <div>
            <h2 className='text-sm font-semibold'>{title}</h2>
            <p className='text-xs text-muted-foreground'>{description}</p>
          </div>
        </div>
        {activeCount > 0 && onClear ? (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='text-muted-foreground'
            onClick={onClear}
          >
            <RotateCcw className='size-3.5' />
            Limpar {activeCount}{' '}
            {activeCount === 1 ? 'filtro' : 'filtros'}
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  );
}
