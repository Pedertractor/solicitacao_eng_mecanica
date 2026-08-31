import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheckIcon,
  type ShieldCheckIconHandle,
} from 'lucide-animated';
import { toast } from 'sonner';
import {
  p5Api,
  type SafetyAccident,
  type SafetyAccidentHistoryItem,
  type SafetyEmployeeLossDetail,
} from '@/services/p5';
import { useAuth } from '@/contexts/useAuth';
import { useP5Permissions } from '@/hooks/useP5Permissions';
import { SAFETY_PILLAR_DENIED } from '@/config/accessMessages';
import { AccessDeniedState } from '@/components/AccessDeniedState';
import { p5CyclePath } from '@/routes/constants';
import { displayCardNumber } from '@/utils/card-number-input';
import { formatPercent, formatPoints } from '@/utils/p5-number';
import { refetchWhileRecalculating } from '@/utils/p5-live-query';
import {
  formatHistoryActor,
  formatHistoryChangedFields,
  safetyHistoryActionLabel,
} from '@/utils/p5-safety-history';
import {
  accidentStatusLabel,
  accidentTypeLabel,
} from '@/utils/status-labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { EmployeeSafetyLossDialog } from './components/EmployeeSafetyLossDialog';
import { SafetyOccurrencesTimeline } from './components/SafetyOccurrencesTimeline';

const SECTORS_PAGE_SIZE = 10;
const HISTORY_PAGE_SIZE = 10;

type Tab = 'overview' | 'accidents' | 'results' | 'history' | 'config';

