import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { canSimulateAccidents } from '@/config/permissions';
import {
  p5Api,
  type P5EmployeeOption,
  type SimulationAccident,
} from '@/services/p5';
import { p5AbsenteeismPath, p5SafetyPath, ROUTES } from '@/routes/constants';
import { UNIT, type Unit } from '@/types/auth';
import {
  cardNumberForApi,
  displayCardNumber,
  parseCardNumberInput,
} from '@/utils/card-number-input';
import {
  accidentStatusLabel,
  accidentTypeLabel,
  CYCLE_STATUS_LABELS,
} from '@/utils/status-labels';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

type SimTab = 'accidents' | 'absenteeism';
type AccidentKind = 'WITH_LEAVE' | 'WITHOUT_LEAVE';

const MONTH_OPTIONS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

function calendarMonthInSaoPaulo(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(now);
  return {
    month: Number(parts.find((part) => part.type === 'month')?.value),
    year: Number(parts.find((part) => part.type === 'year')?.value),
  };
}

function employeeKey(e: Pick<P5EmployeeOption, 'unit' | 'cardNumber'>) {
  return `${e.unit}:${cardNumberForApi(e.cardNumber)}`;
}

function cardsMatch(left: string, right: string) {
  const a = cardNumberForApi(left);
  const b = cardNumberForApi(right);
  return Boolean(a) && a === b;
}

