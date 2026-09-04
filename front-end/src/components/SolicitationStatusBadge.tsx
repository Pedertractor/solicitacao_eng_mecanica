import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  SOLICITATION_STATUS_LABELS,
  type SolicitationStatus,
} from '@/services/solicitation';

const SOLICITATION_STATUS_BADGE_CLASS: Record<SolicitationStatus, string> = {
  PENDING:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  IN_REVIEW:
    'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200',
  APPROVED:
    'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200',
  COMPLETED:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  CANCELLED: 'border-border bg-muted text-muted-foreground',
  DELETED:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
};

export function SolicitationStatusBadge({
  status,
}: {
  status: SolicitationStatus;
}) {
  if (status === 'COMPLETED') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'gap-1 font-normal',
          SOLICITATION_STATUS_BADGE_CLASS.COMPLETED,
        )}
      >
        <Check className="size-3" aria-hidden />
        Concluído
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn('font-normal', SOLICITATION_STATUS_BADGE_CLASS[status])}
    >
      {SOLICITATION_STATUS_LABELS[status]}
    </Badge>
  );
}
