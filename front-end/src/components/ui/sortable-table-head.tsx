import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TableHead } from '@/components/ui/table';

type SortOrder = 'asc' | 'desc';

type SortableTableHeadProps<T extends string> = {
  label: string;
  field: T;
  activeField: T;
  activeOrder: SortOrder;
  onSort: (field: T) => void;
  className?: string;
};

export function SortableTableHead<T extends string>({
  label,
  field,
  activeField,
  activeOrder,
  onSort,
  className,
}: SortableTableHeadProps<T>) {
  const isActive = activeField === field;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-sm font-medium transition-colors',
          'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )}
        aria-sort={
          isActive
            ? activeOrder === 'asc'
              ? 'ascending'
              : 'descending'
            : 'none'
        }
      >
        {label}
        {isActive ? (
          activeOrder === 'asc' ? (
            <ArrowUp className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <ArrowDown className="size-3.5 shrink-0" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="size-3.5 shrink-0 opacity-40" aria-hidden />
        )}
      </button>
    </TableHead>
  );
}
