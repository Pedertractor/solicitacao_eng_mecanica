import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarOff,
  ChevronDown,
  CircleDollarSign,
  Factory,
  type LucideIcon,
  Shield,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { useP5Permissions } from '@/hooks/useP5Permissions';
import type { PillarCode } from '@/config/pillars';
import { p5Api, type AbsenteeismScoreDetails } from '@/services/p5';
import { displayCardNumber } from '@/utils/card-number-input';
import {
  computePercentCents,
  floor2,
  formatPercent,
  formatPoints,
  toCents,
} from '@/utils/p5-number';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SafetyOccurrencesTimeline } from './SafetyOccurrencesTimeline';
import { AbsenteeismEmployeeBreakdown } from './AbsenteeismEmployeeBreakdown';

/** Fallback alinhado ao seed do back-end, se a API de pilares não responder. */
const DEFAULT_PILLAR_MAX: Record<string, number> = {
  SAFETY: 20,
  PRODUCTIVITY: 25,
  QUALITY_5S: 20,
  ABSENTEEISM: 10,
  REVENUE: 25,
};

const ALL_PILLARS: Array<{ code: string; label: string }> = [
  { code: 'SAFETY', label: 'Segurança' },
  { code: 'PRODUCTIVITY', label: 'Produtividade' },
  { code: 'QUALITY_5S', label: 'Qualidade 5S' },
  { code: 'ABSENTEEISM', label: 'Absenteísmo' },
  { code: 'REVENUE', label: 'Faturamento' },
];

const SAFETY_P5_MAX = 20;
const SAFETY_INTERNAL_MAX = 100;

const PILLAR_META: Record<
  string,
  { icon: LucideIcon; color: string; softColor: string }
> = {
  SAFETY: {
    icon: Shield,
    color: 'text-[#08751a]',
    softColor: 'bg-[#08751a]/10',
  },
  PRODUCTIVITY: {
    icon: Factory,
    color: 'text-[#003fb4]',
    softColor: 'bg-[#003fb4]/10',
  },
  QUALITY_5S: {
    icon: Sparkles,
    color: 'text-[#4b008f]',
    softColor: 'bg-[#4b008f]/10',
  },
  ABSENTEEISM: {
    icon: CalendarOff,
    color: 'text-[#f0440b]',
    softColor: 'bg-[#f0440b]/10',
  },
  REVENUE: {
    icon: CircleDollarSign,
    color: 'text-[#006d82]',
    softColor: 'bg-[#006d82]/10',
  },
};

type SectorEmployee = {
  participantId: string;
  employeeId: string;
  name: string;
  costCenter: string | null;
  totalPoints: number;
  pointsSource: 'CALCULATED' | 'BASE';
  isPartial: boolean;
  pillarScores: Array<{
    pillarCode: string;
    pillarName: string;
    weightedPoints: number;
    absenteeism?: AbsenteeismScoreDetails | null;
  }>;
};

function filterVisibleScores(
  scores: SectorEmployee['pillarScores'],
  visiblePillarCodes: Set<string>,
): SectorEmployee['pillarScores'] {
  return scores.filter((score) => visiblePillarCodes.has(score.pillarCode));
}

function visiblePointsForEmployee(
  employee: SectorEmployee,
  visiblePillarCodes: Set<string>,
): number {
  const visibleScores = filterVisibleScores(
    employee.pillarScores,
    visiblePillarCodes,
  );
  if (employee.pillarScores.length === 0) {
    return employee.totalPoints;
  }
  return floor2(
    visibleScores.reduce((sum, score) => sum + score.weightedPoints, 0),
  );
}

type SectorParticipantsDialogProps = {
  cycleId: string;
  programYearId?: string;
  sectorId: string | null;
  sectorName?: string;
  onClose: () => void;
};

