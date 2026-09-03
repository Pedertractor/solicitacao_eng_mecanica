import type { KairoTagOption } from '@/services/kairo';
import { cn } from '@/lib/utils';

function getContrastingTextColor(hexColor: string): '#000000' | '#FFFFFF' {
  const normalized = hexColor.replace('#', '');
  if (normalized.length !== 6) return '#FFFFFF';

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return '#FFFFFF';
  }

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000000' : '#FFFFFF';
}

export function KairoTagBadge({
  tag,
  className,
}: {
  tag: Pick<KairoTagOption, 'name' | 'color'>;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center truncate rounded-md px-2 py-0.5 text-xs font-medium',
        className,
      )}
      style={{
        backgroundColor: tag.color,
        color: getContrastingTextColor(tag.color),
      }}
      title={tag.name}
    >
      {tag.name}
    </span>
  );
}
