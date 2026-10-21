import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardList, Search } from 'lucide-react';
import {
  AppPageContainer,
  FilterPanel,
  ListEmptyState,
  ListErrorState,
  ListLoadingState,
  PageHero,
  PageSectionHeader,
} from '@/components/layout';
import {
  SOLICITATION_STATUS_LABELS,
  solicitationApi,
  type Solicitation,
  type SolicitationSortField,
  type SolicitationStatus,
  type SortOrder,
} from '@/services/solicitation';
import { solicitationDetailPath } from '@/routes/constants';
import { SolicitationStatusBadge } from '@/components/SolicitationStatusBadge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { surfaceStyles } from '@/lib/surface-styles';
import { cn } from '@/lib/utils';

const STATUS_FILTER_ALL = 'ALL';
const PAGE_SIZE = 5;

type PeriodPreset = '7' | '30' | '90' | 'month' | 'custom' | 'all';

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDays(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
}

function resolvePeriod(
  period: PeriodPreset,
  customFrom: string,
  customTo: string,
): { from: string; to: string } {
  const today = formatDateInput(new Date());
  if (period === '7') return { from: shiftDays(-6), to: today };
  if (period === '30') return { from: shiftDays(-29), to: today };
  if (period === '90') return { from: shiftDays(-89), to: today };
  if (period === 'month') {
    const now = new Date();
    return {
      from: formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: today,
    };
  }
  if (period === 'custom') return { from: customFrom, to: customTo };
  return { from: '', to: '' };
}

function formatDisplayDate(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function periodHintText(input: {
  period: PeriodPreset;
  createdFrom: string;
  createdTo: string;
  dateRangeInvalid: boolean;
}): string {
  if (input.dateRangeInvalid) {
    return 'A data inicial não pode ser maior que a data final.';
  }
  if (input.period === 'custom' && !input.createdFrom && !input.createdTo) {
    return 'Informe as datas para limitar o período. Sem datas, a lista traz todos os registros.';
  }
  if (input.createdFrom && input.createdTo) {
    return `Exibindo criações de ${formatDisplayDate(input.createdFrom)} até ${formatDisplayDate(input.createdTo)}.`;
  }
  if (input.createdFrom) {
    return `Exibindo criações a partir de ${formatDisplayDate(input.createdFrom)}.`;
  }
  if (input.createdTo) {
    return `Exibindo criações até ${formatDisplayDate(input.createdTo)}.`;
  }
  return 'Exibindo solicitações de todas as datas.';
}

function SolicitationCard({ item }: { item: Solicitation }) {
  return (
    <Link
      to={solicitationDetailPath(item.id)}
      className='block p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      aria-label={`Ver solicitação: ${item.title}`}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0 flex-1'>
          <p className='truncate text-sm font-medium'>{item.title}</p>
          <p className='mt-0.5 truncate text-xs text-muted-foreground'>
            {item.requesterName} · {item.cardNumber}
          </p>
        </div>
        <SolicitationStatusBadge status={item.status} />
      </div>
      <div className='mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
        <span className='tabular-nums'>
          {format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm', {
            locale: ptBR,
          })}
        </span>
        <span className='truncate'>{item.sectorName}</span>
        <span className='tabular-nums'>CC {item.costCenter}</span>
      </div>
    </Link>
  );
}

function SolicitationRow({ item }: { item: Solicitation }) {
  const navigate = useNavigate();
  const openDetail = () => navigate(solicitationDetailPath(item.id));

  return (
    <TableRow
      role='link'
      tabIndex={0}
      aria-label={`Ver solicitação: ${item.title}`}
      className='cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none'
      onClick={openDetail}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDetail();
        }
      }}
    >
      <TableCell className='whitespace-nowrap text-sm tabular-nums'>
        {format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm', {
          locale: ptBR,
        })}
      </TableCell>
      <TableCell>
        <div className='max-w-[220px] truncate font-medium'>
          {item.requesterName}
        </div>
        <div className='text-xs text-muted-foreground tabular-nums'>
          {item.cardNumber} · {item.unit}
        </div>
      </TableCell>
      <TableCell>
        <div className='max-w-[200px] truncate'>{item.sectorName}</div>
        <div className='text-xs text-muted-foreground tabular-nums'>
          CC {item.costCenter}
        </div>
      </TableCell>
      <TableCell className='w-40 max-w-40'>
        <div className='truncate' title={item.title}>
          {item.title}
        </div>
      </TableCell>
      <TableCell>
        <SolicitationStatusBadge status={item.status} />
      </TableCell>
    </TableRow>
  );
}

