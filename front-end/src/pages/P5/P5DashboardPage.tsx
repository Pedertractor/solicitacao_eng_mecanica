import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarOff,
  CircleDollarSign,
  Factory,
  type LucideIcon,
  Shield,
  Sparkles,
} from 'lucide-react';
import { p5Api, type CycleStatus, type ProgramYearOverview } from '@/services/p5';
import { useAuth } from '@/contexts/useAuth';
import { useP5Permissions } from '@/hooks/useP5Permissions';
import type { PillarCode } from '@/config/pillars';
import { p5CyclePath, ROUTES } from '@/routes/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CYCLE_STATUS_LABELS } from '@/utils/status-labels';
import {
  centsToUnits,
  computePercentCents,
  divFloor,
  formatPoints,
  sumCents,
  toCents,
} from '@/utils/p5-number';

const CYCLE_FILTER_ALL = 'ALL';
const OVERVIEW_TIME_ZONE = 'America/Sao_Paulo';

function calendarYearMonthInSaoPaulo(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: OVERVIEW_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
  };
}

function currentMonthCycleId(
  cycles: Array<{ id: string; year: number; month: number }>,
) {
  const { year, month } = calendarYearMonthInSaoPaulo();
  return cycles.find((cycle) => cycle.year === year && cycle.month === month)
    ?.id ?? null;
}

/** % fictícias baixas só para pré-visualizar o panorama (`?simular=1`). */
const SIMULATED_PILLAR_PERCENTS: Record<string, number> = {
  SAFETY: 18,
  PRODUCTIVITY: 42,
  QUALITY_5S: 12,
  ABSENTEEISM: 28,
  REVENUE: 35,
};