export function SimulacaoPage() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SimTab>('accidents');
  const [search, setSearch] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [unit, setUnit] = useState<Unit>('PEDERTRACTOR');
  const [accidentType, setAccidentType] = useState<AccidentKind>('WITH_LEAVE');
  const [daysAway, setDaysAway] = useState('3');
  const [absenteeismValue, setAbsenteeismValue] = useState('80');
  const [calcMonth, setCalcMonth] = useState<number | null>(null);
  const [calcYear, setCalcYear] = useState<number | null>(null);
  const [calcConfirmOpen, setCalcConfirmOpen] = useState(false);
  const [accidentToRemove, setAccidentToRemove] =
    useState<SimulationAccident | null>(null);

  const canSimulate = Boolean(user) && canSimulateAccidents(user!.role);

  const employeesQuery = useQuery({
    queryKey: ['p5', 'employees'],
    queryFn: () => p5Api.listActiveEmployees(),
    enabled: canSimulate,
  });

  const programsQuery = useQuery({
    queryKey: ['p5', 'program-years'],
    queryFn: () => p5Api.listProgramYears(),
    enabled: canSimulate,
  });

  const activeProgram =
    programsQuery.data?.find((program) => program.active) ??
    programsQuery.data?.[0] ??
    null;

  const overviewQuery = useQuery({
    queryKey: ['p5', 'overview', activeProgram?.id],
    queryFn: () => p5Api.getProgramYearOverview(activeProgram!.id),
    enabled: Boolean(activeProgram) && canSimulate,
  });

  const simulationAccidentsQuery = useQuery({
    queryKey: ['p5', 'simulation-accidents'],
    queryFn: () => p5Api.listSimulationAccidents(),
    enabled: canSimulate,
  });

  const employees = employeesQuery.data ?? [];
  const apiCard = cardNumberForApi(cardNumber);

  const matchedEmployee = useMemo(() => {
    if (!apiCard) return null;
    return (
      employees.find(
        (employee) =>
          employee.unit === unit && cardsMatch(employee.cardNumber, apiCard),
      ) ?? null
    );
  }, [apiCard, employees, unit]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees.slice(0, 40);
    return employees
      .filter((e) => {
        const card = displayCardNumber(e.cardNumber).toLowerCase();
        return (
          e.name.toLowerCase().includes(q) ||
          e.cardNumber.toLowerCase().includes(q) ||
          card.includes(q) ||
          e.costCenter.toLowerCase().includes(q) ||
          e.sectorName.toLowerCase().includes(q) ||
          e.unit.toLowerCase().includes(q)
        );
      })
      .slice(0, 40);
  }, [employees, search]);

  const simulateMutation = useMutation({
    mutationFn: () =>
      p5Api.simulateAccident({
        accidentType,
        daysAway:
          accidentType === 'WITH_LEAVE'
            ? Number.parseInt(daysAway, 10) || 0
            : null,
        cardNumber: apiCard,
        unit,
        ...(matchedEmployee
          ? { costCenter: matchedEmployee.costCenter }
          : {}),
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['p5'] });
      const emp = data.impact?.employee.weightedP5;
      const sector = data.impact?.sector.weightedP5Avg;
      const factory = data.impact?.factory.weightedP5Avg;
      toast.success(
        `Acidente ${accidentTypeLabel(data.simulation.accidentType).toLowerCase()} aplicado no ciclo ${data.simulation.cycleLabel} · ${data.simulation.employeeName}: ${emp ?? '—'} pts · setor: ${sector ?? '—'} · fábrica: ${factory ?? '—'}`,
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (accidentId: string) =>
      p5Api.cancelSimulatedAccident(accidentId),
    onSuccess: (data) => {
      setAccidentToRemove(null);
      void queryClient.invalidateQueries({ queryKey: ['p5'] });
      toast.success(
        `Ocorrência de ${data.simulation.employeeName ?? 'colaborador'} removida no ciclo ${data.simulation.cycleLabel}. Pontuação recalculada.`,
      );
    },
  });

  const simulateAbsenteeismMutation = useMutation({
    mutationFn: (payload: {
      absenteeism: number;
      costCenter: string;
      cardNumber: string;
      unit: Unit;
    }) => p5Api.simulateAbsenteeism(payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['p5'] });
      toast.success(
        data.score.individualDeducted
          ? `Absenteísmo ${data.score.absenteeism} no ciclo ${data.simulation.cycleLabel} · ${data.simulation.employeeName}: perdeu 40 pts individuais (${data.score.weightedP5} P5 no pilar)`
          : `Absenteísmo ${data.score.absenteeism} no ciclo ${data.simulation.cycleLabel} · ${data.simulation.employeeName}: preservou 10 P5`,
      );
    },
  });

  const forceAbsenteeismMutation = useMutation({
    mutationFn: (payload: { month: number; year: number }) =>
      p5Api.forceCalculateAbsenteeism(payload),
    onSuccess: (result) => {
      setCalcConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['p5'] });
      toast.success(
        result.partial
          ? `Absenteísmo de ${result.cycleLabel} calculado (resultado parcial). ${result.penalizedCount} colaborador(es) abaixo de 100.`
          : `Absenteísmo de ${result.cycleLabel} calculado. ${result.penalizedCount} colaborador(es) abaixo de 100.`,
      );
    },
  });

  const calendarNow = calendarMonthInSaoPaulo();
  const openCycle = overviewQuery.data?.cycles.find(
    (cycle) => cycle.status === 'OPEN',
  );
  const selectedCalcMonth = calcMonth ?? openCycle?.month ?? calendarNow.month;
  const selectedCalcYear = calcYear ?? openCycle?.year ?? calendarNow.year;
  const selectedCalcCycle = overviewQuery.data?.cycles.find(
    (cycle) =>
      cycle.month === selectedCalcMonth && cycle.year === selectedCalcYear,
  );
  const selectedIsCurrentMonth =
    selectedCalcMonth === calendarNow.month &&
    selectedCalcYear === calendarNow.year;
  const selectedIsLocked =
    selectedCalcCycle?.status === 'HOMOLOGATED' ||
    selectedCalcCycle?.status === 'LOCKED';
  const selectedMonthLabel =
    MONTH_OPTIONS.find((option) => option.value === selectedCalcMonth)?.label ??
    String(selectedCalcMonth);

  const workingCycle = simulationAccidentsQuery.data?.cycle ?? null;
  const accidents = simulationAccidentsQuery.data?.accidents ?? [];
  const simulatedCycleId =
    simulateMutation.data?.simulation.cycleId ?? workingCycle?.id;
  const absenteeismCycleId =
    simulateAbsenteeismMutation.data?.simulation.cycleId;
  const forcedAbsenteeismCycleId =
    forceAbsenteeismMutation.data?.targetCycleId;
  const activeKey = matchedEmployee ? employeeKey(matchedEmployee) : null;

  useEffect(() => {
    if (calcMonth != null || !openCycle) return;
    setCalcMonth(openCycle.month);
    setCalcYear(openCycle.year);
  }, [calcMonth, openCycle]);

  function selectEmployee(employee: P5EmployeeOption) {
    setCardNumber(parseCardNumberInput(employee.cardNumber));
    setUnit(employee.unit);
  }

  function runAccidentSimulation() {
    if (!apiCard) {
      toast.error('Informe o número do cartão e a unidade do colaborador.');
      return;
    }
    if (!matchedEmployee) {
      toast.error(
        `Colaborador não encontrado: cartão ${displayCardNumber(apiCard)} / ${unit}. Sincronize colaboradores se a lista estiver desatualizada.`,
      );
      return;
    }
    if (accidentType === 'WITH_LEAVE') {
      const parsedDays = Number.parseInt(daysAway, 10);
      if (!Number.isFinite(parsedDays) || parsedDays < 0) {
        toast.error('Informe os dias de afastamento (0 ou mais).');
        return;
      }
    }
    simulateMutation.mutate();
  }

  function runAbsenteeismSimulation() {
    if (!matchedEmployee) {
      toast.error(
        'Informe cartão e unidade de um colaborador com setor para simular absenteísmo.',
      );
      return;
    }
    const absenteeism = Number(absenteeismValue.replace(',', '.'));
    if (!Number.isFinite(absenteeism) || absenteeism < 0) {
      toast.error('Informe um índice de absenteísmo numérico maior ou igual a 0.');
      return;
    }
    simulateAbsenteeismMutation.mutate({
      absenteeism,
      costCenter: matchedEmployee.costCenter,
      cardNumber: matchedEmployee.cardNumber,
      unit: matchedEmployee.unit,
    });
  }

  if (isLoading) {
    return (
      <div className='flex min-h-50 items-center justify-center'>
        <p className='text-muted-foreground'>Carregando...</p>
      </div>
    );
  }

  if (!user || !canSimulateAccidents(user.role)) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  const tabs: Array<{ id: SimTab; label: string }> = [
    { id: 'accidents', label: 'Acidentes' },
    { id: 'absenteeism', label: 'Absenteísmo' },
  ];

  return (
    <div className='space-y-6'>
      <div>
        <h1>Simulação</h1>
        <p className='text-muted-foreground'>
          Simule acidentes e absenteísmo no ciclo em trabalho. O colaborador é
          identificado pelo cartão e pela unidade, como na CIPA.
        </p>
      </div>

      <div className='flex flex-wrap gap-2'>
        {tabs.map((item) => (
          <Button
            key={item.id}
            size='sm'
            variant={tab === item.id ? 'default' : 'outline'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <Card className='max-w-5xl'>
        <CardHeader>
          <CardTitle>Colaborador</CardTitle>
          <CardDescription>
            Informe o cartão e a unidade para bater o cadastro, ou escolha na
            lista. O mesmo colaborador vale para acidente e absenteísmo.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='simulation-card'>Nº de cartão</Label>
              <Input
                id='simulation-card'
                inputMode='numeric'
                autoComplete='off'
                value={displayCardNumber(cardNumber)}
                onChange={(e) =>
                  setCardNumber(parseCardNumberInput(e.target.value))
                }
                placeholder='Ex.: 5485'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='simulation-unit'>Unidade</Label>
              <Select
                value={unit}
                onValueChange={(value) => setUnit(value as Unit)}
              >
                <SelectTrigger id='simulation-unit'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {matchedEmployee ? (
            <p className='rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900'>
              Cadastro encontrado:{' '}
              <span className='font-medium'>{matchedEmployee.name}</span> ·
              cartão {displayCardNumber(matchedEmployee.cardNumber)} ·{' '}
              {matchedEmployee.unit} · CC {matchedEmployee.costCenter} ·{' '}
              {matchedEmployee.sectorName}
            </p>
          ) : apiCard ? (
            <p className='text-sm text-destructive'>
              Nenhum colaborador ativo com cartão {displayCardNumber(apiCard)}{' '}
              na unidade {unit}.
            </p>
          ) : (
            <p className='text-sm text-muted-foreground'>
              Preencha cartão e unidade ou selecione um colaborador abaixo.
            </p>
          )}

          <div className='space-y-2'>
            <Label htmlFor='employee-search'>Buscar colaborador</Label>
            <Input
              id='employee-search'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Buscar por nome, cartão, unidade ou setor…'
              autoComplete='off'
            />
            {employeesQuery.isLoading ? (
              <p className='text-sm text-muted-foreground'>
                Carregando colaboradores…
              </p>
            ) : employeesQuery.isError ? (
              <p className='text-sm text-destructive'>
                Não foi possível carregar colaboradores.
              </p>
            ) : employees.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                Nenhum colaborador com setor. Sincronize setores/colaboradores
                no P5.
              </p>
            ) : (
              <div className='max-h-56 overflow-y-auto rounded-md border'>
                {filteredEmployees.length === 0 ? (
                  <p className='p-3 text-sm text-muted-foreground'>
                    Nenhum resultado para “{search.trim()}”.
                  </p>
                ) : (
                  <ul className='divide-y'>
                    {filteredEmployees.map((e) => {
                      const key = employeeKey(e);
                      const selected = key === activeKey;
                      return (
                        <li key={e.id}>
                          <button
                            type='button'
                            className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/80 ${
                              selected
                                ? 'bg-muted font-medium'
                                : 'bg-transparent'
                            }`}
                            onClick={() => selectEmployee(e)}
                          >
                            <span>{e.name}</span>
                            <span className='text-xs text-muted-foreground'>
                              Cartão {displayCardNumber(e.cardNumber)} ·{' '}
                              {e.unit} · CC {e.costCenter} · {e.sectorName}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {tab === 'accidents' ? (
        <>
          <Card className='max-w-5xl'>
            <CardHeader>
              <CardTitle>Simular acidente</CardTitle>
              <CardDescription className='text-pretty wrap-break-word'>
                Aplica perda coletiva de fábrica (padrão 2,06 a todos) e perda
                individual à vítima (padrão 20). Se o saldo da fábrica ficar
                abaixo do limiar (70%), o pilar zera para todos no mês. Valores
                vêm do painel de pontuação.
                {workingCycle
                  ? ` Ciclo em trabalho: ${workingCycle.label} (${workingCycle.statusLabel}).`
                  : ' Nenhum ciclo Aberto/Calculado encontrado.'}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-5'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='accident-type'>Tipo de acidente</Label>
                  <Select
                    value={accidentType}
                    onValueChange={(value) =>
                      setAccidentType(value as AccidentKind)
                    }
                  >
                    <SelectTrigger id='accident-type'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='WITH_LEAVE'>Com afastamento</SelectItem>
                      <SelectItem value='WITHOUT_LEAVE'>
                        Sem afastamento
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {accidentType === 'WITH_LEAVE' ? (
                  <div className='space-y-2'>
                    <Label htmlFor='days-away'>Dias de afastamento</Label>
                    <Input
                      id='days-away'
                      type='number'
                      min={0}
                      step={1}
                      value={daysAway}
                      onChange={(e) => setDaysAway(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>

              <div className='flex flex-wrap items-center gap-3'>
                <Button
                  disabled={
                    simulateMutation.isPending ||
                    !matchedEmployee ||
                    !workingCycle
                  }
                  onClick={runAccidentSimulation}
                >
                  {simulateMutation.isPending
                    ? 'Simulando…'
                    : 'Simular acidente'}
                </Button>
                {simulatedCycleId ? (
                  <Button asChild variant='outline'>
                    <Link to={p5SafetyPath(simulatedCycleId)}>
                      Ver pilar Segurança
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className='max-w-5xl'>
            <CardHeader>
              <CardTitle>Ocorrências do ciclo</CardTitle>
              <CardDescription>
                Remover cancela a ocorrência e recalcula o pilar Segurança.
                Reincidência gerada pelo P5 não pode ser apagada aqui.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {simulationAccidentsQuery.isLoading ? (
                <p className='text-sm text-muted-foreground'>
                  Carregando ocorrências…
                </p>
              ) : simulationAccidentsQuery.isError ? (
                <p className='text-sm text-destructive'>
                  Não foi possível carregar as ocorrências.
                </p>
              ) : !workingCycle ? (
                <p className='text-sm text-muted-foreground'>
                  Abra um ciclo no P5 para simular e gerenciar ocorrências.
                </p>
              ) : accidents.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  Nenhuma ocorrência neste ciclo.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/hora</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Cartão / unidade</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Afast.</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accidents.map((accident) => (
                      <TableRow key={accident.id}>
                        <TableCell>
                          {new Date(accident.occurredAt).toLocaleString(
                            'pt-BR',
                            {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          )}
                        </TableCell>
                        <TableCell>{accident.employeeName ?? '—'}</TableCell>
                        <TableCell>
                          {accident.cardNumber
                            ? displayCardNumber(accident.cardNumber)
                            : '—'}
                          {accident.unit ? ` · ${accident.unit}` : ''}
                        </TableCell>
                        <TableCell>
                          {accidentTypeLabel(accident.accidentType)}
                        </TableCell>
                        <TableCell>{accident.daysAway ?? '—'}</TableCell>
                        <TableCell>
                          {accidentStatusLabel(accident.status)}
                        </TableCell>
                        <TableCell>
                          {accident.simulated ? (
                            <Badge variant='secondary'>Simulação</Badge>
                          ) : accident.accidentType === 'FREQUENCY' ? (
                            <Badge variant='secondary'>P5</Badge>
                          ) : (
                            accident.sourceSystem
                          )}
                        </TableCell>
                        <TableCell>
                          {accident.canRemove ? (
                            <Button
                              type='button'
                              size='sm'
                              variant='destructive'
                              disabled={cancelMutation.isPending}
                              onClick={() => setAccidentToRemove(accident)}
                            >
                              Remover
                            </Button>
                          ) : (
                            <span className='text-muted-foreground'>—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card className='max-w-5xl'>
            <CardHeader>
              <CardTitle>Simular absenteísmo</CardTitle>
              <CardDescription className='text-pretty wrap-break-word'>
                Aplica o índice informado ao colaborador identificado pelo
                cartão e unidade, no ciclo editável mais recente, sem consultar
                o Firebird. Abaixo de 100 gera perda coletiva na fábrica (padrão
                1 P5 a todos) e perda individual (padrão 10 P5) nessa pessoa.
                A simulação recalcula o pilar de todos os participantes do ciclo.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-5'>
              {matchedEmployee ? (
                <p className='text-sm text-muted-foreground'>
                  Colaborador:{' '}
                  <span className='font-medium text-foreground'>
                    {matchedEmployee.name}
                  </span>{' '}
                  (cartão {displayCardNumber(matchedEmployee.cardNumber)},{' '}
                  {matchedEmployee.unit})
                </p>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  Informe cartão e unidade no bloco acima.
                </p>
              )}

              <div className='space-y-2'>
                <Label htmlFor='absenteeism-value'>Índice ABSENTEISMO</Label>
                <Input
                  id='absenteeism-value'
                  type='number'
                  min={0}
                  step='0.01'
                  value={absenteeismValue}
                  onChange={(e) => setAbsenteeismValue(e.target.value)}
                />
              </div>

              <div className='flex flex-wrap items-center gap-3'>
                <Button
                  disabled={
                    simulateAbsenteeismMutation.isPending || !matchedEmployee
                  }
                  onClick={runAbsenteeismSimulation}
                >
                  {simulateAbsenteeismMutation.isPending
                    ? 'Simulando…'
                    : 'Aplicar absenteísmo'}
                </Button>
                {absenteeismCycleId ? (
                  <Button asChild variant='outline'>
                    <Link to={p5AbsenteeismPath(absenteeismCycleId)}>
                      Ver pilar Absenteísmo
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className='max-w-5xl'>
            <CardHeader>
              <CardTitle>Calcular absenteísmo do mês</CardTitle>
              <CardDescription className='text-pretty wrap-break-word'>
                Consulta o Firebird e grava a pontuação de todos os
                participantes do ciclo. Janeiro aberto ainda mostra “Aguardando
                cálculo” até este recálculo ou o cron das 00:30. Ciclo
                homologado ou bloqueado não pode ser alterado.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-5'>
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='absenteeism-calc-month'>Mês</Label>
                  <Select
                    value={String(selectedCalcMonth)}
                    onValueChange={(value) => setCalcMonth(Number(value))}
                  >
                    <SelectTrigger id='absenteeism-calc-month'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={String(option.value)}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='absenteeism-calc-year'>Ano</Label>
                  <Input
                    id='absenteeism-calc-year'
                    type='number'
                    min={2000}
                    max={2100}
                    value={selectedCalcYear}
                    onChange={(e) => setCalcYear(Number(e.target.value))}
                  />
                </div>
              </div>

              {selectedCalcCycle ? (
                <p className='text-sm text-muted-foreground'>
                  Ciclo {selectedMonthLabel}/{selectedCalcYear}:{' '}
                  <span className='font-medium text-foreground'>
                    {CYCLE_STATUS_LABELS[selectedCalcCycle.status]}
                  </span>
                </p>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  Nenhum ciclo encontrado para {selectedMonthLabel}/
                  {selectedCalcYear} neste programa.
                </p>
              )}

              {selectedIsCurrentMonth ? (
                <p className='rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900'>
                  Este é o mês civil atual. O resultado será parcial: quem
                  estiver abaixo de 100 já gera perda coletiva e individual, mas
                  o índice ainda pode mudar até o fechamento.
                </p>
              ) : null}

              {selectedIsLocked ? (
                <p className='text-sm text-destructive'>
                  Não é possível atualizar dados do P5 de um ciclo homologado ou
                  bloqueado.
                </p>
              ) : null}

              <div className='flex flex-wrap items-center gap-3'>
                <Button
                  type='button'
                  disabled={
                    forceAbsenteeismMutation.isPending ||
                    selectedIsLocked ||
                    !selectedCalcCycle
                  }
                  onClick={() => setCalcConfirmOpen(true)}
                >
                  {forceAbsenteeismMutation.isPending
                    ? 'Calculando…'
                    : 'Calcular absenteísmo'}
                </Button>
                {forcedAbsenteeismCycleId ? (
                  <Button asChild variant='outline'>
                    <Link to={p5AbsenteeismPath(forcedAbsenteeismCycleId)}>
                      Ver pilar Absenteísmo
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog
        open={Boolean(accidentToRemove)}
        onOpenChange={(open) => {
          if (!open && !cancelMutation.isPending) setAccidentToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta ocorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              {accidentToRemove
                ? `Cancela o acidente ${accidentTypeLabel(accidentToRemove.accidentType).toLowerCase()} de ${accidentToRemove.employeeName ?? 'colaborador'} (cartão ${accidentToRemove.cardNumber ? displayCardNumber(accidentToRemove.cardNumber) : '—'}) e recalcula o pilar Segurança.`
                : 'Cancela a ocorrência e recalcula o pilar Segurança.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              type='button'
              disabled={cancelMutation.isPending}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              type='button'
              disabled={cancelMutation.isPending || !accidentToRemove}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={(event) => {
                event.preventDefault();
                if (!accidentToRemove) return;
                cancelMutation.mutate(accidentToRemove.id);
              }}
            >
              {cancelMutation.isPending ? 'Removendo…' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={calcConfirmOpen} onOpenChange={setCalcConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Calcular absenteísmo de {selectedMonthLabel}/{selectedCalcYear}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIsCurrentMonth
                ? 'Consulta o Firebird e grava um resultado parcial neste ciclo aberto. Quem estiver abaixo de 100 gera perda coletiva e individual, com aviso de que o mês ainda pode mudar. Ciclos homologados não são alterados.'
                : 'Consulta o Firebird e grava a pontuação de Absenteísmo de todos os participantes deste ciclo. Ciclos homologados não são alterados.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              type='button'
              disabled={forceAbsenteeismMutation.isPending}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              type='button'
              disabled={forceAbsenteeismMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                forceAbsenteeismMutation.mutate({
                  month: selectedCalcMonth,
                  year: selectedCalcYear,
                });
              }}
            >
              {forceAbsenteeismMutation.isPending ? 'Calculando…' : 'Calcular'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
