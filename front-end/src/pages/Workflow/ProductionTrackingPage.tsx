import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, FlaskConical, RefreshCw, Search } from 'lucide-react';
import { AppPageContainer, FilterPanel, ListEmptyState, ListErrorState, ListLoadingState, PageHero } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { solicitationApi, SOLICITATION_CLIENT_LABELS, WORKFLOW_STAGE_LABELS, WORKFLOW_STAGE_STATUS_LABELS, type SolicitationClient } from '@/services/solicitation';
import { solicitationDetailPath } from '@/routes/constants';
import { cn } from '@/lib/utils';
import { currentProductionStages, deliveryDeadline, displayDate, productionType } from './production-tracking';

const PAGE_SIZE = 20;
const EMPTY = { query: '', client: 'ALL', type: 'ALL', deadline: 'ALL', stage: 'ALL' };

export function ProductionTrackingPage() {
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['production-tracking'],
    queryFn: () => solicitationApi.productionTracking(),
    refetchInterval: 30_000,
  });
  const items = query.data?.solicitations ?? [];
  const updateFilter = (key: keyof typeof EMPTY, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const clearFilters = () => { setFilters(EMPTY); setPage(1); };
  const filtered = items.filter((item) => {
    const deadline = deliveryDeadline(item.deliveryDate);
    const text = [item.trackingCode, item.title, item.description, item.partNumbers, item.ofNumber,
      item.requesterName, item.client ? SOLICITATION_CLIENT_LABELS[item.client] : ''].join(' ').toLocaleLowerCase('pt-BR');
    return text.includes(filters.query.trim().toLocaleLowerCase('pt-BR'))
      && (filters.client === 'ALL' || item.client === filters.client)
      && (filters.type === 'ALL' || productionType(item) === filters.type)
      && (filters.deadline === 'ALL' || deadline.tone === filters.deadline)
      && (filters.stage === 'ALL' || currentProductionStages(item).some((stage) => stage.stage === filters.stage));
  });
  const clients = [...new Set(items.flatMap((item) => item.client ? [item.client] : []))]
    .sort((a, b) => SOLICITATION_CLIENT_LABELS[a].localeCompare(SOLICITATION_CLIENT_LABELS[b], 'pt-BR'));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const activeCount = Object.entries(filters).filter(([key, value]) => key === 'query' ? value.trim() : value !== 'ALL').length;

  return (
    <AppPageContainer>
      <PageHero title='Amostras e protótipos' eyebrow='ACOMPANHAMENTO COMERCIAL' eyebrowIcon={FlaskConical}
        description='Acompanhe os itens em desenvolvimento, as etapas em aberto e os prazos de entrega.'
        actions={<Button variant='outline' disabled={query.isFetching} onClick={() => void query.refetch()}>
          <RefreshCw className={cn('size-4', query.isFetching && 'animate-spin')} />Atualizar
        </Button>} />

      {query.isLoading ? <ListLoadingState /> : query.isError ? (
        <ListErrorState><p>Não foi possível carregar as amostras e protótipos.</p><Button variant='outline' className='mt-3' onClick={() => void query.refetch()}>Tentar novamente</Button></ListErrorState>
      ) : <>
        <div className='grid grid-cols-2 gap-3 lg:grid-cols-4' aria-label='Resumo dos itens filtrados'>
          {[
            ['Em desenvolvimento', filtered.length],
            ['Amostras', filtered.filter((item) => productionType(item) === 'AMOSTRA').length],
            ['Protótipos', filtered.filter((item) => productionType(item) === 'PROTOTIPO').length],
            ['Com entrega atrasada', filtered.filter((item) => deliveryDeadline(item.deliveryDate).tone === 'late').length],
          ].map(([label, count]) => <div key={label} className='rounded-2xl border bg-card p-5 shadow-sm'>
            <p className='text-sm text-muted-foreground'>{label}</p>
            <p className='mt-2 text-3xl font-semibold tabular-nums'>{count}</p>
          </div>)}
        </div>

        <FilterPanel title='Consultar itens' description='Busque por PN, OF, solicitação, descrição ou solicitante.' activeCount={activeCount} onClear={clearFilters}>
          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-5'>
            <div className='space-y-2'>
              <Label htmlFor='production-search'>Buscar</Label>
              <div className='relative'><Search className='absolute left-3 top-3 size-4 text-muted-foreground' />
                <Input id='production-search' className='pl-9' value={filters.query} placeholder='PN, OF ou descrição' onChange={(event) => updateFilter('query', event.target.value)} />
              </div>
            </div>
            <div className='space-y-2'><Label htmlFor='production-client'>Cliente</Label>
              <Select value={filters.client} onValueChange={(value) => updateFilter('client', value)}>
                <SelectTrigger id='production-client' className='w-full'><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value='ALL'>Todos os clientes</SelectItem>
                  {clients.map((client: SolicitationClient) => <SelectItem key={client} value={client}>{SOLICITATION_CLIENT_LABELS[client]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'><Label htmlFor='production-type'>Tipo</Label>
              <Select value={filters.type} onValueChange={(value) => updateFilter('type', value)}>
                <SelectTrigger id='production-type' className='w-full'><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value='ALL'>Amostras e protótipos</SelectItem><SelectItem value='AMOSTRA'>Amostras</SelectItem><SelectItem value='PROTOTIPO'>Protótipos</SelectItem></SelectContent>
              </Select>
            </div>
            <div className='space-y-2'><Label htmlFor='production-stage'>Etapa atual</Label>
              <Select value={filters.stage} onValueChange={(value) => updateFilter('stage', value)}>
                <SelectTrigger id='production-stage' className='w-full'><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value='ALL'>Todas as etapas</SelectItem>
                  {Object.entries(WORKFLOW_STAGE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'><Label htmlFor='production-deadline'>Prazo de entrega</Label>
              <Select value={filters.deadline} onValueChange={(value) => updateFilter('deadline', value)}>
                <SelectTrigger id='production-deadline' className='w-full'><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value='ALL'>Todos os prazos</SelectItem><SelectItem value='late'>Atrasados</SelectItem><SelectItem value='today'>Vencem hoje</SelectItem><SelectItem value='normal'>Dentro do prazo</SelectItem><SelectItem value='none'>Sem prazo definido</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        </FilterPanel>

        <section className='min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm' aria-label='Lista de amostras e protótipos'>
          <div className='flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4'>
            <h2 className='font-semibold'>Itens em desenvolvimento</h2>
            <p className='text-sm text-muted-foreground' aria-live='polite'>{filtered.length} {filtered.length === 1 ? 'solicitação' : 'solicitações'}{activeCount ? ' nos filtros selecionados' : ''}</p>
          </div>
          {!filtered.length ? <ListEmptyState>
            <p className='font-medium'>{items.length ? 'Nenhum item encontrado' : 'Nenhuma amostra ou protótipo em desenvolvimento'}</p>
            <p className='mt-1 text-sm'>{items.length ? 'Ajuste os filtros para encontrar outros itens.' : 'As solicitações comerciais de amostras e protótipos com etapas abertas aparecerão aqui.'}</p>
          </ListEmptyState> : <>
            <Table className='min-w-[1240px]'>
              <TableHeader><TableRow>
                {['Solicitação / descrição', 'Cliente / unidade', 'PN / OF', 'Tipo', 'Data do pedido', 'Entrega / prazo', 'Etapas atuais', ''].map((heading) => <TableHead key={heading} className='px-4'>{heading}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>{visible.map((item) => {
                const deadline = deliveryDeadline(item.deliveryDate);
                const stages = currentProductionStages(item);
                return <TableRow key={item.id}>
                  <TableCell className='max-w-72 whitespace-normal px-4 py-4'>
                    <Link className='font-semibold text-primary hover:underline' to={solicitationDetailPath(item.id)}>{item.trackingCode}</Link>
                    <p className='mt-1 font-medium'>{item.title}</p>
                    <p className='mt-1 text-xs text-muted-foreground'>{item.requesterName}</p>
                  </TableCell>
                  <TableCell className='px-4'><p>{item.client ? SOLICITATION_CLIENT_LABELS[item.client] : '—'}</p>
                    <p className='mt-1 text-xs text-muted-foreground'>{(item.executionUnit ?? item.unit) === 'TRACTOR' ? 'Tractorcomponents' : 'Pedertractor'}</p>
                  </TableCell>
                  <TableCell className='max-w-52 whitespace-pre-wrap break-words px-4'><p className='font-mono text-xs'>{item.partNumbers || 'PN não informado'}</p><p className='mt-1 text-xs text-muted-foreground'>OF: {item.ofNumber || '—'}</p></TableCell>
                  <TableCell className='px-4'><Badge variant='outline'>{productionType(item) === 'PROTOTIPO' ? 'Protótipo' : 'Amostra'}</Badge></TableCell>
                  <TableCell className='px-4 text-xs tabular-nums'>{displayDate(item.createdAt)}</TableCell>
                  <TableCell className='px-4'><p className='text-sm tabular-nums'>{displayDate(item.deliveryDate)}</p>
                    <p className={cn('mt-1 text-xs', deadline.tone === 'late' ? 'font-semibold text-destructive' : deadline.tone === 'today' ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>{deadline.label}</p>
                  </TableCell>
                  <TableCell className='px-4'><div className='space-y-2'>{stages.map((stage) => <div key={stage.id}>
                    <p className='text-xs font-medium'>{WORKFLOW_STAGE_LABELS[stage.stage]}</p>
                    <p className={cn('text-xs', stage.status === 'IN_PROGRESS' ? 'text-primary' : 'text-muted-foreground')}>{WORKFLOW_STAGE_STATUS_LABELS[stage.status]}</p>
                  </div>)}</div></TableCell>
                  <TableCell className='px-4'><Button variant='ghost' size='icon' asChild><Link to={solicitationDetailPath(item.id)} aria-label={`Abrir solicitação ${item.trackingCode}`}><ArrowUpRight className='size-4' /></Link></Button></TableCell>
                </TableRow>;
              })}</TableBody>
            </Table>
            <div className='flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4'>
              <span className='text-xs text-muted-foreground'>Exibindo {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}</span>
              <div className='flex items-center gap-3'><Button variant='outline' size='sm' disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
                <span className='text-xs'>Página {currentPage} de {pages}</span><Button variant='outline' size='sm' disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Próxima</Button></div>
            </div>
          </>}
        </section>
      </>}
    </AppPageContainer>
  );
}
