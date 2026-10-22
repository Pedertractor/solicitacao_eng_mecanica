import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { kairoApi, type KairoTeamOption } from '@/services/kairo';
import {
  solicitationApi,
  type ProcessChartBucket,
  type ProcessChartPeriod,
} from '@/services/solicitation';
import { cn } from '@/lib/utils';

const CLIENT_COLOR = '#2e9e44';
const RESPONSIBLE_COLOR = '#f39c12';

const ACTIVITY_COLORS: Record<string, string> = {
  'Alteração Cliente': '#3b82f6',
  'Alteração Interna': '#f39c12',
  'Desenvolvimento Amostra': '#8e44ad',
  'Desenvolvimento Protótipo': '#1a237e',
  'Desenvolvimento de Gabarito': '#e91e63',
  'Desenvolvimento Teste': '#9ca3af',
};

const FALLBACK_COLORS = ['#0ea5e9', '#14b8a6', '#84cc16', '#fb7185', '#a78bfa'];

const PERIODS: { value: ProcessChartPeriod; label: string }[] = [
  { value: 'year', label: 'Ano' },
  { value: 'month', label: 'Mês' },
  { value: 'week', label: 'Semana' },
];

const MONTH_SHORT = [
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

const MIN_YEAR = 2015;
const WEEK_STARTS_ON = 1;

function clampDate(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

function shiftAnchor(period: ProcessChartPeriod, anchor: Date, delta: number) {
  if (period === 'week') return addDays(anchor, delta * 7);
  if (period === 'month') {
    return clampDate(anchor.getFullYear(), anchor.getMonth() + delta, anchor.getDate());
  }
  return clampDate(anchor.getFullYear() + delta, anchor.getMonth(), anchor.getDate());
}

function periodIndex(period: ProcessChartPeriod, date: Date) {
  if (period === 'year') return date.getFullYear();
  if (period === 'month') return date.getFullYear() * 12 + date.getMonth();
  return startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON }).getTime();
}

function canShift(
  period: ProcessChartPeriod,
  anchor: Date,
  delta: number,
  today: Date,
) {
  const next = shiftAnchor(period, anchor, delta);
  if (delta > 0) return periodIndex(period, next) <= periodIndex(period, today);
  const probe =
    period === 'week' ? startOfWeek(next, { weekStartsOn: WEEK_STARTS_ON }) : next;
  return probe.getFullYear() >= MIN_YEAR;
}

function periodLabel(period: ProcessChartPeriod, anchor: Date) {
  if (period === 'year') return String(anchor.getFullYear());
  if (period === 'month') {
    const label = format(anchor, "MMMM 'de' yyyy", { locale: ptBR });
    return label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1);
  }

  const start = startOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON });
  const end = addDays(start, 6);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    return `${format(start, 'd')}–${format(end, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`;
  }
  if (sameYear) {
    return `${format(start, "d 'de' MMM", { locale: ptBR })} – ${format(end, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`;
  }
  return `${format(start, "d 'de' MMM 'de' yyyy", { locale: ptBR })} – ${format(end, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`;
}

function yearPageStart(year: number) {
  const page = Math.floor(Math.max(0, year - MIN_YEAR) / 12);
  return MIN_YEAR + page * 12;
}

function shiftLabel(period: ProcessChartPeriod, delta: number) {
  if (period === 'year') return delta < 0 ? 'Ano anterior' : 'Próximo ano';
  if (period === 'month') return delta < 0 ? 'Mês anterior' : 'Próximo mês';
  return delta < 0 ? 'Semana anterior' : 'Próxima semana';
}

