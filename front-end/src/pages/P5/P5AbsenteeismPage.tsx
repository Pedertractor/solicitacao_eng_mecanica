import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarOff, TriangleAlert } from 'lucide-react';
import {
  p5Api,
  type AbsenteeismEmployeeDetail,
} from '@/services/p5';
import { useAuth } from '@/contexts/useAuth';
import { useP5Permissions } from '@/hooks/useP5Permissions';
import { ABSENTEEISM_PILLAR_DENIED } from '@/config/accessMessages';
import { AccessDeniedState } from '@/components/AccessDeniedState';
import { p5CyclePath } from '@/routes/constants';
import { displayCardNumber } from '@/utils/card-number-input';
import { formatPercent, formatPoints } from '@/utils/p5-number';
import { refetchWhileRecalculating } from '@/utils/p5-live-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { EmployeeAbsenteeismDialog } from './components/EmployeeAbsenteeismDialog';

const SECTORS_PAGE_SIZE = 10;
const ABSENTEEISM_P5_MAX = 10;
const ABSENTEEISM_INTERNAL_MAX = 100;

type Tab = 'overview' | 'results' | 'rules';

export function P5AbsenteeismPage() {
  const { cycleId = '' } = useParams();
  const { user } = useAuth();
  const { canViewPillar, canEditPillar, scopeKey } = useP5Permissions();
  const canEditAbsenteeism = canEditPillar('ABSENTEEISM');
  const [tab, setTab] = useState<Tab>('overview');
  const [costCenterFilter, setCostCenterFilter] = useState('');
  const [sectorsPage, setSectorsPage] = useState(1);
  const [employeesPage, setEmployeesPage] = useState(1);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] =
    useState<AbsenteeismEmployeeDetail | null>(null);

  const allowed = canViewPillar('ABSENTEEISM');

  const { data: cycle } = useQuery({
    queryKey: ['p5', 'cycle', cycleId, scopeKey],
    queryFn: () => p5Api.getCycle(cycleId),
    enabled: Boolean(cycleId) && allowed,
    refetchInterval: (query) =>
      refetchWhileRecalculating(query.state.data?.recalculating),
  });

  const { data: results } = useQuery({
    queryKey: ['p5', 'absenteeism-results', cycleId, scopeKey],
    queryFn: () => p5Api.getAbsenteeismResults(cycleId),
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
      'absenteeism-results',
      cycleId,
      'sectors',
      sectorsPage,
      SECTORS_PAGE_SIZE,
      costCenterQuery,
      scopeKey,
    ],
    queryFn: () =>
      p5Api.getAbsenteeismResults(cycleId, {
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
      'absenteeism-sector',
      cycleId,
      selectedSectorId,
      employeesPage,
      SECTORS_PAGE_SIZE,
      scopeKey,
    ],
    queryFn: () =>
      p5Api.getAbsenteeismSectorDetail(cycleId, selectedSectorId!, {
        page: employeesPage,
        pageSize: SECTORS_PAGE_SIZE,
      }),
    enabled: Boolean(cycleId) && Boolean(selectedSectorId) && allowed,
  });

  if (!user || !allowed) {
    return (
      <AccessDeniedState
        title={ABSENTEEISM_PILLAR_DENIED.title}
        description={ABSENTEEISM_PILLAR_DENIED.description}
        showHomeLink
      />
    );
  }

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

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Visão geral' },
    { id: 'results', label: 'Resultados por setor' },
    { id: 'rules', label: 'Regras' },
  ];

  return (
    <div className='min-w-0 space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <div className='flex flex-wrap items-center gap-2'>
            <h1 className='flex items-center gap-2'>
              <CalendarOff
                className='size-5 shrink-0 text-[#08751a]'
                aria-hidden
              />
              Pilar Absenteísmo
            </h1>
            {cycle?.status === 'HOMOLOGATED' || cycle?.status === 'LOCKED' ? (
              <Badge className='gap-1.5'>OK</Badge>
            ) : null}
            {results?.isPartial ? (
              <Badge
                variant='outline'
                className='gap-1 border-amber-300 bg-amber-50 text-amber-800'
              >
                <TriangleAlert className='size-3' aria-hidden />
                Parcial
              </Badge>
            ) : null}
            {!canEditAbsenteeism ? (
              <Badge variant='secondary'>Somente visualização</Badge>
            ) : null}
          </div>
          <p className='text-muted-foreground'>
            Ciclo {cycle ? `${cycle.month}/${cycle.year}` : '…'} · índice &lt;
            100 remove 40 pts individuais (máx. {ABSENTEEISM_P5_MAX} pts no P5)
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
              <CardTitle className='text-base'>Pilar (média)</CardTitle>
            </CardHeader>
            <CardContent className='px-4'>
              {results?.factoryInternalAvg == null ? (
                <p className='text-sm text-muted-foreground'>Sem cálculo</p>
              ) : (
                <p className='text-2xl font-semibold tabular-nums leading-none'>
                  {formatPoints(results.factoryInternalAvg)}
                  <span className='ml-1 text-sm font-normal text-muted-foreground'>
                    / {ABSENTEEISM_INTERNAL_MAX} pts
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
              <CardTitle className='text-base'>Abaixo de 100</CardTitle>
            </CardHeader>
            <CardContent className='px-4 text-2xl'>
              {results?.penalizedCount ?? 0}
            </CardContent>
          </Card>
          <Card className='gap-3 py-4'>
            <CardHeader className='min-h-8 px-4'>
              <CardTitle className='text-base'>Pontuados</CardTitle>
            </CardHeader>
            <CardContent className='px-4 text-2xl'>
              {results?.scoredParticipants ?? 0}
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

      {tab === 'results' ? (
        selectedSectorId ? (
          <Card className='min-w-0 overflow-hidden'>
            <CardHeader className='flex flex-row flex-wrap items-start justify-between gap-3 space-y-0'>
              <div className='min-w-0 space-y-1'>
                <CardTitle className='text-base'>
                  {sectorDetail?.sector.sectorName ?? 'Setor'}
                </CardTitle>
                <p className='text-sm text-muted-foreground'>
                  Absenteísmo por colaborador
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
                        Abaixo de 100
                      </p>
                      <p className='text-lg font-medium'>
                        {sectorDetail.sector.penalizedCount}
                      </p>
                    </div>
                    <div>
                      <p className='text-xs text-muted-foreground'>
                        Pilar (média)
                      </p>
                      <p className='text-lg font-medium'>
                        {sectorDetail.sector.internalAvg == null
                          ? '—'
                          : formatPoints(sectorDetail.sector.internalAvg)}
                      </p>
                    </div>
                    <div>
                      <p className='text-xs text-muted-foreground'>P5 (média)</p>
                      <p className='text-lg font-medium'>
                        {sectorDetail.sector.weightedP5Avg == null
                          ? '—'
                          : formatPercent(sectorDetail.sector.weightedP5Avg)}
                      </p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cartão</TableHead>
                        <TableHead>Colaborador</TableHead>
                        <TableHead className='text-right'>Índice</TableHead>
                        <TableHead className='text-right'>Individual</TableHead>
                        <TableHead className='text-right'>Pilar</TableHead>
                        <TableHead className='text-right'>P5</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sectorDetail.employees.map((employee) => (
                        <TableRow
                          key={employee.participantId}
                          className='cursor-pointer'
                          tabIndex={0}
                          role='button'
                          onClick={() => setSelectedEmployee(employee)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedEmployee(employee);
                            }
                          }}
                        >
                          <TableCell>
                            {displayCardNumber(employee.cardNumber)}
                          </TableCell>
                          <TableCell className='font-medium'>
                            {employee.name}
                          </TableCell>
                          <TableCell className='text-right'>
                            {employee.absenteeism == null
                              ? '—'
                              : formatPoints(employee.absenteeism)}
                          </TableCell>
                          <TableCell className='text-right'>
                            {employee.weightedP5 == null
                              ? '—'
                              : employee.individualDeducted
                                ? `−${formatPoints(employee.individualDeductionP5 ?? 10)}`
                                : '0'}
                          </TableCell>
                          <TableCell className='text-right'>
                            {employee.internalScore == null
                              ? '—'
                              : formatPoints(employee.internalScore)}
                          </TableCell>
                          <TableCell className='text-right'>
                            {employee.weightedP5 == null
                              ? '—'
                              : formatPercent(employee.weightedP5)}
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
                <Label htmlFor='absenteeism-cost-center-filter'>
                  Centro de custo
                </Label>
                <Input
                  id='absenteeism-cost-center-filter'
                  type='search'
                  placeholder='Filtrar por centro de custo…'
                  value={costCenterFilter}
                  onChange={(event) => {
                    setCostCenterFilter(event.target.value);
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
                          Abaixo de 100
                        </TableHead>
                        <TableHead className='text-right'>
                          Pilar (média)
                        </TableHead>
                        <TableHead className='text-right'>P5 (média)</TableHead>
                        <TableHead className='text-right'>
                          Participantes
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sectors.map((sector) => (
                        <TableRow
                          key={sector.sectorId}
                          className='cursor-pointer'
                          tabIndex={0}
                          role='button'
                          onClick={() => {
                            setEmployeesPage(1);
                            setSelectedSectorId(sector.sectorId);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setEmployeesPage(1);
                              setSelectedSectorId(sector.sectorId);
                            }
                          }}
                        >
                          <TableCell className='max-w-0 whitespace-normal wrap-break-word'>
                            {sector.sectorName}
                          </TableCell>
                          <TableCell>{sector.costCenter ?? '—'}</TableCell>
                          <TableCell className='text-right'>
                            {sector.penalizedCount}
                          </TableCell>
                          <TableCell className='text-right'>
                            {sector.internalAvg == null
                              ? '—'
                              : formatPoints(sector.internalAvg)}
                          </TableCell>
                          <TableCell className='text-right'>
                            {sector.weightedP5Avg == null
                              ? '—'
                              : formatPercent(sector.weightedP5Avg)}
                          </TableCell>
                          <TableCell className='text-right'>
                            {sector.participantsCount}
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
                Clique em um setor para ver o índice e a pontuação de Absenteísmo
                de cada colaborador. Índice abaixo de 100 tira a perda coletiva
                de toda a fábrica e a parcela individual de quem ficou abaixo.
              </p>
            </CardContent>
          </Card>
        )
      ) : null}

      {tab === 'rules' ? (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Como o pilar pontua</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm text-muted-foreground'>
            <p>
              Absenteísmo vale até <strong>{ABSENTEEISM_P5_MAX} pontos</strong>{' '}
              no P5 mensal. A regra segue o mesmo modelo da Segurança: perda
              coletiva de fábrica e perda individual, configuráveis no painel de
              pontuação (padrão −1 para todos e −10 para quem ficou abaixo de
              100).
            </p>
            <ul className='list-disc space-y-1 pl-5'>
              <li>
                Índice <strong>&lt; 100</strong> conta como ocorrência: todos
                perdem a parcela de fábrica; essa pessoa também perde a parcela
                individual.
              </li>
              <li>
                Índice <strong>≥ 100</strong> (ou colaborador ausente na
                procedure) não gera ocorrência individual, mas recebe a perda
                coletiva se houver colegas abaixo de 100.
              </li>
              <li>
                Se o saldo da fábrica ficar abaixo do limiar do painel (padrão
                70%), o pilar zera para todos neste mês.
              </li>
              <li>
                No mês em andamento o resultado é <strong>parcial</strong>: o
                índice ainda pode mudar até o fechamento.
              </li>
            </ul>
            <p>
              Identificação: colaborador por unidade + cartão. Médias da fábrica
              e do setor usam só os colaboradores visíveis neste pilar.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <EmployeeAbsenteeismDialog
        employee={selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
      />
    </div>
  );
}
