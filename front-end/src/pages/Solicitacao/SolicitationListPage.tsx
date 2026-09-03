import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SearchIcon, type SearchIconHandle } from 'lucide-animated';
import {
  SOLICITATION_STATUS_LABELS,
  solicitationApi,
  type Solicitation,
  type SolicitationStatus,
} from '@/services/solicitation';
import { solicitationDetailPath } from '@/routes/constants';
import { SolicitationStatusBadge } from '@/components/SolicitationStatusBadge';
import { Button } from '@/components/ui/button';
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
const STATUS_FILTER_ALL = 'ALL';
const PAGE_SIZE = 10;

function SolicitationDetailAction({ id }: { id: string }) {
  const iconRef = useRef<SearchIconHandle>(null);

  return (
    <Button asChild variant="ghost" size="icon" className="size-8">
      <Link
        to={solicitationDetailPath(id)}
        aria-label="Ver detalhes"
        onMouseEnter={() => iconRef.current?.startAnimation()}
        onMouseLeave={() => iconRef.current?.stopAnimation()}
      >
        <SearchIcon ref={iconRef} size={18} />
      </Link>
    </Button>
  );
}

function SolicitationCard({ item }: { item: Solicitation }) {
  return (
    <Link
      to={solicitationDetailPath(item.id)}
      className="block p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`Ver solicitação: ${item.title}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {item.requesterName} · {item.cardNumber}
          </p>
        </div>
        <SolicitationStatusBadge status={item.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm', {
            locale: ptBR,
          })}
        </span>
        <span className="truncate">{item.sectorName}</span>
        <span className="tabular-nums">CC {item.costCenter}</span>
      </div>
    </Link>
  );
}

function SolicitationRow({ item }: { item: Solicitation }) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-sm tabular-nums">
        {format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm', {
          locale: ptBR,
        })}
      </TableCell>
      <TableCell>
        <div className="max-w-[220px] truncate font-medium">
          {item.requesterName}
        </div>
        <div className="text-muted-foreground text-xs tabular-nums">
          {item.cardNumber} · {item.unit}
        </div>
      </TableCell>
      <TableCell>
        <div className="max-w-[200px] truncate">{item.sectorName}</div>
        <div className="text-muted-foreground text-xs tabular-nums">
          CC {item.costCenter}
        </div>
      </TableCell>
      <TableCell>
        <div className="max-w-[240px] truncate">{item.title}</div>
      </TableCell>
      <TableCell>
        <SolicitationStatusBadge status={item.status} />
      </TableCell>
      <TableCell className="text-right">
        <SolicitationDetailAction id={item.id} />
      </TableCell>
    </TableRow>
  );
}

export function SolicitationListPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_FILTER_ALL);
  const [page, setPage] = useState(1);
  const syncStartedRef = useRef(false);

  const query = useQuery({
    queryKey: ['solicitations', statusFilter, page],
    queryFn: () =>
      solicitationApi.list({
        page,
        pageSize: PAGE_SIZE,
        ...(statusFilter === STATUS_FILTER_ALL
          ? {}
          : { status: statusFilter as SolicitationStatus }),
      }),
  });

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1>Solicitações</h1>
          <p className="text-muted-foreground">
            Consulte as solicitações recebidas, filtre por status e abra um
            registro para analisar e dar andamento.
          </p>
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={STATUS_FILTER_ALL}>Todos os status</SelectItem>
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
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {query.isLoading && (
          <div className="p-8">
            <div className="animate-pulse space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded bg-muted" />
              ))}
            </div>
          </div>
        )}

        {query.isError && (
          <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {query.error instanceof Error
              ? query.error.message
              : 'Erro ao carregar solicitações.'}
          </div>
        )}

        {!query.isLoading && !query.isError && (
          <>
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Data</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-12" aria-hidden />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Nenhuma solicitação encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((item) => (
                    <SolicitationRow key={item.id} item={item} />
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y sm:hidden">
              {rows.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
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
                  Mostrando {total === 0 ? '0–0' : `${start}–${end}`} de{' '}
                  {total} solicitações
                </>
              }
            />
          </>
        )}
      </Card>
    </div>
  );
}