const MONTH_LABELS = [
  '',
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

const PILLAR_META: Record<
  string,
  {
    icon: LucideIcon;
    color: string;
    softColor: string;
    barColor: string;
  }
> = {
  SAFETY: {
    icon: Shield,
    color: 'text-[#08751a]',
    softColor: 'bg-[#08751a]/10',
    barColor: 'bg-[#08751a]',
  },
  PRODUCTIVITY: {
    icon: Factory,
    color: 'text-[#003fb4]',
    softColor: 'bg-[#003fb4]/10',
    barColor: 'bg-[#003fb4]',
  },
  QUALITY_5S: {
    icon: Sparkles,
    color: 'text-[#4b008f]',
    softColor: 'bg-[#4b008f]/10',
    barColor: 'bg-[#4b008f]',
  },
  ABSENTEEISM: {
    icon: CalendarOff,
    color: 'text-[#f0440b]',
    softColor: 'bg-[#f0440b]/10',
    barColor: 'bg-[#f0440b]',
  },
  REVENUE: {
    icon: CircleDollarSign,
    color: 'text-[#006d82]',
    softColor: 'bg-[#006d82]/10',
    barColor: 'bg-[#006d82]',
  },
};

/** Largura da barra: limita visualmente em 0–100 sem alterar o valor exibido. */
function barWidthPercent(value: number): number {
  if (value <= 0) return 0;
  if (value >= 100) return 100;
  return value;
}

function P5RadialGauge({
  value,
  hasScore,
}: {
  value: number;
  hasScore: boolean;
}) {
  const radius = 48;
  const progress = hasScore ? barWidthPercent(value) : 0;

  return (
    <div
      className='relative size-28'
      role='progressbar'
      aria-label={
        hasScore ? `Resultado P5: ${formatPoints(value)}%` : 'Resultado P5 indisponível'
      }
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={hasScore ? progress : undefined}
    >
      <svg
        className='size-full -rotate-90'
        viewBox='0 0 112 112'
        aria-hidden='true'
      >
        <circle
          cx='56'
          cy='56'
          r={radius}
          fill='none'
          className='stroke-foreground/15'
          strokeWidth='5'
        />
        <circle
          cx='56'
          cy='56'
          r={radius}
          fill='none'
          className='stroke-muted-foreground'
          strokeWidth='5'
          strokeLinecap='round'
          pathLength='100'
          strokeDasharray={`${progress} ${100 - progress}`}
        >
          <animate
            attributeName='stroke-dasharray'
            from='0 100'
            to={`${progress} ${100 - progress}`}
            dur='800ms'
            fill='freeze'
            calcMode='spline'
            keySplines='0.22 1 0.36 1'
          />
        </circle>
      </svg>
      <div className='absolute inset-0 flex items-center justify-center'>
        <span className='text-2xl font-medium tabular-nums tracking-tight'>
          {hasScore ? formatPoints(value) : '—'}
        </span>
        {hasScore ? (
          <span className='ml-0.5 text-sm font-medium text-muted-foreground'>
            %
          </span>
        ) : null}
      </div>
    </div>
  );
}

function buildPanorama(
  overview: ProgramYearOverview,
  options?: { simulateLow?: boolean; cycleId?: string | null },
) {
  const simulateLow = Boolean(options?.simulateLow);
  const selectedCycle =
    options?.cycleId != null && options.cycleId !== ''
      ? (overview.cycles.find((c) => c.id === options.cycleId) ?? null)
      : null;

  // Visão de um ciclo específico (ignora simulação de ano).
  if (selectedCycle && !simulateLow) {
    const maxInProgress = overview.monthlyBasePoints;
    const maxInProgressCents = toCents(maxInProgress);
    const hasScore = selectedCycle.factoryScore != null;

    const pillars = overview.pillars.map((pillar) => {
      const maxInProgressPillar = pillar.maxPointsMonthly;
      const maxInProgressPillarCents = toCents(maxInProgressPillar);
      const weightPercent = computePercentCents(
        toCents(pillar.maxPointsMonthly),
        toCents(overview.monthlyBasePoints),
      );

      if (!hasScore) {
        return {
          ...pillar,
          points: 0,
          percent: 0,
          weightPercent,
          maxInProgress: maxInProgressPillar,
        };
      }

      const pointsCents =
        pillar.code === 'SAFETY'
          ? toCents(selectedCycle.safetyPoints ?? pillar.maxPointsMonthly)
          : maxInProgressPillarCents;
      const points = centsToUnits(pointsCents);

      return {
        ...pillar,
        points,
        percent: computePercentCents(pointsCents, maxInProgressPillarCents),
        weightPercent,
        maxInProgress: maxInProgressPillar,
      };
    });

    const scoreCents = hasScore
      ? sumCents(pillars.map((pillar) => toCents(pillar.points)))
      : 0;
    const score = centsToUnits(scoreCents);

    return {
      overallPercent: hasScore
        ? computePercentCents(scoreCents, maxInProgressCents)
        : 0,
      maxInProgress,
      score,
      pillars,
      simulated: false,
      scope: 'cycle' as const,
      cycle: selectedCycle,
      hasScore,
    };
  }

  const scoredCycles = Math.max(overview.scoredCyclesCount, simulateLow ? 1 : 0);
  const maxInProgress =
    scoredCycles * overview.monthlyBasePoints || overview.monthlyBasePoints;
  const maxInProgressCents = toCents(maxInProgress);

  const pillars = overview.pillars.map((pillar) => {
    const maxInProgressPillar =
      scoredCycles === 0
        ? pillar.maxPointsMonthly
        : pillar.maxPointsMonthly * scoredCycles;
    const maxInProgressPillarCents = toCents(maxInProgressPillar);
    const weightPercent = computePercentCents(
      toCents(pillar.maxPointsMonthly),
      toCents(overview.monthlyBasePoints),
    );

    if (simulateLow) {
      const percent = SIMULATED_PILLAR_PERCENTS[pillar.code] ?? 25;
      const pointsCents = divFloor(
        maxInProgressPillarCents * percent,
        100,
      );
      const points = centsToUnits(pointsCents);
      return {
        ...pillar,
        points,
        percent,
        weightPercent,
        maxInProgress: maxInProgressPillar,
      };
    }

    const pointsCents = toCents(pillar.annualPoints ?? 0);
    const points = centsToUnits(pointsCents);
    const percent =
      scoredCycles === 0 || maxInProgressPillarCents === 0
        ? 0
        : computePercentCents(pointsCents, maxInProgressPillarCents);

    return {
      ...pillar,
      points,
      percent,
      weightPercent,
      maxInProgress: maxInProgressPillar,
    };
  });

  const scoreCents =
    scoredCycles === 0 && !simulateLow
      ? 0
      : sumCents(pillars.map((pillar) => toCents(pillar.points)));
  const score = centsToUnits(scoreCents);
  const overallPercent =
    scoredCycles === 0 && !simulateLow
      ? 0
      : computePercentCents(scoreCents, maxInProgressCents);

  return {
    overallPercent,
    maxInProgress,
    score,
    pillars,
    simulated: simulateLow,
    scope: 'year' as const,
    cycle: null,
    hasScore: scoredCycles > 0 || simulateLow,
  };
}

function statusBadgeVariant(
  status: CycleStatus,
): 'default' | 'secondary' | 'outline' {
  if (status === 'OPEN' || status === 'CALCULATED') return 'default';
  if (status === 'DRAFT') return 'outline';
  return 'secondary';
}

export function P5DashboardPage() {
  const { user } = useAuth();
  const { canAccessP5, canViewPillar, canSimulateAccidents, scopeKey } =
    useP5Permissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const simulateLow = searchParams.get('simular') === '1';
  const cycleIdFromUrl = searchParams.get('cycleId') ?? '';

  const { data: programs = [], isLoading: loadingPrograms } = useQuery({
    queryKey: ['p5', 'program-years', scopeKey],
    queryFn: () => p5Api.listProgramYears(),
    enabled: Boolean(user && canAccessP5),
  });

  const activeProgram =
    programs.find((p) => p.active) ?? programs[0] ?? null;

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['p5', 'overview', activeProgram?.id, scopeKey],
    queryFn: () => p5Api.getProgramYearOverview(activeProgram!.id),
    enabled:
      Boolean(activeProgram) && Boolean(user && canAccessP5),
  });

  const selectedCycleId = useMemo(() => {
    if (cycleIdFromUrl === CYCLE_FILTER_ALL) {
      return CYCLE_FILTER_ALL;
    }
    if (
      cycleIdFromUrl &&
      overview?.cycles.some((c) => c.id === cycleIdFromUrl)
    ) {
      return cycleIdFromUrl;
    }
    return currentMonthCycleId(overview?.cycles ?? []) ?? CYCLE_FILTER_ALL;
  }, [cycleIdFromUrl, overview?.cycles]);

  const panorama = useMemo(() => {
    if (!overview) return null;
    const built = buildPanorama(overview, {
      simulateLow,
      cycleId: selectedCycleId === CYCLE_FILTER_ALL ? null : selectedCycleId,
    });
    if (!built) return null;
    return {
      ...built,
      pillars: built.pillars.filter((pillar) =>
        canViewPillar(pillar.code as PillarCode),
      ),
    };
  }, [overview, simulateLow, selectedCycleId, canViewPillar]);

  if (!user || !canAccessP5) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  const currentCycle =
    overview?.cycles.find((c) => c.status === 'OPEN') ??
    overview?.cycles.find((c) => c.status === 'CALCULATED') ??
    null;

  function patchSearchParams(mutate: (next: URLSearchParams) => void) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        mutate(next);
        return next;
      },
      { replace: true },
    );
  }

  function toggleSimulate() {
    patchSearchParams((next) => {
      if (next.get('simular') === '1') next.delete('simular');
      else next.set('simular', '1');
    });
  }

  function setCycleFilter(value: string) {
    patchSearchParams((next) => {
      next.set('cycleId', value);
    });
  }

  const loading = loadingPrograms || loadingOverview;

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1>Programa P5</h1>
          <p className='text-muted-foreground'>
            Visão geral do ano — junção dos 12 ciclos (até 100 pts/mês, 1.200 no
            ano). Resultados de Segurança são parciais até os demais pilares.
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          {canSimulateAccidents ? (
            <Button
              type='button'
              variant={simulateLow ? 'default' : 'outline'}
              onClick={toggleSimulate}
            >
              {simulateLow ? 'Saindo da simulação' : 'Simular % baixas'}
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className='text-muted-foreground'>Carregando…</p>
      ) : !overview ? (
        <Card className='gap-2 py-4'>
          <CardContent className='px-4 py-2'>
            <p className='text-sm text-muted-foreground'>
              Nenhum programa anual encontrado. Crie um programa nas
              configurações.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className='grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4'>
            <Card className='gap-2 py-4'>
              <CardHeader className='px-4'>
                <CardTitle className='text-sm'>Programa</CardTitle>
              </CardHeader>
              <CardContent className='flex items-center justify-between gap-3 px-4'>
                <p className='truncate font-medium'>
                  {overview.programYear.name}
                </p>
                <Badge className='shrink-0' variant='secondary'>
                  {overview.programYear.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </CardContent>
            </Card>

            <Card className='gap-2 py-4'>
              <CardHeader className='px-4'>
                <CardTitle className='text-sm'>Ciclos do ano</CardTitle>
              </CardHeader>
              <CardContent className='flex items-center justify-between gap-3 px-4'>
                <p className='text-2xl font-semibold tabular-nums leading-none'>
                  {overview.cyclesCount}
                  <span className='ml-1 text-sm font-normal text-muted-foreground'>
                    / {overview.cyclesExpected}
                  </span>
                </p>
                <Badge className='shrink-0' variant='outline'>
                  {overview.scoredCyclesCount} em curso
                </Badge>
              </CardContent>
            </Card>

            <Card className='gap-2 py-4'>
              <CardHeader className='px-4'>
                <CardTitle className='text-sm'>Pontuação acumulada</CardTitle>
              </CardHeader>
              <CardContent className='flex items-center justify-between gap-3 px-4'>
                <p className='text-2xl font-semibold tabular-nums leading-none'>
                  {formatPoints(
                    panorama?.scope === 'cycle'
                      ? (panorama.score ?? 0)
                      : overview.scoredCyclesCount === 0
                        ? 0
                        : (panorama?.score ?? overview.annualFactoryScore),
                  )}
                  <span className='ml-1 text-sm font-normal text-muted-foreground'>
                    /{' '}
                    {panorama?.maxInProgress ??
                      Math.max(
                        overview.scoredCyclesCount *
                          overview.monthlyBasePoints,
                        overview.monthlyBasePoints,
                      )}
                  </span>
                </p>
                {overview.isPartial ? (
                  <Badge className='shrink-0' variant='secondary'>
                    Parcial
                  </Badge>
                ) : null}
              </CardContent>
            </Card>

            {currentCycle ? (
              <Link
                to={p5CyclePath(currentCycle.id)}
                className={cn(
                  'rounded-xl outline-none transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <Card className='h-full gap-2 py-4 transition-colors hover:bg-muted/40'>
                  <CardHeader className='px-4'>
                    <CardTitle className='text-sm'>Ciclo em trabalho</CardTitle>
                  </CardHeader>
                  <CardContent className='flex items-center justify-between gap-3 px-4'>
                    <p className='font-medium'>
                      {MONTH_LABELS[currentCycle.month]}/{currentCycle.year}
                    </p>
                    <Badge className='shrink-0'>
                      {CYCLE_STATUS_LABELS[currentCycle.status]}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ) : (
              <Card className='gap-2 py-4'>
                <CardHeader className='px-4'>
                  <CardTitle className='text-sm'>Ciclo em trabalho</CardTitle>
                </CardHeader>
                <CardContent className='px-4'>
                  <p className='text-sm text-muted-foreground'>
                    Nenhum ciclo aberto
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {panorama ? (
            <section className='space-y-3'>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
                <div>
                  <h2 className='text-base font-medium'>Panorama geral</h2>
                  <p className='text-sm text-muted-foreground'>
                    {panorama.scope === 'cycle' && panorama.cycle
                      ? `Junção dos pilares visíveis — ciclo ${MONTH_LABELS[panorama.cycle.month]}/${panorama.cycle.year}.`
                      : `Junção dos pilares visíveis — porcentagem nos ciclos em curso${
                          overview.scoredCyclesCount > 0
                            ? ` (${overview.scoredCyclesCount} mês${overview.scoredCyclesCount === 1 ? '' : 'es'})`
                            : ''
                        }.`}
                    {panorama.simulated
                      ? ' Exibindo valores simulados (não salvos).'
                      : ''}
                  </p>
                </div>
                <div className='space-y-2 sm:w-64'>
                  <Label htmlFor='p5-cycle-filter'>Ciclo</Label>
                  <Select
                    value={selectedCycleId}
                    onValueChange={setCycleFilter}
                  >
                    <SelectTrigger id='p5-cycle-filter' className='w-full'>
                      <SelectValue placeholder='Selecione o ciclo' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CYCLE_FILTER_ALL}>
                        Todos os ciclos (ano)
                      </SelectItem>
                      {overview.cycles.map((cycle) => (
                        <SelectItem key={cycle.id} value={cycle.id}>
                          {MONTH_LABELS[cycle.month]}/{cycle.year} —{' '}
                          {CYCLE_STATUS_LABELS[cycle.status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Card className='gap-0 py-0'>
                <CardContent className='grid gap-6 p-4 lg:grid-cols-[220px_1fr] lg:items-center'>
                  <div className='flex flex-col items-center gap-2 text-center'>
                    <p className='text-sm text-muted-foreground'>
                      Resultado P5
                    </p>
                    <P5RadialGauge
                      value={panorama.overallPercent}
                      hasScore={panorama.hasScore}
                    />
                    <p className='text-sm text-muted-foreground'>
                      {panorama.hasScore
                        ? `${formatPoints(panorama.score)} / ${panorama.maxInProgress} pts ${
                            panorama.scope === 'cycle'
                              ? 'do ciclo'
                              : 'nos ciclos em curso'
                          }`
                        : 'Sem pontuação neste ciclo'}
                    </p>
                    <div className='flex flex-wrap justify-center gap-2'>
                      {panorama.simulated ? (
                        <Badge variant='default'>Simulação</Badge>
                      ) : null}
                      {panorama.scope === 'cycle' && panorama.cycle ? (
                        <Badge variant='outline'>
                          {CYCLE_STATUS_LABELS[panorama.cycle.status]}
                        </Badge>
                      ) : null}
                      {(panorama.scope === 'year' && overview.isPartial) ||
                      panorama.simulated ||
                      (panorama.scope === 'cycle' &&
                        panorama.cycle?.isPartial) ? (
                        <Badge variant='secondary'>Parcial</Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className='space-y-3'>
                    {panorama.pillars.map((pillar) => {
                      const meta = PILLAR_META[pillar.code];
                      const Icon = meta?.icon ?? Factory;

                      return (
                        <div key={pillar.code} className='space-y-1.5'>
                          <div className='flex items-center justify-between gap-3'>
                            <span className='inline-flex min-w-0 items-center gap-2'>
                              <span
                                className={cn(
                                  'flex size-6 shrink-0 items-center justify-center rounded-full',
                                  meta?.softColor,
                                  meta?.color,
                                )}
                              >
                                <Icon className='size-3.5' aria-hidden />
                              </span>
                              <span
                                className={cn(
                                  'truncate text-sm font-medium',
                                  meta?.color,
                                )}
                              >
                                {pillar.name}
                              </span>
                              {!pillar.available ? (
                                <Badge variant='outline' className='text-[10px]'>
                                  Em breve
                                </Badge>
                              ) : null}
                            </span>
                            <span className='shrink-0 text-sm font-semibold tabular-nums'>
                              {formatPoints(pillar.percent)}%
                              <span className='ml-1 text-xs font-normal text-muted-foreground'>
                                ({formatPoints(pillar.points)}/
                                {formatPoints(pillar.maxInProgress)})
                              </span>
                            </span>
                          </div>
                          <div
                            className='h-2 w-full overflow-hidden rounded-full bg-muted'
                            role='progressbar'
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={barWidthPercent(pillar.percent)}
                            aria-label={`${pillar.name}: ${formatPoints(pillar.percent)}%`}
                          >
                            <div
                              className={cn(
                                'h-full rounded-full transition-[width] duration-300 ease-out',
                                meta?.barColor ?? 'bg-primary',
                              )}
                              style={{
                                width: `${barWidthPercent(pillar.percent)}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </section>
          ) : null}

          <section className='space-y-3'>
            <div>
              <h2 className='text-base font-medium'>Ciclos do programa</h2>
              <p className='text-sm text-muted-foreground'>
                Pontuação mensal da fábrica (até {overview.monthlyBasePoints}{' '}
                pts). Clique para abrir o detalhe do mês.
              </p>
            </div>
            <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'>
              {overview.cycles.map((cycle) => {
                const isDraft = cycle.status === 'DRAFT';
                const body = (
                  <>
                    <div className='flex items-start justify-between gap-2'>
                      <span className='text-sm font-semibold'>
                        {MONTH_LABELS[cycle.month]}
                      </span>
                      <Badge
                        className='shrink-0'
                        variant={statusBadgeVariant(cycle.status)}
                      >
                        {CYCLE_STATUS_LABELS[cycle.status]}
                      </Badge>
                    </div>
                    <p className='mt-3 text-2xl font-semibold tabular-nums leading-none'>
                      {cycle.factoryScore == null ? (
                        <span className='text-muted-foreground'>—</span>
                      ) : (
                        <>
                          {formatPoints(cycle.factoryScore)}
                          <span className='ml-1 text-sm font-normal text-muted-foreground'>
                            / {overview.monthlyBasePoints}
                          </span>
                        </>
                      )}
                    </p>
                    <p className='mt-2 text-xs text-muted-foreground'>
                      {isDraft
                        ? 'Ainda não aberto'
                        : `${cycle.participantsCount} part.${
                            cycle.accidentsCount != null
                              ? ` · ${cycle.accidentsCount} occ.`
                              : ''
                          }`}
                    </p>
                  </>
                );

                if (isDraft) {
                  return (
                    <div
                      key={cycle.id}
                      className='rounded-lg border border-dashed bg-card px-3 py-3 opacity-70'
                    >
                      {body}
                    </div>
                  );
                }

                const isSelected = selectedCycleId === cycle.id;

                return (
                  <div
                    key={cycle.id}
                    className={cn(
                      'rounded-lg border bg-card px-3 py-3 transition-colors',
                      'hover:bg-muted/40',
                      cycle.status === 'OPEN' && 'border-primary/40',
                      isSelected && 'ring-2 ring-ring',
                    )}
                  >
                    <button
                      type='button'
                      onClick={() => setCycleFilter(cycle.id)}
                      className='w-full text-left'
                    >
                      {body}
                    </button>
                    <Link
                      to={p5CyclePath(cycle.id)}
                      className='mt-2 inline-block text-xs text-primary underline-offset-2 hover:underline'
                    >
                      Abrir detalhe
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
