import { Ellipsis, Play, Star } from 'lucide-react';
import { KairoTagBadge } from '@/components/kairo-tag-badge';
import type { KairoTagOption } from '@/services/kairo';
import type { SolicitationKind } from '@/services/solicitation';
import { cn } from '@/lib/utils';

export function KairoCardPreview({
  title,
  description,
  kind,
  tag,
  estimatedHours,
  className,
}: {
  title: string;
  description: string;
  kind: SolicitationKind;
  tag?: KairoTagOption | null;
  estimatedHours?: string;
  className?: string;
}) {
  const parsedEstimatedHours = estimatedHours?.trim()
    ? Number.parseFloat(estimatedHours)
    : Number.NaN;
  const hasEstimatedHours =
    kind === 'PROJETO' &&
    Number.isFinite(parsedEstimatedHours) &&
    parsedEstimatedHours > 0;

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        Pré-visualização no Kairo
      </p>
      <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 min-w-0 flex-1 text-sm font-medium">
            {title.trim() || 'Título da atividade'}
          </p>
          <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
            <Star className="size-4" />
            <Play className="size-4" />
            <Ellipsis className="size-4" />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {kind === 'ATIVIDADE' &&
            (tag ? (
              <KairoTagBadge tag={tag} className="max-w-28" />
            ) : (
              <span className="inline-flex items-center rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
                Etiqueta
              </span>
            ))}
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            A fazer
          </span>
        </div>

        <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
          {description.trim() || 'Descrição da solicitação…'}
        </p>

        <p className="mt-2 text-xs text-muted-foreground">
          {hasEstimatedHours
            ? `00h 00m / ${parsedEstimatedHours}h estimadas`
            : '00h 00m registradas'}
        </p>
      </div>
    </div>
  );
}