export function P5SafetyPage() {
  const { cycleId = '' } = useParams();
  const { user } = useAuth();
  const { canAccessP5, canViewPillar, canEditPillar } = useP5Permissions();
  const canEditSafety = canEditPillar('SAFETY');
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [reviewAccident, setReviewAccident] = useState<SafetyAccident | null>(
    null,
  );
  const [rejectionReason, setRejectionReason] = useState('');
  const [costCenterFilter, setCostCenterFilter] = useState('');
  const [sectorsPage, setSectorsPage] = useState(1);
  const [employeesPage, setEmployeesPage] = useState(1);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] =
    useState<SafetyEmployeeLossDetail | null>(null);
  const shieldRef = useRef<ShieldCheckIconHandle>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyExternalId, setHistoryExternalId] = useState('');
  const [historyDetail, setHistoryDetail] =
    useState<SafetyAccidentHistoryItem | null>(null);

  useEffect(() => {
    shieldRef.current?.startAnimation();
  }, []);

  const allowed = canAccessP5 && canViewPillar('SAFETY');

  const { data: cycle } = useQuery({
    queryKey: ['p5', 'cycle', cycleId],
    queryFn: () => p5Api.getCycle(cycleId),
    enabled: Boolean(cycleId) && allowed,
    refetchInterval: (query) =>
      refetchWhileRecalculating(query.state.data?.recalculating),
  });

  const { data: accidents = [], isLoading: loadingAccidents } = useQuery({
    queryKey: ['p5', 'accidents', cycleId],
    queryFn: () => p5Api.listAccidents(cycleId),
    enabled: Boolean(cycleId) && allowed,
    refetchInterval: () => refetchWhileRecalculating(cycle?.recalculating),
  });

  const { data: results } = useQuery({
    queryKey: ['p5', 'safety-results', cycleId],
    queryFn: () => p5Api.getSafetyResults(cycleId),
    enabled: Boolean(cycleId) && allowed,
    refetchInterval: (query) =>
      refetchWhileRecalculating(
        query.state.data?.recalculating || cycle?.recalculating,
      ),
  });

  const costCenterQuery = costCenterFilter.trim();

  const { data: sectorsResults, isLoading: loadingSectors } = useQuery({
    queryKey: [
      'p5',
      'safety-results',
      cycleId,
      'sectors',
      sectorsPage,
      SECTORS_PAGE_SIZE,
      costCenterQuery,
    ],
    queryFn: () =>
      p5Api.getSafetyResults(cycleId, {
        page: sectorsPage,
        pageSize: SECTORS_PAGE_SIZE,
        ...(costCenterQuery ? { costCenter: costCenterQuery } : {}),
      }),
    enabled: Boolean(cycleId) && allowed && tab === 'results',
  });

  const {
    data: sectorDetail,
    isLoading: loadingSectorDetail,
    isError: sectorDetailError,
  } = useQuery({
    queryKey: [
      'p5',
      'safety-sector',
      cycleId,
      selectedSectorId,
      employeesPage,
      SECTORS_PAGE_SIZE,
    ],
    queryFn: () =>
      p5Api.getSafetySectorDetail(cycleId, selectedSectorId!, {
        page: employeesPage,
        pageSize: SECTORS_PAGE_SIZE,
      }),
    enabled: Boolean(cycleId) && Boolean(selectedSectorId) && allowed,
  });

  const historyExternalIdQuery = historyExternalId.trim();

  const { data: historyResult, isLoading: loadingHistory } = useQuery({
    queryKey: [
      'p5',
      'safety-history',
      cycleId,
      historyPage,
      HISTORY_PAGE_SIZE,
      historyExternalIdQuery,
    ],
    queryFn: () =>
      p5Api.listSafetyHistory(cycleId, {
        page: historyPage,
        pageSize: HISTORY_PAGE_SIZE,
        ...(historyExternalIdQuery
          ? { externalId: historyExternalIdQuery }
          : {}),
      }),
    enabled: Boolean(cycleId) && allowed && tab === 'history',
  });

  const historyItems = historyResult?.items ?? [];
  const historyPagination = historyResult?.pagination;
  const historyTotal = historyPagination?.totalItems ?? historyItems.length;
  const historyTotalPages = historyPagination?.totalPages ?? 1;
  const historyPageSize = historyPagination?.pageSize ?? HISTORY_PAGE_SIZE;
  const historyStart =
    historyTotal === 0 ? 0 : (historyPage - 1) * historyPageSize;

  const sectors = sectorsResults?.sectors ?? [];
  const sectorsPagination = sectorsResults?.pagination;
  const sectorsTotal = sectorsPagination?.totalItems ?? sectors.length;
  const sectorsTotalPages = sectorsPagination?.totalPages ?? 1;
  const sectorsPageSize = sectorsPagination?.pageSize ?? SECTORS_PAGE_SIZE;
  const sectorsStart =
    sectorsTotal === 0 ? 0 : (sectorsPage - 1) * sectorsPageSize;
  const employeesPagination = sectorDetail?.pagination;
  const employeesTotal =
    employeesPagination?.totalItems ?? sectorDetail?.employees.length ?? 0;
  const employeesTotalPages = employeesPagination?.totalPages ?? 1;
  const employeesPageSize =
    employeesPagination?.pageSize ?? SECTORS_PAGE_SIZE;
  const employeesStart =
    employeesTotal === 0 ? 0 : (employeesPage - 1) * employeesPageSize;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['p5'] });
  };

  const reviewMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      status: 'VALIDATED' | 'REJECTED';
      rejectionReason?: string;
    }) =>
      p5Api.reviewAccident(payload.id, {
        status: payload.status,
        ...(payload.rejectionReason
          ? { rejectionReason: payload.rejectionReason }
          : {}),
      }),
    onSuccess: () => {
      toast.success('Ocorrência atualizada');
      setReviewAccident(null);
      setRejectionReason('');
      invalidate();
    },
  });

  if (!user || !canViewPillar('SAFETY')) {
    return (
      <AccessDeniedState
        title={SAFETY_PILLAR_DENIED.title}
        description={SAFETY_PILLAR_DENIED.description}
        showHomeLink
      />
    );
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Visão geral' },
    { id: 'accidents', label: 'Ocorrências' },
    { id: 'results', label: 'Resultados por setor' },
    { id: 'history', label: 'Histórico' },
    { id: 'config', label: 'Integração CIPA' },
  ];

  return (
    <div className='min-w-0 space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <div className='flex flex-wrap items-center gap-2'>
            <h1 className='flex items-center gap-2'>
              <ShieldCheckIcon
                ref={shieldRef}
                size={20}
                className='shrink-0 text-[#08751a]'
                aria-hidden
                onMouseEnter={() => shieldRef.current?.startAnimation()}
                onMouseLeave={() => shieldRef.current?.stopAnimation()}
              />
              Pilar Segurança
            </h1>
            {cycle?.status === 'HOMOLOGATED' || cycle?.status === 'LOCKED' ? (
              <Badge className='gap-1.5'>OK</Badge>
            ) : null}
            {!canEditSafety ? (
              <Badge variant='secondary'>Somente visualização</Badge>
            ) : null}
          </div>
          <p className='text-muted-foreground'>
            Ciclo {cycle ? `${cycle.month}/${cycle.year}` : '…'} · pontuação
            recalculada automaticamente a cada ocorrência (máx. 20 pts no P5)
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button asChild variant='outline'>
            <Link to={p5CyclePath(cycleId)}>Voltar ao ciclo</Link>
          </Button>
        </div>
      </div>

      <div className='flex flex-wrap gap-2'>
        {tabs.map((t) => (
          <Button
            key={t.id}
            size='sm'
            variant={tab === t.id ? 'default' : 'outline'}
            onClick={() => {
              setTab(t.id);
              setSelectedSectorId(null);
              setEmployeesPage(1);
              if (t.id === 'results') setSectorsPage(1);
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
          <Card className='gap-3 py-4'>
            <CardHeader className='min-h-8 px-4'>
              <CardTitle className='text-base'>Pontos do pilar</CardTitle>
            </CardHeader>
            <CardContent className='px-4'>
              {results?.factoryInternalAvg == null &&
              results?.factoryWeightedP5Avg == null ? (
                <p className='text-sm text-muted-foreground'>Sem cálculo</p>
              ) : (
                <p className='text-2xl font-semibold tabular-nums leading-none'>
                  {formatPoints(
                    results.factoryWeightedP5Avg ??
                      results.factoryInternalAvg ??
                      0,
                  )}
                  <span className='ml-1 text-sm font-normal text-muted-foreground'>
                    / 20 pts
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
          <Card className='gap-3 py-4'>
            <CardHeader className='min-h-8 px-4'>
              <CardTitle className='text-base'>Percentual da fábrica</CardTitle>
            </CardHeader>
            <CardContent className='px-4'>
              {results?.factoryWeightedP5Avg == null ? (
                <p className='text-sm text-muted-foreground'>Sem cálculo</p>
              ) : (
                <p className='text-2xl font-semibold tabular-nums leading-none'>
                  {formatPercent(results.factoryWeightedP5Avg)}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className='gap-3 py-4'>
            <CardHeader className='min-h-8 px-4'>
              <CardTitle className='text-base'>Pendentes</CardTitle>
            </CardHeader>
            <CardContent className='px-4 text-2xl'>
              {results?.accidentCounts.pending ?? 0}
            </CardContent>
          </Card>
          <Card className='gap-3 py-4'>
            <CardHeader className='min-h-8 px-4'>
              <CardTitle className='text-base'>Validadas</CardTitle>
            </CardHeader>
            <CardContent className='px-4 text-2xl'>
              {results?.accidentCounts.validated ?? 0}
            </CardContent>
          </Card>
          <Card className='gap-3 py-4'>
            <CardHeader className='min-h-8 px-4'>
              <CardTitle className='text-base'>Status</CardTitle>
            </CardHeader>
            <CardContent className='px-4'>
              <Badge variant='secondary'>
                {results?.isPartial ? 'Resultado parcial' : 'Completo'}
              </Badge>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'accidents' ? (
        <Card className='min-w-0 overflow-hidden'>
          <CardHeader>
            <CardTitle className='text-base'>Ocorrências</CardTitle>
          </CardHeader>
          <CardContent className='min-w-0 space-y-4'>
            {loadingAccidents ? (
              <p className='text-muted-foreground'>Carregando…</p>
            ) : accidents.length === 0 ? (
              <p className='text-muted-foreground'>
                Nenhuma ocorrência. Use a API de importação normalizada enquanto
                a CIPA não estiver configurada.
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/hora</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Afast.</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accidents.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          {new Date(a.occurredAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>{a.employeeName ?? '—'}</TableCell>
                        <TableCell>{a.sectorName}</TableCell>
                        <TableCell>
                          {accidentTypeLabel(a.accidentType)}
                        </TableCell>
                        <TableCell>{a.daysAway ?? '—'}</TableCell>
                        <TableCell>
                          {a.accidentType === 'FREQUENCY' ? 'P5' : a.sourceSystem}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              a.accidentType === 'FREQUENCY'
                                ? 'secondary'
                                : 'default'
                            }
                          >
                            {accidentStatusLabel(a.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {a.accidentType === 'FREQUENCY' ? (
                            '—'
                          ) : canEditSafety &&
                            (a.status === 'PENDING_REVIEW' ||
                              a.status === 'IMPORTED') ? (
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() => setReviewAccident(a)}
                            >
                              Revisar
                            </Button>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className='text-sm text-muted-foreground'>
                  Histórico do ciclo em ordem cronológica. Cada ocorrência
                  aplica perda coletiva (fábrica) e, na vítima, perda
                  individual — valores definidos no painel de pontuação do
                  ciclo.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === 'results' ? (
        selectedSectorId ? (
          <Card className='min-w-0 overflow-hidden'>
            <CardHeader className='flex flex-row flex-wrap items-start justify-between gap-3 space-y-0'>
              <div className='min-w-0 space-y-1'>
                <CardTitle className='text-base'>
                  {sectorDetail?.sector.sectorName ?? 'Setor'}
                </CardTitle>
                <p className='text-sm text-muted-foreground'>
                  Segurança por colaborador
                  {sectorDetail?.sector.costCenter
                    ? ` · CC ${sectorDetail.sector.costCenter}`
                    : ''}
                </p>
              </div>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => {
                  setSelectedSectorId(null);
                  setSelectedEmployee(null);
                  setEmployeesPage(1);
                }}
              >
                Voltar aos setores
              </Button>
            </CardHeader>
            <CardContent className='min-w-0 space-y-4'>
              {loadingSectorDetail ? (
                <p className='text-muted-foreground'>Carregando…</p>
              ) : sectorDetailError || !sectorDetail ? (
                <p className='text-destructive'>
                  Não foi possível carregar o detalhe do setor.
                </p>
              ) : (
                <>
                  <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                    <div>
                      <p className='text-xs text-muted-foreground'>
                        Participantes
                      </p>
                      <p className='text-lg font-medium'>
                        {sectorDetail.sector.participantsCount}
                      </p>
                    </div>
                    <div>
                      <p className='text-xs text-muted-foreground'>
                        Reincidências
                      </p>
                      <p className='text-lg font-medium'>
                        {sectorDetail.sector.recidivismCount}
                      </p>
                    </div>
                    <div>
                      <p className='text-xs text-muted-foreground'>
                        Pilar (média)
                      </p>
                      <p className='text-lg font-medium'>
                        {sectorDetail.sector.internalAvg}
                      </p>
                    </div>
                    <div>
                      <p className='text-xs text-muted-foreground'>P5 (média)</p>
                      <p className='text-lg font-medium'>
                        {formatPoints(sectorDetail.sector.weightedP5Avg)}
                      </p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cartão</TableHead>
                        <TableHead>Colaborador</TableHead>
                        <TableHead className='text-right'>Com afast.</TableHead>
                        <TableHead className='text-right'>Sem afast.</TableHead>
                        <TableHead className='text-right'>Pts ( /20 )</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sectorDetail.employees.map((e) => (
                        <TableRow
                          key={e.participantId}
                          className='cursor-pointer'
                          tabIndex={0}
                          role='button'
                          onClick={() => setSelectedEmployee(e)}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter' || ev.key === ' ') {
                              ev.preventDefault();
                              setSelectedEmployee(e);
                            }
                          }}
                        >
                          <TableCell>
                            {displayCardNumber(e.cardNumber)}
                          </TableCell>
                          <TableCell className='font-medium'>{e.name}</TableCell>
                          <TableCell className='text-right'>
                            {e.withLeave}
                          </TableCell>
                          <TableCell className='text-right'>
                            {e.withoutLeave}
                          </TableCell>
                          <TableCell className='text-right tabular-nums'>
                            {e.weightedP5 == null && e.internalScore == null
                              ? '—'
                              : formatPoints(
                                  e.weightedP5 ?? e.internalScore ?? 0,
                                )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    page={employeesPage}
                    totalPages={employeesTotalPages}
                    onPageChange={setEmployeesPage}
                    className='border-t-0 px-0'
                    summary={
                      <>
                        Mostrando{' '}
                        {employeesTotal === 0
                          ? '0–0'
                          : `${employeesStart + 1}–${Math.min(
                              employeesStart + sectorDetail.employees.length,
                              employeesTotal,
                            )}`}{' '}
                        de {employeesTotal} colaboradores
                      </>
                    }
                  />

                  <SafetyOccurrencesTimeline
                    occurrences={sectorDetail.occurrences}
                    defaultOpen={false}
                  />
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className='min-w-0 overflow-hidden'>
            <CardHeader>
              <CardTitle className='text-base'>Resultados por setor</CardTitle>
            </CardHeader>
            <CardContent className='min-w-0 space-y-4'>
              <div className='max-w-xs space-y-2'>
                <Label htmlFor='cost-center-filter'>Centro de custo</Label>
                <Input
                  id='cost-center-filter'
                  type='search'
                  placeholder='Filtrar por centro de custo…'
                  value={costCenterFilter}
                  onChange={(e) => {
                    setCostCenterFilter(e.target.value);
                    setSectorsPage(1);
                  }}
                />
              </div>

              {loadingSectors ? (
                <p className='text-muted-foreground'>Carregando setores…</p>
              ) : sectorsTotal === 0 ? (
                <p className='text-muted-foreground'>
                  {costCenterQuery
                    ? 'Nenhum setor com esse centro de custo.'
                    : 'Sem resultados. Execute o cálculo.'}
                </p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className='w-[40%] min-w-40 whitespace-normal'>
                          Setor
                        </TableHead>
                        <TableHead>Centro de custo</TableHead>
                        <TableHead className='text-right'>
                          Com afast.
                        </TableHead>
                        <TableHead className='text-right'>
                          Sem afast.
                        </TableHead>
                        <TableHead className='text-right'>
                          Pts média ( /20 )
                        </TableHead>
                        <TableHead className='text-right'>
                          Participantes
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sectors.map((s) => (
                        <TableRow
                          key={s.sectorId}
                          className='cursor-pointer'
                          tabIndex={0}
                          role='button'
                          onClick={() => {
                            setEmployeesPage(1);
                            setSelectedSectorId(s.sectorId);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setEmployeesPage(1);
                              setSelectedSectorId(s.sectorId);
                            }
                          }}
                        >
                          <TableCell className='max-w-0 whitespace-normal wrap-break-word'>
                            {s.sectorName}
                          </TableCell>
                          <TableCell>{s.costCenter ?? '—'}</TableCell>
                          <TableCell className='text-right'>
                            {s.withLeave}
                          </TableCell>
                          <TableCell className='text-right'>
                            {s.withoutLeave}
                          </TableCell>
                          <TableCell className='text-right tabular-nums'>
                            {formatPoints(s.weightedP5)}
                          </TableCell>
                          <TableCell className='text-right'>
                            {s.participantsCount}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <TablePagination
                    page={sectorsPage}
                    totalPages={sectorsTotalPages}
                    onPageChange={setSectorsPage}
                    className='border-t-0 px-0'
                    summary={
                      <>
                        Mostrando{' '}
                        {sectorsTotal === 0
                          ? '0–0'
                          : `${sectorsStart + 1}–${Math.min(
                              sectorsStart + sectors.length,
                              sectorsTotal,
                            )}`}{' '}
                        de {sectorsTotal} setores
                      </>
                    }
                  />
                </>
              )}
              <p className='text-sm text-muted-foreground'>
                Clique em um setor para ver a pontuação de Segurança de cada
                colaborador. Reincidência é a quantidade de colaboradores
                reincidentes no setor; as demais colunas de pontuação mostram
                médias.
              </p>
            </CardContent>
          </Card>
        )
      ) : null}

      {tab === 'history' ? (
        <Card className='min-w-0 overflow-hidden'>
          <CardHeader>
            <CardTitle className='text-base'>Histórico de alterações</CardTitle>
          </CardHeader>
          <CardContent className='min-w-0 space-y-4'>
            <div className='max-w-sm space-y-2'>
              <Label htmlFor='history-external-id'>ID externo</Label>
              <Input
                id='history-external-id'
                value={historyExternalId}
                onChange={(event) => {
                  setHistoryExternalId(event.target.value);
                  setHistoryPage(1);
                }}
                placeholder='Filtrar por externalId'
              />
            </div>

            {loadingHistory ? (
              <p className='text-muted-foreground'>Carregando histórico…</p>
            ) : historyTotal === 0 ? (
              <p className='text-muted-foreground'>
                Nenhum evento de acidente registrado neste ciclo.
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recebido</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Autor</TableHead>
                      <TableHead>Alterações</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {new Date(item.createdAt).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          {item.metadata?.sourceChangedAt
                            ? new Date(
                                item.metadata.sourceChangedAt,
                              ).toLocaleString('pt-BR')
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {safetyHistoryActionLabel(item.action)}
                        </TableCell>
                        <TableCell>
                          {formatHistoryActor({
                            actor: item.metadata?.actor,
                            userName: item.userName,
                          })}
                        </TableCell>
                        <TableCell>
                          {formatHistoryChangedFields(
                            item.metadata?.changedFields,
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => setHistoryDetail(item)}
                          >
                            Ver detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <TablePagination
                  page={historyPage}
                  totalPages={historyTotalPages}
                  onPageChange={setHistoryPage}
                  className='border-t-0 px-0'
                  summary={
                    <>
                      Mostrando{' '}
                      {historyTotal === 0
                        ? '0–0'
                        : `${historyStart + 1}–${Math.min(
                            historyStart + historyItems.length,
                            historyTotal,
                          )}`}{' '}
                      de {historyTotal} eventos
                    </>
                  }
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === 'config' ? (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Integração CIPA (push)</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm text-muted-foreground'>
            <p>
              A CIPA sincroniza acidentes com{' '}
              <code>PUT /api/p5/integrations/cipa/accidents/:externalId</code>{' '}
              e cancela com{' '}
              <code>DELETE /api/p5/integrations/cipa/accidents/:externalId</code>{' '}
              usando API key (<code>X-CIPA-API-KEY</code> ou Bearer).
            </p>
            <p>
              Somente <strong>atos</strong> são registrados como acidentes no
              P5. Condições novas são ignoradas; transições condição ↔ ato
              geram histórico. Campos obrigatórios:{' '}
              <code>previousNature</code>, <code>sourceChangedAt</code> e{' '}
              <code>actor</code>.
            </p>
            <p>
              O endpoint legado{' '}
              <code>POST /api/p5/integrations/cipa/accidents</code> continua
              disponível temporariamente para criação de atos.
            </p>
            <ul className='list-disc space-y-1 pl-5'>
              <li>
                <strong>Com / sem afastamento</strong> — perda coletiva de
                fábrica (padrão 2,06 P5 a todos) + perda individual da vítima
                (padrão 20 P5), configuráveis no painel
              </li>
              <li>
                <strong>Limiar</strong> — se o saldo da fábrica ficar abaixo do
                limiar (padrão 70%), o pilar zera para todos no mês
              </li>
              <li>
                Não envie o tipo FREQUENCY; a regra antiga de reincidência (−20)
                não se aplica mais nos ciclos com painel v2
              </li>
            </ul>
            <p>
              Identificação: setor por <code>costCenter</code>; colaborador por{' '}
              <code>unit</code> + <code>cardNumber</code>.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <EmployeeSafetyLossDialog
        employee={selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
      />

      {canEditSafety ? (
        <Dialog
          open={reviewAccident !== null}
          onOpenChange={(open) => {
            if (!open) {
              setReviewAccident(null);
              setRejectionReason('');
            }
          }}
        >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar ocorrência</DialogTitle>
          </DialogHeader>
          {reviewAccident ? (
            <div className='space-y-3 text-sm'>
              <p>
                <strong>Setor:</strong> {reviewAccident.sectorName}
              </p>
              <p>
                <strong>Tipo:</strong>{' '}
                {accidentTypeLabel(reviewAccident.accidentType)}
              </p>
              <p>
                <strong>Data:</strong>{' '}
                {new Date(reviewAccident.occurredAt).toLocaleString('pt-BR')}
              </p>
              <div className='space-y-2'>
                <Label>Motivo da rejeição (obrigatório se rejeitar)</Label>
                <Input
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className='gap-2'>
            <Button
              variant='outline'
              onClick={() =>
                reviewMutation.mutate({
                  id: reviewAccident!.id,
                  status: 'VALIDATED',
                })
              }
            >
              Validar
            </Button>
            <Button
              variant='destructive'
              onClick={() => {
                if (!rejectionReason.trim()) {
                  toast.error('Informe o motivo da rejeição');
                  return;
                }
                reviewMutation.mutate({
                  id: reviewAccident!.id,
                  status: 'REJECTED',
                  rejectionReason,
                });
              }}
            >
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      ) : null}

      <Dialog
        open={historyDetail !== null}
        onOpenChange={(open) => {
          if (!open) setHistoryDetail(null);
        }}
      >
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Detalhe do histórico</DialogTitle>
          </DialogHeader>
          {historyDetail ? (
            <div className='space-y-4 text-sm'>
              <div>
                <p className='font-medium'>Ação</p>
                <p className='text-muted-foreground'>
                  {safetyHistoryActionLabel(historyDetail.action)}
                </p>
              </div>
              <div>
                <p className='font-medium'>Autor</p>
                <p className='text-muted-foreground'>
                  {formatHistoryActor({
                    actor: historyDetail.metadata?.actor,
                    userName: historyDetail.userName,
                  })}
                </p>
              </div>
              {historyDetail.metadata?.reason ? (
                <div>
                  <p className='font-medium'>Motivo</p>
                  <p className='text-muted-foreground'>
                    {historyDetail.metadata.reason}
                  </p>
                </div>
              ) : null}
              <div>
                <p className='font-medium'>Antes</p>
                <pre className='max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs'>
                  {JSON.stringify(historyDetail.before, null, 2)}
                </pre>
              </div>
              <div>
                <p className='font-medium'>Depois</p>
                <pre className='max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs'>
                  {JSON.stringify(historyDetail.after, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type='button' onClick={() => setHistoryDetail(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