function PeriodValuePicker({
  period,
  anchor,
  today,
  onSelect,
}: {
  period: ProcessChartPeriod;
  anchor: Date;
  today: Date;
  onSelect: (date: Date) => void;
}) {
  const [pickerYear, setPickerYear] = useState(() => anchor.getFullYear());
  const [pageStart, setPageStart] = useState(() => yearPageStart(anchor.getFullYear()));

  useEffect(() => {
    setPickerYear(anchor.getFullYear());
    setPageStart(yearPageStart(anchor.getFullYear()));
  }, [anchor, period]);

  if (period === 'week') {
    const weekStart = startOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON });
    return (
      <Calendar
        key={format(anchor, 'yyyy-MM-dd')}
        mode='single'
        locale={ptBR}
        weekStartsOn={WEEK_STARTS_ON}
        selected={anchor}
        defaultMonth={anchor}
        startMonth={new Date(MIN_YEAR, 0)}
        endMonth={today}
        disabled={{ after: today }}
        onSelect={(day) => {
          if (day) onSelect(day);
        }}
        modifiers={{ inWeek: { from: weekStart, to: addDays(weekStart, 6) } }}
        modifiersClassNames={{ inWeek: 'bg-muted' }}
      />
    );
  }

  if (period === 'month') {
    const currentYear = today.getFullYear();
    return (
      <div className='w-64 space-y-3'>
        <div className='flex items-center justify-between'>
          <button
            type='button'
            className='rounded-md border border-border p-1 text-muted-foreground hover:bg-muted disabled:opacity-40'
            aria-label='Ano anterior'
            disabled={pickerYear <= MIN_YEAR}
            onClick={() => setPickerYear((year) => year - 1)}
          >
            <ChevronLeft className='size-4' />
          </button>
          <span className='text-sm font-medium'>{pickerYear}</span>
          <button
            type='button'
            className='rounded-md border border-border p-1 text-muted-foreground hover:bg-muted disabled:opacity-40'
            aria-label='Próximo ano'
            disabled={pickerYear >= currentYear}
            onClick={() => setPickerYear((year) => year + 1)}
          >
            <ChevronRight className='size-4' />
          </button>
        </div>
        <div className='grid grid-cols-3 gap-1'>
          {MONTH_SHORT.map((name, index) => {
            const disabled =
              pickerYear > currentYear ||
              (pickerYear === currentYear && index > today.getMonth());
            const selected =
              anchor.getFullYear() === pickerYear && anchor.getMonth() === index;
            return (
              <button
                key={name}
                type='button'
                disabled={disabled}
                aria-pressed={selected}
                className={cn(
                  'rounded-md px-2 py-1.5 text-sm disabled:opacity-40',
                  selected
                    ? 'bg-foreground text-background'
                    : 'hover:bg-muted',
                )}
                onClick={() =>
                  onSelect(clampDate(pickerYear, index, anchor.getDate()))
                }
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const currentYear = today.getFullYear();
  const years = Array.from({ length: 12 }, (_, index) => pageStart + index);

  return (
    <div className='w-64 space-y-3'>
      <div className='flex items-center justify-between'>
        <button
          type='button'
          className='rounded-md border border-border p-1 text-muted-foreground hover:bg-muted disabled:opacity-40'
          aria-label='Anos anteriores'
          disabled={pageStart <= MIN_YEAR}
          onClick={() => setPageStart((start) => start - 12)}
        >
          <ChevronLeft className='size-4' />
        </button>
        <span className='text-sm font-medium'>
          {years[0]} – {Math.min(years[years.length - 1]!, currentYear)}
        </span>
        <button
          type='button'
          className='rounded-md border border-border p-1 text-muted-foreground hover:bg-muted disabled:opacity-40'
          aria-label='Próximos anos'
          disabled={pageStart + 12 > currentYear}
          onClick={() => setPageStart((start) => start + 12)}
        >
          <ChevronRight className='size-4' />
        </button>
      </div>
      <div className='grid grid-cols-3 gap-1'>
        {years.map((year) => {
          const disabled = year > currentYear;
          const selected = anchor.getFullYear() === year;
          return (
            <button
              key={year}
              type='button'
              disabled={disabled}
              aria-pressed={selected}
              className={cn(
                'rounded-md px-2 py-1.5 text-sm disabled:opacity-40',
                selected ? 'bg-foreground text-background' : 'hover:bg-muted',
              )}
              onClick={() =>
                onSelect(clampDate(year, anchor.getMonth(), anchor.getDate()))
              }
            >
              {year}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function activityColor(key: string, index: number) {
  return ACTIVITY_COLORS[key] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function teamOptionLabel(team: KairoTeamOption) {
  const status = team.active ? '' : ' (inativa)';
  const description = team.description?.trim();
  return description
    ? `${team.name}${status} — ${description}`
    : `${team.name}${status}`;
}

function ChartFrame({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-lg border-2 border-neutral-900 bg-white p-3 text-neutral-950',
        className,
      )}
    >
      <h2 className='mb-3 text-center text-sm font-bold sm:text-base'>{title}</h2>
      <div className='min-h-0 flex-1'>{children}</div>
    </section>
  );
}

function EmptyChart() {
  return (
    <div className='flex h-48 items-center justify-center text-sm text-neutral-500'>
      Nenhum pedido neste período.
    </div>
  );
}

function ClientChart({ items }: { items: ProcessChartBucket[] }) {
  if (items.length === 0) return <EmptyChart />;

  return (
    <div style={{ height: Math.max(220, items.length * 34) }}>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart
          data={items}
          layout='vertical'
          margin={{ top: 4, right: 36, left: 4, bottom: 4 }}
          barCategoryGap={6}
        >
          <XAxis type='number' hide />
          <YAxis
            type='category'
            dataKey='label'
            width={158}
            reversed
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#111827', fontSize: 12 }}
          />
          <Bar
            dataKey='count'
            fill={CLIENT_COLOR}
            isAnimationActive={false}
            radius={[0, 6, 6, 0]}
          >
            <LabelList
              dataKey='count'
              position='right'
              fill='#111827'
              fontSize={12}
              fontWeight={700}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ActivityTypeChart({ items }: { items: ProcessChartBucket[] }) {
  if (items.length === 0) return <EmptyChart />;

  return (
    <div className='flex min-h-64 flex-col gap-4 sm:flex-row'>
      <ul className='w-full shrink-0 space-y-1.5 text-xs sm:w-44'>
        <li className='font-semibold'>Tipo de Atividade</li>
        {items.map((item, index) => (
          <li key={item.key} className='flex items-center gap-2'>
            <span
              className='size-2.5 shrink-0 rounded-full'
              style={{ backgroundColor: activityColor(item.key, index) }}
            />
            <span className='truncate' title={item.label}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
      <div className='h-64 min-w-0 flex-1'>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart data={items} margin={{ top: 20, right: 8, left: 8, bottom: 4 }}>
            <XAxis dataKey='label' tick={false} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Bar
              dataKey='count'
              isAnimationActive={false}
              maxBarSize={56}
              radius={[6, 6, 0, 0]}
            >
              {items.map((item, index) => (
                <Cell key={item.key} fill={activityColor(item.key, index)} />
              ))}
              <LabelList
                dataKey='count'
                position='top'
                fill='#111827'
                fontSize={12}
                fontWeight={700}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ResponsibleChart({ items }: { items: ProcessChartBucket[] }) {
  if (items.length === 0) return <EmptyChart />;

  return (
    <div className='h-64'>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart
          data={items}
          margin={{ top: 20, right: 8, left: 8, bottom: 8 }}
        >
          <XAxis
            dataKey='label'
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={{ fill: '#111827', fontSize: 12 }}
          />
          <YAxis hide />
          <Bar
            dataKey='count'
            fill={RESPONSIBLE_COLOR}
            isAnimationActive={false}
            maxBarSize={72}
            radius={[6, 6, 0, 0]}
          >
            <LabelList
              dataKey='count'
              position='top'
              fill='#111827'
              fontSize={12}
              fontWeight={700}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProcessChartsPage() {
  const [teamId, setTeamId] = useState('');
  const [period, setPeriod] = useState<ProcessChartPeriod>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const anchorDate = format(anchor, 'yyyy-MM-dd');
  const onCurrentPeriod = periodIndex(period, anchor) === periodIndex(period, today);

  const statusQuery = useQuery({
    queryKey: ['kairo-status'],
    queryFn: () => kairoApi.getStatus(),
  });

  const teamsQuery = useQuery({
    queryKey: ['kairo-teams'],
    queryFn: () => kairoApi.listTeams(),
    enabled: statusQuery.data?.linked === true,
  });

  const teams = useMemo(() => {
    return [...(teamsQuery.data ?? [])].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [teamsQuery.data]);

  useEffect(() => {
    if (teamId || teams.length === 0) return;
    const first = teams.find((team) => team.active) ?? teams[0];
    if (first) setTeamId(first.id);
  }, [teamId, teams]);

  const chartsQuery = useQuery({
    queryKey: ['process-charts', teamId, period, anchorDate],
    queryFn: () => solicitationApi.processCharts(teamId, period, anchorDate),
    enabled: Boolean(teamId),
  });

  const linked = statusQuery.data?.linked === true;

  return (
    <div className='space-y-4'>
      <div>
        <h1>Indicadores</h1>
        <p className='text-muted-foreground'>
          Pedidos de Desenvolvimento de Processos enviados ao time do Kairo.
        </p>
      </div>

      {statusQuery.isLoading ? (
        <Skeleton className='h-16 w-full max-w-md' />
      ) : !linked ? (
        <p className='text-sm text-muted-foreground'>
          Vincule sua chave de API do Kairo em Integrações para listar os times.
        </p>
      ) : (
        <div className='flex flex-col gap-3 xl:flex-row xl:items-end'>
          <div className='min-w-0 xl:w-96'>
            <Label htmlFor='process-chart-team'>Time</Label>
            <Select
              value={teamId}
              onValueChange={setTeamId}
              disabled={teamsQuery.isLoading || teams.length === 0}
            >
              <SelectTrigger id='process-chart-team' className='mt-1'>
                <SelectValue
                  placeholder={
                    teamsQuery.isLoading
                      ? 'Carregando times...'
                      : 'Nenhum time no Kairo'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {teamOptionLabel(team)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Período</Label>
            <div className='mt-1 flex flex-wrap items-center gap-2'>
              <div className='flex gap-1'>
                {PERIODS.map((item) => (
                  <button
                    key={item.value}
                    type='button'
                    className={cn(
                      'h-8 rounded-md border px-3 text-sm',
                      period === item.value
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                    onClick={() => {
                      setPeriod(item.value);
                      setAnchor(new Date());
                      setPickerOpen(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className='flex items-center gap-1'>
                <button
                  type='button'
                  className='inline-flex h-8 items-center rounded-md border border-border px-2 text-muted-foreground hover:bg-muted disabled:opacity-40'
                  aria-label={shiftLabel(period, -1)}
                  disabled={!canShift(period, anchor, -1, today)}
                  onClick={() => setAnchor((current) => shiftAnchor(period, current, -1))}
                >
                  <ChevronLeft className='size-4' />
                </button>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type='button'
                      className='inline-flex h-8 min-w-36 items-center justify-center whitespace-nowrap rounded-md border border-border px-3 text-sm font-medium hover:bg-muted'
                      aria-label={
                        period === 'year'
                          ? 'Escolher ano'
                          : period === 'month'
                            ? 'Escolher mês'
                            : 'Escolher semana'
                      }
                    >
                      {periodLabel(period, anchor)}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align='start'
                    className={cn('w-auto', period === 'week' ? 'p-0' : undefined)}
                  >
                    <PeriodValuePicker
                      period={period}
                      anchor={anchor}
                      today={today}
                      onSelect={(date) => {
                        setAnchor(date);
                        setPickerOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <button
                  type='button'
                  className='inline-flex h-8 items-center rounded-md border border-border px-2 text-muted-foreground hover:bg-muted disabled:opacity-40'
                  aria-label={shiftLabel(period, 1)}
                  disabled={!canShift(period, anchor, 1, today)}
                  onClick={() => setAnchor((current) => shiftAnchor(period, current, 1))}
                >
                  <ChevronRight className='size-4' />
                </button>
                {onCurrentPeriod ? null : (
                  <button
                    type='button'
                    className='h-8 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted'
                    onClick={() => setAnchor(new Date())}
                  >
                    Hoje
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {linked && teamId ? (
        <div className='rounded-xl bg-[#d5d5d5] p-3'>
          {chartsQuery.isLoading ? (
            <div className='grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)]'>
              <Skeleton className='h-80 bg-white' />
              <div className='grid gap-3'>
                <Skeleton className='h-72 bg-white' />
                <Skeleton className='h-72 bg-white' />
              </div>
            </div>
          ) : chartsQuery.isError || !chartsQuery.data ? (
            <p className='bg-white p-6 text-sm text-neutral-700'>
              Não foi possível carregar os indicadores deste time.
            </p>
          ) : (
            <div className='grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)]'>
              <ChartFrame title='Pedidos por Cliente' className='lg:row-span-2'>
                <ClientChart items={chartsQuery.data.byClient} />
              </ChartFrame>
              <ChartFrame title='Tipos de Pedidos por Ano/Mês/Semana'>
                <ActivityTypeChart items={chartsQuery.data.byActivityType} />
              </ChartFrame>
              <ChartFrame title='Responsável por Pedido'>
                <ResponsibleChart items={chartsQuery.data.byResponsible} />
              </ChartFrame>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
