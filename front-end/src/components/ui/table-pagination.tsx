import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { buildPaginationItems } from './table-pagination-helpers';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

type TablePaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  summary: ReactNode;
  className?: string;
};

export function TablePagination({
  page,
  totalPages,
  onPageChange,
  summary,
  className,
}: TablePaginationProps) {
  const items = buildPaginationItems(page, totalPages);
  const showControls = totalPages > 1;

  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className='text-sm text-muted-foreground tabular-nums'>{summary}</p>
      {showControls ? (
        <Pagination className='mx-0 w-auto justify-end sm:justify-start'>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href='#'
                text='Anterior'
                aria-label='Página anterior'
                aria-disabled={page <= 1}
                className={cn(page <= 1 && 'pointer-events-none opacity-50')}
                onClick={(e) => {
                  e.preventDefault();
                  if (page > 1) onPageChange(page - 1);
                }}
              />
            </PaginationItem>
            {items.map((item, idx) =>
              item === 'ellipsis' ? (
                <PaginationItem key={`e-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    href='#'
                    isActive={item === page}
                    onClick={(e) => {
                      e.preventDefault();
                      onPageChange(item);
                    }}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                href='#'
                text='Próxima'
                aria-label='Próxima página'
                aria-disabled={page >= totalPages}
                className={cn(
                  page >= totalPages && 'pointer-events-none opacity-50',
                )}
                onClick={(e) => {
                  e.preventDefault();
                  if (page < totalPages) onPageChange(page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}
