export const surfaceStyles = {
  container: 'mx-auto w-full max-w-[1600px] space-y-6 pb-8',
  containerNarrow: 'mx-auto w-full max-w-4xl space-y-6 pb-8',
  containerForm: 'mx-auto w-full max-w-2xl space-y-6 pb-8',
  card: 'rounded-2xl border border-border/70 bg-card shadow-sm',
  interactiveCard:
    'rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lg',
  hero: 'relative overflow-hidden rounded-2xl border border-border/70 bg-card px-6 py-7 shadow-sm sm:px-8',
  filterPanel: 'rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5',
  emptyState:
    'rounded-2xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground',
  errorState:
    'rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive',
  countBadge:
    'rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm',
  eyebrow:
    'mb-3 flex w-fit items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur',
  sectionIcon:
    'flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm',
  filterIcon:
    'flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground',
  field: 'h-10 rounded-lg bg-background shadow-none',
  monoCode:
    'rounded-md bg-muted px-2 py-1 font-mono text-[11px] font-semibold tracking-wide text-muted-foreground',
} as const;