export function SolicitationListPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_FILTER_ALL);
  const [period, setPeriod] = useState<PeriodPreset>('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SolicitationSortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const syncStartedRef = useRef(false);

  const appliedSearchRef = useRef(search);
  appliedSearchRef.current = search;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      if (appliedSearchRef.current === next) return;
      setSearch(next);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { from: createdFrom, to: createdTo } = resolvePeriod(
    period,
    customFrom,
    customTo,
  );
  const dateRangeInvalid = Boolean(
    createdFrom && createdTo && createdFrom > createdTo,
  );

  const query = useQuery({
    queryKey: [
      'solicitations',
      statusFilter,
      createdFrom,
      createdTo,
      search,
      page,
      sortBy,
      sortOrder,
    ],
    enabled: !dateRangeInvalid,
    queryFn: () =>
      solicitationApi.list({
        page,
        pageSize: PAGE_SIZE,
        sortBy,
        sortOrder,
        ...(statusFilter === STATUS_FILTER_ALL
          ? {}
          : { status: statusFilter as SolicitationStatus }),
        ...(createdFrom ? { createdFrom } : {}),
        ...(createdTo ? { createdTo } : {}),
        ...(search ? { q: search } : {}),
      }),
  });

  function handleSort(field: SolicitationSortField) {
    setPage(1);
    if (sortBy === field) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(field);
    setSortOrder(field === 'createdAt' ? 'desc' : 'asc');
  }

  useEffect(() => {
    if (syncStartedRef.current) return;
    syncStartedRef.current = true;

    void (async () => {
      try {
        const result = await solicitationApi.syncPendingFromKairo();
        if (result.completed > 0) {
          await queryClient.invalidateQueries({ queryKey: ['solicitations'] });
        }
      } catch {
        // sync silencioso
      }
    })();
  }, [queryClient]);

  const rows = query.data?.solicitations ?? [];
  const pagination = query.data?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  const periodHint = periodHintText({
    period,
    createdFrom,
    createdTo,
    dateRangeInvalid,
  });

  const activeFilterCount = [
    statusFilter !== STATUS_FILTER_ALL,
    period !== '30',
    searchInput.trim() !== '',
    period === 'custom' && (customFrom !== '' || customTo !== ''),
  ].filter(Boolean).length;

  function clearFilters() {
    setStatusFilter(STATUS_FILTER_ALL);
    setPeriod('30');
    setCustomFrom('');
    setCustomTo('');
    setSearchInput('');
    setSearch('');
    setPage(1);
  }

  return (
    <AppPageContainer>
      <PageHero
        eyebrow='Gestão de chamados'
        eyebrowIcon={ClipboardList}
        title='Solicitações'
        description='A lista começa nos últimos 30 dias. Ajuste o período, o status ou a busca para ver outros registros.'
      />

      <FilterPanel
        description='Refine a lista de solicitações'
        activeCount={activeFilterCount}
        onClear={clearFilters}
      >
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,12rem)_minmax(0,14rem)_minmax(0,1fr)]'>
          <div className='space-y-1.5'>
            <Label
              htmlFor='solicitation-status'
              className='text-xs font-medium'
            >
              Status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger
                id='solicitation-status'
                className={cn('w-full', surfaceStyles.field)}
              >
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_FILTER_ALL}>
                  Todos os status
                </SelectItem>
                {(
                  Object.keys(SOLICITATION_STATUS_LABELS) as SolicitationStatus[]
                ).map((status) => (
                  <SelectItem key={status} value={status}>
                    {SOLICITATION_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1.5'>
            <Label
              htmlFor='solicitation-period'
              className='text-xs font-medium'
            >
              Período
            </Label>
            <Select
              value={period}
              onValueChange={(value) => {
                setPeriod(value as PeriodPreset);
                setPage(1);
              }}
            >
              <SelectTrigger
                id='solicitation-period'
                className={cn('w-full', surfaceStyles.field)}
              >
                <SelectValue placeholder='Período' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='7'>Últimos 7 dias</SelectItem>
                <SelectItem value='30'>Últimos 30 dias</SelectItem>
                <SelectItem value='90'>Últimos 90 dias</SelectItem>
                <SelectItem value='month'>Este mês</SelectItem>
                <SelectItem value='custom'>Período personalizado</SelectItem>
                <SelectItem value='all'>Todas as datas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1.5 sm:col-span-2 lg:col-span-1'>
            <Label
              htmlFor='solicitation-search'
              className='text-xs font-medium'
            >
              Busca
            </Label>
            <div className='relative'>
              <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                id='solicitation-search'
                className={cn(surfaceStyles.field, 'pl-9')}
                value={searchInput}
                placeholder='Título, solicitante, código, setor ou cartão'
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
          </div>
        </div>

        {period === 'custom' ? (
          <div className='mt-3 grid gap-3 sm:grid-cols-2 lg:max-w-md'>
            <div className='space-y-1.5'>
              <Label htmlFor='solicitation-from' className='text-xs font-medium'>
                De
              </Label>
              <Input
                id='solicitation-from'
                type='date'
                className={surfaceStyles.field}
                value={customFrom}
                max={customTo || undefined}
                onChange={(event) => {
                  setCustomFrom(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='solicitation-to' className='text-xs font-medium'>
                Até
              </Label>
              <Input
                id='solicitation-to'
                type='date'
                className={surfaceStyles.field}
                value={customTo}
                min={customFrom || undefined}
                onChange={(event) => {
                  setCustomTo(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        ) : null}

        <p
          className={cn(
            'mt-3 text-sm',
            dateRangeInvalid ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {periodHint}
        </p>
      </FilterPanel>

      <div className='space-y-4'>
        <PageSectionHeader
          icon={ClipboardList}
          title='Lista'
          description='Resultados filtrados e ordenáveis'
          badge={
            !dateRangeInvalid && !query.isLoading && !query.isError
              ? `${total} ${total === 1 ? 'solicitação' : 'solicitações'}`
              : undefined
          }
        />

        {dateRangeInvalid ? (
          <ListEmptyState>
            Ajuste as datas para carregar as solicitações.
          </ListEmptyState>
        ) : query.isLoading ? (
          <ListLoadingState count={5} heightClass='h-16' />
        ) : query.isError ? (
          <ListErrorState>
            {query.error instanceof Error
              ? query.error.message
              : 'Erro ao carregar solicitações.'}
          </ListErrorState>
        ) : (
          <Card
            className={cn(
              'gap-0 overflow-hidden py-0',
              surfaceStyles.card,
            )}
          >
            <div className='hidden sm:block'>
              <Table className='table-fixed'>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      label='Data'
                      field='createdAt'
                      activeField={sortBy}
                      activeOrder={sortOrder}
                      onSort={handleSort}
                      className='w-[140px]'
                    />
                    <SortableTableHead
                      label='Solicitante'
                      field='requesterName'
                      activeField={sortBy}
                      activeOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      label='Setor'
                      field='sectorName'
                      activeField={sortBy}
                      activeOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      label='Título'
                      field='title'
                      activeField={sortBy}
                      activeOrder={sortOrder}
                      onSort={handleSort}
                      className='w-40'
                    />
                    <SortableTableHead
                      label='Status'
                      field='status'
                      activeField={sortBy}
                      activeOrder={sortOrder}
                      onSort={handleSort}
                      className='w-[120px]'
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className='h-24 text-center text-muted-foreground'
                      >
                        Nenhuma solicitação encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((item) => (
                      <SolicitationRow key={item.id} item={item} />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className='divide-y sm:hidden'>
              {rows.length === 0 ? (
                <p className='p-8 text-center text-sm text-muted-foreground'>
                  Nenhuma solicitação encontrada.
                </p>
              ) : (
                rows.map((item) => (
                  <SolicitationCard key={item.id} item={item} />
                ))
              )}
            </div>

            <TablePagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              summary={
                <>
                  Mostrando {total === 0 ? '0–0' : `${start}–${end}`} de {total}{' '}
                  solicitações
                </>
              }
            />
          </Card>
        )}
      </div>
    </AppPageContainer>
  );
}