export function SectorParticipantsDialog({
  cycleId,
  programYearId,
  sectorId,
  sectorName,
  onClose,
}: SectorParticipantsDialogProps) {
  const { canViewPillar, canViewSafety, scopeKey } = useP5Permissions();
  const visiblePillars = useMemo(
    () =>
      ALL_PILLARS.filter((pillar) =>
        canViewPillar(pillar.code as PillarCode),
      ),
    [canViewPillar],
  );
  const visiblePillarCodes = useMemo(
    () => new Set(visiblePillars.map((pillar) => pillar.code)),
    [visiblePillars],
  );
  const open = sectorId !== null;
  const [selectedEmployee, setSelectedEmployee] =
    useState<SectorEmployee | null>(null);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'back'>(
    'forward',
  );
  const [openPillarCode, setOpenPillarCode] = useState<string | null>(null);
  const [panelAnimKey, setPanelAnimKey] = useState(0);

  useEffect(() => {
    if (!open) {
      setSelectedEmployee(null);
      setSlideDirection('forward');
      setOpenPillarCode(null);
      setPanelAnimKey(0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedEmployee(null);
    setSlideDirection('forward');
    setOpenPillarCode(null);
    setPanelAnimKey(0);
  }, [sectorId]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['p5', 'sector', cycleId, sectorId, scopeKey],
    queryFn: () => p5Api.getCycleSector(cycleId, sectorId!),
    enabled: open && Boolean(cycleId) && Boolean(sectorId),
  });

  const { data: pillars = [] } = useQuery({
    queryKey: ['p5', 'pillars', programYearId, scopeKey],
    queryFn: () => p5Api.listPillars(programYearId!),
    enabled: open && Boolean(programYearId),
  });

  const {
    data: safetyDetail,
    isLoading: loadingSafety,
    isError: safetyError,
  } = useQuery({
    queryKey: [
      'p5',
      'safety-participant',
      cycleId,
      selectedEmployee?.participantId,
      scopeKey,
    ],
    queryFn: () =>
      p5Api.getSafetyParticipantDetail(
        cycleId,
        selectedEmployee!.participantId,
      ),
    enabled:
      open &&
      canViewSafety &&
      Boolean(cycleId) &&
      Boolean(selectedEmployee?.participantId) &&
      Boolean(
        selectedEmployee?.pillarScores.some((p) => p.pillarCode === 'SAFETY'),
      ),
  });

  const {
    data: sectorSafetyDetail,
    isLoading: loadingSectorSafety,
  } = useQuery({
    queryKey: ['p5', 'safety-sector', cycleId, sectorId, 'timeline', scopeKey],
    queryFn: () =>
      p5Api.getSafetySectorDetail(cycleId, sectorId!, { page: 1, pageSize: 1 }),
    enabled:
      open &&
      canViewSafety &&
      Boolean(cycleId) &&
      Boolean(sectorId) &&
      !selectedEmployee,
  });

  const pillarMaxByCode = useMemo(() => {
    const map: Record<string, number> = { ...DEFAULT_PILLAR_MAX };
    for (const pillar of pillars) {
      map[pillar.code] = pillar.maxPoints;
    }
    return map;
  }, [pillars]);

  const maxPerEmployeeVisible = useMemo(() => {
    if (visiblePillars.length === 0) return 0;
    return visiblePillars.reduce(
      (sum, pillar) => sum + (pillarMaxByCode[pillar.code] ?? 0),
      0,
    );
  }, [visiblePillars, pillarMaxByCode]);

  const sectorStats = useMemo(() => {
    if (!data) return null;

    const expectedMax = data.sector.basePointsPerEmployee;
    const expectedTotal = data.sector.employeesCount * expectedMax;
    const averagePercent = computePercentCents(
      toCents(data.sector.averagePoints),
      toCents(expectedMax),
    );

    return {
      employeesCount: data.sector.employeesCount,
      totalPoints: data.sector.totalPoints,
      expectedTotal,
      averagePercent,
    };
  }, [data]);

  const employeeExpectedMax = useMemo(() => {
    if (!selectedEmployee) return 0;
    return data?.sector.basePointsPerEmployee ?? maxPerEmployeeVisible;
  }, [selectedEmployee, data?.sector.basePointsPerEmployee, maxPerEmployeeVisible]);

  const selectedEmployeeVisiblePoints = useMemo(() => {
    if (!selectedEmployee) return 0;
    return visiblePointsForEmployee(
      selectedEmployee,
      visiblePillarCodes,
    );
  }, [selectedEmployee, visiblePillarCodes]);

  const selectedEmployeePercent = useMemo(
    () =>
      computePercentCents(
        toCents(selectedEmployeeVisiblePoints),
        toCents(employeeExpectedMax),
      ),
    [selectedEmployeeVisiblePoints, employeeExpectedMax],
  );

  const scoresByCode = useMemo(() => {
    const map = new Map<
      string,
      {
        pillarCode: string;
        pillarName: string;
        weightedPoints: number;
        absenteeism?: AbsenteeismScoreDetails | null;
      }
    >();
    for (const score of selectedEmployee?.pillarScores ?? []) {
      if (!visiblePillarCodes.has(score.pillarCode)) continue;
      map.set(score.pillarCode, score);
    }
    return map;
  }, [selectedEmployee, visiblePillarCodes]);

  const sectorTitle = (() => {
    const name = data?.sector.sectorName ?? sectorName ?? 'Setor';
    const costCenter = data?.sector.costCenter;
    return costCenter ? `${name} - ${costCenter}` : name;
  })();

  const openEmployee = (employee: SectorEmployee) => {
    setSlideDirection('forward');
    setOpenPillarCode(null);
    setPanelAnimKey((k) => k + 1);
    setSelectedEmployee(employee);
  };

  const backToSector = () => {
    setSlideDirection('back');
    setOpenPillarCode(null);
    setPanelAnimKey((k) => k + 1);
    setSelectedEmployee(null);
  };

  const slideClass =
    panelAnimKey === 0
      ? undefined
      : slideDirection === 'forward'
        ? 'p5-panel-enter-forward'
        : 'p5-panel-enter-back';

  const safetyEmployee = safetyDetail?.employee;
  const safetyIsV2 = Boolean(
    safetyEmployee &&
      (safetyEmployee.scoringRuleVersion === 2 ||
        safetyEmployee.factoryBalanceP5 != null ||
        safetyEmployee.factoryDeductionP5 != null),
  );
  const safetySummary = safetyEmployee
    ? (() => {
        const totalDeduction =
          (safetyEmployee.withLeaveDeduction ?? 0) +
          (safetyEmployee.withoutLeaveDeduction ?? 0) +
          (safetyEmployee.frequencyDeduction ?? 0);
        const internalFinal =
          safetyEmployee.internalScore ??
          Math.max(0, SAFETY_INTERNAL_MAX - totalDeduction);
        const p5Final = safetyEmployee.weightedP5;
        const p5Lost =
          p5Final == null ? null : floor2(SAFETY_P5_MAX - p5Final);
        return {
          totalDeduction,
          internalFinal,
          p5Final,
          p5Lost,
          factoryDeduction: safetyEmployee.factoryDeductionP5 ?? 0,
          individualDeduction: safetyEmployee.individualDeductionP5 ?? 0,
          factoryBalance: safetyEmployee.factoryBalanceP5 ?? null,
          zeroedBy: safetyEmployee.zeroedBy ?? null,
        };
      })()
    : null;

  const occurrences = safetyDetail?.occurrences ?? [];
  const sectorOccurrences = sectorSafetyDetail?.occurrences ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className='flex max-h-[90vh] min-h-0 flex-col gap-4 overflow-hidden sm:max-w-3xl'>
        {isLoading ? (
          <>
            <DialogHeader className='shrink-0'>
              <DialogTitle>{sectorTitle}</DialogTitle>
            </DialogHeader>
            <p className='text-sm text-muted-foreground'>
              Carregando participantes…
            </p>
          </>
        ) : isError ? (
          <>
            <DialogHeader className='shrink-0'>
              <DialogTitle>{sectorTitle}</DialogTitle>
            </DialogHeader>
            <p className='text-sm text-destructive'>
              Não foi possível carregar os participantes deste setor.
            </p>
          </>
        ) : data && selectedEmployee ? (
          <div
            key={`employee-${selectedEmployee.participantId}-${panelAnimKey}`}
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-4 overflow-hidden',
              slideClass,
            )}
          >
            <DialogHeader className='shrink-0 space-y-0'>
              <div className='flex items-start gap-2 pr-8'>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='mt-0.5 size-8 shrink-0'
                  onClick={backToSector}
                  aria-label='Voltar ao setor'
                >
                  <ArrowLeft className='size-4' />
                </Button>
                <div className='min-w-0 space-y-1'>
                  <DialogTitle className='truncate'>
                    {selectedEmployee.name}
                  </DialogTitle>
                  <p className='text-sm text-muted-foreground'>
                    {sectorTitle}
                    {safetyEmployee
                      ? ` · Cartão ${displayCardNumber(safetyEmployee.cardNumber)}`
                      : ''}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className='grid shrink-0 gap-3 sm:grid-cols-2'>
              <div className='rounded-lg border px-3 py-2.5'>
                <p className='text-xs text-muted-foreground'>Pontos</p>
                <p className='mt-0.5 text-xl font-medium tabular-nums'>
                  {formatPoints(selectedEmployeeVisiblePoints)}
                  <span className='text-sm font-normal text-muted-foreground'>
                    {' '}
                    / {formatPoints(employeeExpectedMax)}
                  </span>
                </p>
              </div>
              <div className='rounded-lg border px-3 py-2.5'>
                <p className='text-xs text-muted-foreground'>Média</p>
                <p className='mt-0.5 text-xl font-medium tabular-nums'>
                  {formatPercent(selectedEmployeePercent)}
                </p>
              </div>
            </div>

            <div className='min-h-0 flex-1 space-y-4 overflow-y-auto pr-1'>
              <section className='space-y-2'>
                <h3 className='text-sm font-medium'>Pilares</h3>
                <div className='space-y-2'>
                  {visiblePillars.map((pillar) => {
                    const meta = PILLAR_META[pillar.code];
                    const Icon = meta?.icon ?? Shield;
                    const score = scoresByCode.get(pillar.code);
                    const ready = Boolean(score);
                    const max = pillarMaxByCode[pillar.code] ?? 0;
                    const isOpen = openPillarCode === pillar.code;

                    return (
                      <Collapsible
                        key={pillar.code}
                        open={isOpen}
                        onOpenChange={(nextOpen) => {
                          if (!ready) return;
                          setOpenPillarCode(nextOpen ? pillar.code : null);
                        }}
                      >
                        <div
                          className={cn(
                            'overflow-hidden rounded-lg border',
                            !ready && 'opacity-60',
                          )}
                        >
                          <CollapsibleTrigger
                            disabled={!ready}
                            className={cn(
                              'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                              ready && 'hover:bg-muted/40 cursor-pointer',
                              !ready && 'cursor-default',
                            )}
                          >
                            <span
                              className={cn(
                                'flex size-7 shrink-0 items-center justify-center rounded-md',
                                meta?.softColor ?? 'bg-muted',
                                meta?.color ?? 'text-foreground',
                              )}
                            >
                              <Icon className='size-3.5' aria-hidden />
                            </span>
                            <span className='min-w-0 flex-1 truncate text-sm font-medium'>
                              {pillar.label}
                            </span>
                            {ready ? (
                              <>
                                {pillar.code === 'ABSENTEEISM' &&
                                score?.absenteeism?.partial ? (
                                  <Badge
                                    variant='outline'
                                    className='gap-1 border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] font-medium text-amber-800'
                                  >
                                    <TriangleAlert
                                      className='size-3'
                                      aria-hidden
                                    />
                                    Parcial
                                  </Badge>
                                ) : null}
                                <span className='shrink-0 text-sm font-semibold tabular-nums'>
                                  {formatPoints(score!.weightedPoints)}
                                  <span className='ml-1 text-xs font-normal text-muted-foreground'>
                                    / {formatPoints(max)}
                                  </span>
                                </span>
                                <ChevronDown
                                  className={cn(
                                    'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                                    isOpen && 'rotate-180',
                                  )}
                                  aria-hidden
                                />
                              </>
                            ) : (
                              <Badge variant='outline' className='text-[10px]'>
                                Em breve
                              </Badge>
                            )}
                          </CollapsibleTrigger>

                          {ready ? (
                            <CollapsibleContent className='border-t px-3 py-3'>
                              {pillar.code === 'SAFETY' ? (
                                <div className='space-y-3 text-sm'>
                                  <p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
                                    Onde perdeu pontos
                                  </p>
                                  {loadingSafety ? (
                                    <p className='text-muted-foreground'>
                                      Carregando…
                                    </p>
                                  ) : safetyError ||
                                    !safetyEmployee ||
                                    !safetySummary ? (
                                    <p className='text-destructive'>
                                      Não foi possível carregar o detalhamento
                                      de Segurança.
                                    </p>
                                  ) : (
                                    <>
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Categoria</TableHead>
                                            <TableHead className='text-right'>
                                              Qtd.
                                            </TableHead>
                                            <TableHead className='text-right'>
                                              Perda
                                            </TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {safetyIsV2 ? (
                                            <>
                                              <TableRow>
                                                <TableCell>
                                                  Com afastamento
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                  {safetyEmployee.withLeave}
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                  —
                                                </TableCell>
                                              </TableRow>
                                              <TableRow>
                                                <TableCell>
                                                  Sem afastamento
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                  {safetyEmployee.withoutLeave}
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                  —
                                                </TableCell>
                                              </TableRow>
                                              <TableRow>
                                                <TableCell>
                                                  Perda coletiva (fábrica)
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                  —
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                  {safetySummary.factoryDeduction >
                                                  0
                                                    ? `−${formatPoints(safetySummary.factoryDeduction)}`
                                                    : '0'}
                                                </TableCell>
                                              </TableRow>
                                              <TableRow>
                                                <TableCell>
                                                  Perda individual (vítima)
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                  —
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                  {safetySummary.individualDeduction >
                                                  0
                                                    ? `−${formatPoints(safetySummary.individualDeduction)}`
                                                    : '0'}
                                                </TableCell>
                                              </TableRow>
                                            </>
                                          ) : (
                                            <>
                                              <TableRow>
                                                <TableCell>
                                                  Com afastamento (−50 cada)
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                  {safetyEmployee.withLeave}
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                  {(safetyEmployee.withLeaveDeduction ??
                                                    0) > 0
                                                    ? `−${safetyEmployee.withLeaveDeduction}`
                                                    : '0'}
                                                </TableCell>
                                              </TableRow>
                                              <TableRow>
                                                <TableCell>
                                                  Sem afastamento (−30 cada)
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                  {safetyEmployee.withoutLeave}
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                  {(safetyEmployee.withoutLeaveDeduction ??
                                                    0) > 0
                                                    ? `−${safetyEmployee.withoutLeaveDeduction}`
                                                    : '0'}
                                                </TableCell>
                                              </TableRow>
                                              <TableRow>
                                                <TableCell>
                                                  Reincidência (−20 se 2+
                                                  acidentes)
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                  {safetyEmployee.isRecidivist
                                                    ? 'Sim'
                                                    : 'Não'}
                                                </TableCell>
                                                <TableCell className='text-right'>
                                                  {(safetyEmployee.frequencyDeduction ??
                                                    0) > 0
                                                    ? `−${safetyEmployee.frequencyDeduction}`
                                                    : '0'}
                                                </TableCell>
                                              </TableRow>
                                            </>
                                          )}
                                        </TableBody>
                                      </Table>

                                      <div className='space-y-3 rounded-md border p-3'>
                                        {safetyIsV2 ? (
                                          <div className='space-y-1'>
                                            <div className='flex justify-between gap-4'>
                                              <span className='text-muted-foreground'>
                                                Base do pilar
                                              </span>
                                              <span className='tabular-nums'>
                                                {formatPoints(SAFETY_P5_MAX)}
                                              </span>
                                            </div>
                                            {safetySummary.factoryBalance !=
                                            null ? (
                                              <div className='flex justify-between gap-4'>
                                                <span className='text-muted-foreground'>
                                                  Saldo após perda coletiva
                                                </span>
                                                <span className='tabular-nums'>
                                                  {formatPoints(
                                                    safetySummary.factoryBalance,
                                                  )}
                                                </span>
                                              </div>
                                            ) : null}
                                            {safetySummary.individualDeduction >
                                            0 ? (
                                              <div className='flex justify-between gap-4'>
                                                <span className='text-muted-foreground'>
                                                  − individual
                                                </span>
                                                <span className='tabular-nums'>
                                                  −
                                                  {formatPoints(
                                                    safetySummary.individualDeduction,
                                                  )}
                                                </span>
                                              </div>
                                            ) : null}
                                            {safetySummary.zeroedBy ===
                                            'factory_threshold' ? (
                                              <p className='text-destructive'>
                                                Zerado: fábrica abaixo do limiar
                                              </p>
                                            ) : null}
                                            {safetySummary.zeroedBy ===
                                            'individual_threshold' ? (
                                              <p className='text-destructive'>
                                                Zerado: individual abaixo do
                                                limiar
                                              </p>
                                            ) : null}
                                            <div className='flex justify-between gap-4 border-t pt-2 font-medium'>
                                              <span>Resultado</span>
                                              <span className='tabular-nums'>
                                                {safetySummary.p5Final == null
                                                  ? '—'
                                                  : `${formatPoints(safetySummary.p5Final)} / ${formatPoints(SAFETY_P5_MAX)}`}
                                              </span>
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <div className='space-y-1'>
                                              <p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
                                                Pontuação interna (legado)
                                              </p>
                                              <div className='flex justify-between gap-4'>
                                                <span className='text-muted-foreground'>
                                                  Tinha (base)
                                                </span>
                                                <span>
                                                  {SAFETY_INTERNAL_MAX}
                                                </span>
                                              </div>
                                              <div className='flex justify-between gap-4'>
                                                <span className='text-muted-foreground'>
                                                  Total descontado
                                                </span>
                                                <span>
                                                  −{safetySummary.totalDeduction}
                                                </span>
                                              </div>
                                              <div className='flex justify-between gap-4 font-medium'>
                                                <span>Ficou com</span>
                                                <span>
                                                  {safetySummary.internalFinal}
                                                </span>
                                              </div>
                                            </div>

                                            <div className='space-y-1 border-t pt-3'>
                                              <p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
                                                Pts P5 (pilar Segurança)
                                              </p>
                                              <div className='flex justify-between gap-4'>
                                                <span className='text-muted-foreground'>
                                                  Tinha (máx. do pilar)
                                                </span>
                                                <span>
                                                  {formatPoints(SAFETY_P5_MAX)}
                                                </span>
                                              </div>
                                              <div className='flex justify-between gap-4'>
                                                <span className='text-muted-foreground'>
                                                  Perdeu
                                                </span>
                                                <span>
                                                  {safetySummary.p5Lost == null
                                                    ? '—'
                                                    : safetySummary.p5Lost > 0
                                                      ? `−${formatPoints(safetySummary.p5Lost)}`
                                                      : formatPoints(0)}
                                                </span>
                                              </div>
                                              <div className='flex justify-between gap-4 font-medium'>
                                                <span>Ficou com</span>
                                                <span>
                                                  {safetySummary.p5Final == null
                                                    ? '—'
                                                    : formatPoints(
                                                        safetySummary.p5Final,
                                                      )}
                                                </span>
                                              </div>
                                            </div>
                                          </>
                                        )}
                                      </div>

                                      {safetySummary.totalDeduction === 0 ? (
                                        <p className='text-muted-foreground'>
                                          Este colaborador não perdeu pontos em
                                          Segurança neste ciclo.
                                        </p>
                                      ) : null}
                                    </>
                                  )}
                                </div>
                              ) : pillar.code === 'ABSENTEEISM' ? (
                                <AbsenteeismEmployeeBreakdown
                                  weightedPoints={score!.weightedPoints}
                                  details={score?.absenteeism ?? null}
                                />
                              ) : (
                                <p className='text-sm text-muted-foreground'>
                                  Detalhamento de {pillar.label} em breve.
                                </p>
                              )}
                            </CollapsibleContent>
                          ) : null}
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </section>

              {canViewSafety ? (
                <SafetyOccurrencesTimeline
                  occurrences={occurrences}
                  isLoading={
                    loadingSafety &&
                    selectedEmployee.pillarScores.some(
                      (p) => p.pillarCode === 'SAFETY',
                    )
                  }
                />
              ) : null}
            </div>
          </div>
        ) : data ? (
          <div
            key={`sector-list-${panelAnimKey}`}
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-4 overflow-hidden',
              slideClass,
            )}
          >
            <DialogHeader className='shrink-0'>
              <DialogTitle>{sectorTitle}</DialogTitle>
            </DialogHeader>

            {sectorStats ? (
              <div className='grid shrink-0 gap-3 sm:grid-cols-3'>
                <div className='rounded-lg border px-3 py-2.5'>
                  <p className='text-xs text-muted-foreground'>Participantes</p>
                  <p className='mt-0.5 text-xl font-medium tabular-nums'>
                    {sectorStats.employeesCount}
                  </p>
                </div>
                <div className='rounded-lg border px-3 py-2.5'>
                  <p className='text-xs text-muted-foreground'>Total</p>
                  <p className='mt-0.5 text-xl font-medium tabular-nums'>
                    {formatPoints(sectorStats.totalPoints)}
                    <span className='text-sm font-normal text-muted-foreground'>
                      {' '}
                      / {formatPoints(sectorStats.expectedTotal)}
                    </span>
                  </p>
                </div>
                <div className='rounded-lg border px-3 py-2.5'>
                  <p className='text-xs text-muted-foreground'>Média</p>
                  <p className='mt-0.5 text-xl font-medium tabular-nums'>
                    {formatPercent(sectorStats.averagePercent)}
                  </p>
                </div>
              </div>
            ) : null}

            <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1'>
              {data.employees.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  Nenhum participante neste setor.
                </p>
              ) : (
                <Table>
                  <TableHeader className='sticky top-0 z-10 bg-background'>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Pilares</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...data.employees]
                      .map((e) => ({
                        employee: e,
                        visibleScores: filterVisibleScores(
                          e.pillarScores,
                          visiblePillarCodes,
                        ),
                        visiblePoints: visiblePointsForEmployee(
                          e,
                          visiblePillarCodes,
                        ),
                      }))
                      .sort((a, b) => a.visiblePoints - b.visiblePoints)
                      .map(({ employee: e, visibleScores, visiblePoints }) => (
                        <TableRow
                          key={e.participantId}
                          className='cursor-pointer'
                          tabIndex={0}
                          role='button'
                          onClick={() => openEmployee(e)}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter' || ev.key === ' ') {
                              ev.preventDefault();
                              openEmployee(e);
                            }
                          }}
                        >
                          <TableCell className='font-medium'>
                            <span className='inline-flex flex-wrap items-center gap-1.5'>
                              {e.name}
                              {visibleScores.some(
                                (p) =>
                                  p.pillarCode === 'ABSENTEEISM' &&
                                  p.absenteeism?.partial &&
                                  p.absenteeism.individualDeducted,
                              ) ? (
                                <Badge
                                  variant='outline'
                                  className='gap-1 border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] font-medium text-amber-800'
                                >
                                  <TriangleAlert
                                    className='size-3'
                                    aria-hidden
                                  />
                                  Parcial
                                </Badge>
                              ) : null}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge>{formatPoints(visiblePoints)}</Badge>
                          </TableCell>
                          <TableCell>
                            {visibleScores.length === 0 ? (
                              '—'
                            ) : (
                              <div className='flex flex-wrap items-center gap-1.5'>
                                {visibleScores.map((p) => {
                                  const meta = PILLAR_META[p.pillarCode];
                                  const Icon = meta?.icon ?? Shield;
                                  return (
                                    <span
                                      key={p.pillarCode}
                                      className='inline-flex items-center gap-1'
                                      title={`${p.pillarName}: ${formatPoints(p.weightedPoints)}`}
                                    >
                                      <span
                                        className={cn(
                                          'flex size-5 shrink-0 items-center justify-center rounded-sm',
                                          meta?.softColor ?? 'bg-muted',
                                          meta?.color ?? 'text-foreground',
                                        )}
                                      >
                                        <Icon
                                          className='size-3'
                                          aria-hidden
                                        />
                                      </span>
                                      <span className='text-xs tabular-nums text-muted-foreground'>
                                        {formatPoints(p.weightedPoints)}
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}

              {canViewSafety ? (
                <SafetyOccurrencesTimeline
                  occurrences={sectorOccurrences}
                  isLoading={loadingSectorSafety}
                  defaultOpen={false}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
