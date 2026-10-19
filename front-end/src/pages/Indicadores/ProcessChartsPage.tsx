import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { Label } from '@/components/ui/label';
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
    queryKey: ['process-charts', teamId, period],
    queryFn: () => solicitationApi.processCharts(teamId, period),
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
        <div className='grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_auto] sm:items-end'>
          <div className='min-w-0'>
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
            <div className='mt-1 flex gap-1'>
              {PERIODS.map((item) => (
                <button
                  key={item.value}
                  type='button'
                  className={cn(
                    'rounded-md border px-3 py-1 text-sm',
                    period === item.value
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                  onClick={() => setPeriod(item.value)}
                >
                  {item.label}
                </button>
              ))}
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
