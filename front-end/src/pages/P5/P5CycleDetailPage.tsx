import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarOff,
  CircleDollarSign,
  Factory,
  type LucideIcon,
  Shield,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { p5Api } from '@/services/p5';
import { refetchWhileRecalculating } from '@/utils/p5-live-query';
import { useAuth } from '@/contexts/useAuth';
import { useP5Permissions } from '@/hooks/useP5Permissions';
import type { PillarCode } from '@/config/pillars';
import { p5AbsenteeismPath, p5SafetyPath, ROUTES } from '@/routes/constants';
import { UNIT } from '@/types/auth';
import {
  displayCardNumber,
  parseCardNumberInput,
} from '@/utils/card-number-input';
import {
  auditActionLabel,
  auditEntityTypeLabel,
  cycleStatusLabel,
} from '@/utils/status-labels';
import {
  avgCents,
  centsToUnits,
  floor2,
  formatPercent,
  formatPoints,
  toCents,
} from '@/utils/p5-number';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TablePagination } from '@/components/ui/table-pagination';
import {
  CycleOpenProgressDialog,
  useCycleOpenProgress,
} from './components/CycleOpenProgressDialog';
import { EmployeeSafetyLossDialog } from './components/EmployeeSafetyLossDialog';
import { SectorParticipantsDialog } from './components/SectorParticipantsDialog';
const PARTICIPANTS_PAGE_SIZE = 10;
const SECTORS_PAGE_SIZE = 10;
const PILLARS: Array<{
  code: string;
  label: string;
  icon: LucideIcon;
  live?: boolean;
}> = [
  { code: 'SAFETY', label: 'Segurança', icon: Shield, live: true },
  { code: 'PRODUCTIVITY', label: 'Produtividade', icon: Factory },
  { code: 'QUALITY_5S', label: 'Qualidade 5S', icon: Sparkles },
  { code: 'ABSENTEEISM', label: 'Absenteísmo', icon: CalendarOff, live: true },
  { code: 'REVENUE', label: 'Faturamento', icon: CircleDollarSign },
];
const ABSENTEEISM_P5_MAX = 10;

export function P5CycleDetailPage() {
  const { cycleId = '' } = useParams();
  const { user } = useAuth();
  const { canAccessP5, canManageCycles, canViewPillar, canViewSafety, canViewAbsenteeism, scopeKey } =
    useP5Permissions();
  const queryClient = useQueryClient();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [openConfirmOpen, setOpenConfirmOpen] = useState(false);
  const [cardFilter, setCardFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [sectorNameFilter, setSectorNameFilter] = useState('');
  const [sectorCostCenterFilter, setSectorCostCenterFilter] = useState('');
  const [participantsPage, setParticipantsPage] = useState(1);
  const [sectorsPage, setSectorsPage] = useState(1);
  const [homologateOpen, setHomologateOpen] = useState(false);
  const [scoringRulesOpen, setScoringRulesOpen] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    string | null
  >(null);
  const [selectedSector, setSelectedSector] = useState<{
    sectorId: string;
    sectorName: string;
  } | null>(null);

  const { data: cycle, isLoading } = useQuery({
    queryKey: ['p5', 'cycle', cycleId, scopeKey],
    queryFn: () => p5Api.getCycle(cycleId),
    enabled: Boolean(cycleId) && Boolean(user && canAccessP5),
    refetchInterval: (query) =>
      refetchWhileRecalculating(query.state.data?.recalculating),
  });

  const { data: scoringRules } = useQuery({
    queryKey: ['p5', 'cycle-scoring-rules', cycleId, scopeKey],
    queryFn: () => p5Api.getCycleScoringRules(cycleId),
    enabled: Boolean(cycleId) && Boolean(user && canAccessP5),
  });

  const cardQuery = cardFilter.trim();

  const { data: participantsResult, isLoading: loadingParticipants } =
    useQuery({
      queryKey: [
        'p5',
        'participants',
        cycleId,
        participantsPage,
        PARTICIPANTS_PAGE_SIZE,
        cardQuery,
        unitFilter,
        scopeKey,
      ],
      queryFn: () =>
        p5Api.listParticipants(cycleId, {
          page: participantsPage,
          pageSize: PARTICIPANTS_PAGE_SIZE,
          ...(cardQuery ? { cardNumber: cardQuery } : {}),
          ...(unitFilter !== 'ALL' ? { unit: unitFilter } : {}),
        }),
      enabled: Boolean(cycleId) && Boolean(user && canAccessP5),
      refetchInterval: () => refetchWhileRecalculating(cycle?.recalculating),
    });

  const participants = participantsResult?.participants ?? [];
  const participantsPagination = participantsResult?.pagination;
  const participantsTotal =
    participantsPagination?.totalItems ?? participants.length;
  const participantsTotalPages = participantsPagination?.totalPages ?? 1;
  const participantsPageSize =
    participantsPagination?.pageSize ?? PARTICIPANTS_PAGE_SIZE;
  const participantsStart =
    participantsTotal === 0
      ? 0
      : (participantsPage - 1) * participantsPageSize;

  useEffect(() => {
    setParticipantsPage(1);
  }, [cardQuery, unitFilter, cycleId]);

  const sectorNameQuery = sectorNameFilter.trim();
  const sectorCostCenterQuery = sectorCostCenterFilter.trim();

  useEffect(() => {
    setSectorsPage(1);
  }, [cycleId, sectorNameQuery, sectorCostCenterQuery]);

  const { data: sectorsResult, isLoading: loadingSectors } = useQuery({
    queryKey: [
      'p5',
      'sectors',
      cycleId,
      sectorsPage,
      SECTORS_PAGE_SIZE,
      sectorNameQuery,
      sectorCostCenterQuery,
    ],
    queryFn: () =>
      p5Api.listCycleSectors(cycleId, {
        page: sectorsPage,
        pageSize: SECTORS_PAGE_SIZE,
        ...(sectorNameQuery ? { name: sectorNameQuery } : {}),
        ...(sectorCostCenterQuery
          ? { costCenter: sectorCostCenterQuery }
          : {}),
      }),
    enabled: Boolean(cycleId) && Boolean(user && canAccessP5),
  });

  const sectors = sectorsResult?.sectors ?? [];
  const sectorsPagination = sectorsResult?.pagination;
  const sectorsTotal = sectorsPagination?.totalItems ?? sectors.length;
  const sectorsTotalPages = sectorsPagination?.totalPages ?? 1;
  const sectorsPageSize = sectorsPagination?.pageSize ?? SECTORS_PAGE_SIZE;
  const sectorsStart =
    sectorsTotal === 0 ? 0 : (sectorsPage - 1) * sectorsPageSize;

  const { data: safetyResults } = useQuery({
    queryKey: ['p5', 'safety-results', cycleId, scopeKey],
    queryFn: () => p5Api.getSafetyResults(cycleId),
    enabled: Boolean(cycleId) && Boolean(user && canAccessP5 && canViewSafety),
    refetchInterval: (query) =>
      refetchWhileRecalculating(
        query.state.data?.recalculating || cycle?.recalculating,
      ),
  });

  const { data: accidents = [] } = useQuery({
    queryKey: ['p5', 'accidents', cycleId, scopeKey],
    queryFn: () => p5Api.listAccidents(cycleId),
    enabled: Boolean(cycleId) && Boolean(user && canAccessP5 && canViewSafety),
    refetchInterval: () => refetchWhileRecalculating(cycle?.recalculating),
  });

  const { data: absenteeismResults } = useQuery({
    queryKey: ['p5', 'absenteeism-results', cycleId, scopeKey],
    queryFn: () => p5Api.getAbsenteeismResults(cycleId),
    enabled:
      Boolean(cycleId) && Boolean(user && canAccessP5 && canViewAbsenteeism),
    refetchInterval: (query) =>
      refetchWhileRecalculating(
        query.state.data?.recalculating || cycle?.recalculating,
      ),
  });

  const {
    data: participantSafetyDetail,
    isLoading: loadingParticipantSafety,
    isError: participantSafetyError,
  } = useQuery({
    queryKey: ['p5', 'safety-participant', cycleId, selectedParticipantId, scopeKey],
    queryFn: () =>
      p5Api.getSafetyParticipantDetail(cycleId, selectedParticipantId!),
    enabled:
      Boolean(cycleId) &&
      Boolean(selectedParticipantId) &&
      Boolean(user && canAccessP5 && canViewSafety),
  });

  /** Pontos do pilar Segurança no ciclo (máx. 20). Fonte: média individual da API. */
  const safetyCyclePercent = useMemo(() => {
    if (safetyResults?.factoryWeightedP5Avg != null) {
      return Math.min(
        20,
        Math.max(0, floor2(safetyResults.factoryWeightedP5Avg)),
      );
    }

    const scoresCents = participants
      .filter((p) => p.activeInCycle)
      .map((p) => {
        const safety = p.pillarScores?.find((ps) => ps.pillarCode === 'SAFETY');
        const value = safety?.weightedPoints ?? p.monthlyScore?.totalPoints;
        return value == null ? null : toCents(value);
      })
      .filter((v): v is number => v != null);

    if (scoresCents.length === 0) return null;

    return Math.min(20, Math.max(0, centsToUnits(avgCents(scoresCents))));
  }, [safetyResults?.factoryWeightedP5Avg, participants]);

  const absenteeismCyclePercent = useMemo(() => {
    if (absenteeismResults?.factoryWeightedP5Avg != null) {
      return Math.min(
        ABSENTEEISM_P5_MAX,
        Math.max(0, floor2(absenteeismResults.factoryWeightedP5Avg)),
      );
    }
    return null;
  }, [absenteeismResults?.factoryWeightedP5Avg]);

  const lastOccurrenceAt = useMemo(() => {
    if (accidents.length === 0) return null;
    const latest = accidents.reduce((max, a) =>
      a.occurredAt > max.occurredAt ? a : max,
    );
    return new Date(latest.occurredAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [accidents]);

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['p5', 'audit', cycleId, scopeKey],
    queryFn: () => p5Api.listAudit(cycleId),
    enabled: Boolean(cycleId) && Boolean(user && canAccessP5),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['p5'] });
  };

  const openMutation = useMutation({
    mutationFn: () => p5Api.openCycle(cycleId),
    onSuccess: (result) => {
      setOpenConfirmOpen(false);
      const count = result.sync.participantsUpserted;
      toast.success(
        `Ciclo aberto · ${count} participante${count === 1 ? '' : 's'} sincronizado${count === 1 ? '' : 's'}`,
      );
      invalidate();
    },
  });
  const openProgress = useCycleOpenProgress(openMutation.status);

  const submitMutation = useMutation({
    mutationFn: () => p5Api.submitReview(cycleId),
    onSuccess: () => {
      setReviewOpen(false);
      toast.success('Ciclo enviado para revisão');
      invalidate();
    },
  });
  const homologateMutation = useMutation({
    mutationFn: () => p5Api.homologate(cycleId),
    onSuccess: () => {
      setHomologateOpen(false);
      toast.success('Ciclo homologado e bloqueado');
      invalidate();
    },
  });

  if (!user || !canAccessP5) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  const visiblePillars = PILLARS.filter((pillar) =>
    canViewPillar(pillar.code as PillarCode),
  );
  const seesAllPillars = visiblePillars.length === PILLARS.length;

  if (isLoading || !cycle) {
    return <p className='text-muted-foreground'>Carregando ciclo…</p>;
  }

  const canSubmitReview =
    cycle.status === 'OPEN' || cycle.status === 'CALCULATED';

  return (
    <div className='space-y-6'>
      <CycleOpenProgressDialog
        open={openProgress.visible}
        progress={openProgress.progress}
        phase={openProgress.phase}
      />

      <AlertDialog
        open={reviewOpen}
        onOpenChange={(open) => {
          if (!open && !submitMutation.isPending) setReviewOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmar revisão — {cycle.month}/{cycle.year}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O ciclo será fechado e marcado como revisado. Depois disso será
              possível abrir o próximo mês. Esta ação não homologa o ciclo —
              apenas libera a abertura de um novo ciclo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type='button' disabled={submitMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              type='button'
              disabled={submitMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                submitMutation.mutate();
              }}
            >
              {submitMutation.isPending ? 'Confirmando…' : 'Confirmar revisão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={openConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !openMutation.isPending) setOpenConfirmOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Abrir ciclo {cycle.month}/{cycle.year}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Setores e colaboradores serão sincronizados com a API base. Só é
              possível abrir se não houver outro ciclo em trabalho — confirme a
              revisão do mês anterior antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type='button' disabled={openMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              type='button'
              disabled={openMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                openMutation.mutate();
              }}
            >
              {openMutation.isPending ? 'Abrindo…' : 'Abrir ciclo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={homologateOpen}
        onOpenChange={(open) => {
          if (!open && !homologateMutation.isPending) setHomologateOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Homologar e bloquear este ciclo?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ao homologar o ciclo {cycle.month}/{cycle.year}, ele será
              bloqueado permanentemente. Esta ação é irreversível: não será
              possível alterar ocorrências, recalcular ou sincronizar
              participantes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              type='button'
              disabled={homologateMutation.isPending}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              type='button'
              disabled={homologateMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                homologateMutation.mutate();
              }}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {homologateMutation.isPending
                ? 'Homologando…'
                : 'Homologar e bloquear'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={scoringRulesOpen} onOpenChange={setScoringRulesOpen}>
        <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>
              Lógica de pontuação — {cycle.month}/{cycle.year}
            </DialogTitle>
          </DialogHeader>
          {!scoringRules ? (
            <p className='text-sm text-muted-foreground'>Carregando…</p>
          ) : scoringRules.config.version === 1 ? (
            <div className='space-y-2 text-sm'>
              <Badge variant='secondary'>Regra legada (v1)</Badge>
              <p>{scoringRules.config.safety.note}</p>
              <ul className='list-inside list-disc text-muted-foreground'>
                <li>
                  Com afastamento: −
                  {scoringRules.config.safety.withLeaveInternalPenalty} internos
                </li>
                <li>
                  Sem afastamento: −
                  {scoringRules.config.safety.withoutLeaveInternalPenalty}{' '}
                  internos
                </li>
                <li>
                  Reincidência: −
                  {scoringRules.config.safety.frequencyInternalPenalty} internos
                </li>
              </ul>
            </div>
          ) : (
            <div className='space-y-4 text-sm'>
              <div>
                <p className='font-medium'>Limiar global</p>
                <p className='text-muted-foreground'>
                  Zerar se abaixo de {scoringRules.config.globalZeroBelowPercent}
                  %
                </p>
              </div>
              {scoringRules.config.pillars ? (
                <div>
                  <p className='font-medium'>Overrides por pilar</p>
                  <ul className='mt-1 space-y-1 text-muted-foreground'>
                    {(
                      Object.entries(scoringRules.config.pillars) as Array<
                        [
                          string,
                          { zeroBelowPercent: number | null },
                        ]
                      >
                    ).map(([code, row]) => (
                      <li key={code}>
                        {code}:{' '}
                        {row.zeroBelowPercent == null
                          ? `herda (${scoringRules.config.version === 2 ? scoringRules.config.globalZeroBelowPercent : 70}%)`
                          : `${row.zeroBelowPercent}%`}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {'safety' in scoringRules.config &&
              scoringRules.config.version === 2 ? (
                <div className='space-y-2'>
                  <p className='font-medium'>Segurança</p>
                  <div className='rounded-md border p-3'>
                    <p className='font-medium'>Com afastamento</p>
                    <p>
                      Individual:{' '}
                      {formatPoints(
                        scoringRules.config.safety.withLeave.individualPenaltyP5,
                      )}{' '}
                      · Fábrica:{' '}
                      {formatPoints(
                        scoringRules.config.safety.withLeave.factoryDeductionP5,
                      )}
                    </p>
                  </div>
                  <div className='rounded-md border p-3'>
                    <p className='font-medium'>Sem afastamento</p>
                    <p>
                      Individual:{' '}
                      {formatPoints(
                        scoringRules.config.safety.withoutLeave
                          .individualPenaltyP5,
                      )}{' '}
                      · Fábrica:{' '}
                      {formatPoints(
                        scoringRules.config.safety.withoutLeave
                          .factoryDeductionP5,
                      )}
                    </p>
                  </div>
                </div>
              ) : null}
              {'absenteeism' in scoringRules.config &&
              scoringRules.config.version === 2 ? (
                <div className='space-y-2'>
                  <p className='font-medium'>Absenteísmo</p>
                  <div className='rounded-md border p-3'>
                    <p>
                      Individual (índice &lt; 100):{' '}
                      {formatPoints(
                        scoringRules.config.absenteeism.individualPenaltyP5,
                      )}{' '}
                      · Fábrica:{' '}
                      {formatPoints(
                        scoringRules.config.absenteeism.factoryDeductionP5,
                      )}
                    </p>
                  </div>
                </div>
              ) : null}
              <p className='text-xs text-muted-foreground'>
                Snapshot somente leitura deste ciclo. Alterações no painel não
                mudam ciclos já fechados.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h1>
            Ciclo {cycle.month}/{cycle.year}
          </h1>
          <p className='text-muted-foreground'>{cycle.programName}</p>
          <Badge className='mt-2'>{cycleStatusLabel(cycle.status)}</Badge>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            variant='outline'
            onClick={() => setScoringRulesOpen(true)}
          >
            Lógica de pontuação
          </Button>
          {canManageCycles && cycle.status === 'DRAFT' ? (
            <Button
              disabled={openMutation.isPending}
              onClick={() => setOpenConfirmOpen(true)}
            >
              {openMutation.isPending ? 'Abrindo…' : 'Abrir ciclo'}
            </Button>
          ) : null}
          {canManageCycles && canSubmitReview ? (
            <Button
              disabled={submitMutation.isPending}
              onClick={() => setReviewOpen(true)}
            >
              Confirmar revisão
            </Button>
          ) : null}
          {canManageCycles && cycle.status === 'UNDER_REVIEW' ? (
            <Button
              variant='destructive'
              disabled={homologateMutation.isPending}
              onClick={() => setHomologateOpen(true)}
            >
              Homologar
            </Button>
          ) : null}
        </div>
      </div>

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Participantes</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-medium tabular-nums'>
            {cycle.participantsCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Ocorrências</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-medium tabular-nums'>
            {canViewSafety ? cycle.accidentsCount ?? '—' : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Média da fábrica</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-medium tabular-nums'>
            {sectorsResult?.factory
              ? formatPercent(sectorsResult.factory.averagePoints)
              : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Setores</CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-medium tabular-nums'>
            {sectorsResult?.factory?.sectorsCount ?? '—'}
          </CardContent>
        </Card>
      </div>

      <section className='space-y-3'>
        <h2 className='text-base font-medium'>Pilares</h2>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
          {visiblePillars.map((pillar) => {
            const Icon = pillar.icon;
            const isSafety = pillar.code === 'SAFETY';
            const isAbsenteeism = pillar.code === 'ABSENTEEISM';
            const isSafetyReady =
              isSafety &&
              (Boolean(cycle.calculatedAt) ||
                safetyCyclePercent != null ||
                (safetyResults?.indicatorResults?.length ?? 0) > 0);
            const isAbsenteeismReady =
              isAbsenteeism &&
              ((absenteeismResults?.scoredParticipants ?? 0) > 0 ||
                absenteeismCyclePercent != null);
            const cardClassName =
              'flex items-start gap-3 rounded-lg border bg-card px-3 py-3';

            if (isSafety) {
              const content = isSafetyReady ? (
                <>
                  <span className='flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground'>
                    <Icon className='size-4' aria-hidden />
                  </span>
                  <span className='min-w-0 flex-1 space-y-1'>
                    <span className='flex items-baseline justify-between gap-2'>
                      <span className='truncate text-sm font-medium leading-tight'>
                        {pillar.label}
                      </span>
                      <span className='shrink-0 text-sm font-semibold tabular-nums leading-tight'>
                        {safetyCyclePercent == null
                          ? '—'
                          : `${formatPoints(safetyCyclePercent)} / 20`}
                      </span>
                    </span>
                    <span className='block text-[11px] leading-snug text-muted-foreground'>
                      {lastOccurrenceAt
                        ? `Última: ${lastOccurrenceAt}`
                        : 'Sem ocorrências'}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <span className='flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground'>
                    <Icon className='size-4' aria-hidden />
                  </span>
                  <span className='min-w-0 flex-1'>
                    <span className='block text-sm font-medium leading-tight'>
                      {pillar.label}
                    </span>
                    <span className='mt-0.5 block text-xs text-muted-foreground'>
                      Aguardando cálculo
                    </span>
                  </span>
                </>
              );

              return (
                <Link
                  key={pillar.code}
                  to={p5SafetyPath(cycle.id)}
                  className={`${cardClassName} transition-colors hover:bg-muted/50`}
                >
                  {content}
                </Link>
              );
            }

            if (isAbsenteeism) {
              const penalized = absenteeismResults?.penalizedCount ?? 0;
              const subtitle = !isAbsenteeismReady
                ? 'Aguardando cálculo'
                : absenteeismResults?.isPartial
                  ? penalized > 0
                    ? `Resultado parcial · ${penalized} abaixo de 100`
                    : 'Resultado parcial do mês em andamento'
                  : penalized > 0
                    ? `${penalized} abaixo do índice 100`
                    : '40 individual + 60 setor';

              return (
                <Link
                  key={pillar.code}
                  to={p5AbsenteeismPath(cycle.id)}
                  className={`${cardClassName} transition-colors hover:bg-muted/50`}
                >
                  <span className='flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground'>
                    <Icon className='size-4' aria-hidden />
                  </span>
                  <span className='min-w-0 flex-1 space-y-1'>
                    <span className='flex items-baseline justify-between gap-2'>
                      <span className='truncate text-sm font-medium leading-tight'>
                        {pillar.label}
                      </span>
                      <span className='shrink-0 text-sm font-semibold tabular-nums leading-tight'>
                        {absenteeismCyclePercent == null
                          ? '—'
                          : `${formatPoints(absenteeismCyclePercent)} / ${ABSENTEEISM_P5_MAX}`}
                      </span>
                    </span>
                    <span className='flex flex-wrap items-center gap-1.5 text-[11px] leading-snug text-muted-foreground'>
                      {absenteeismResults?.isPartial ? (
                        <Badge
                          variant='outline'
                          className='gap-1 border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] font-medium text-amber-800'
                        >
                          <TriangleAlert className='size-3' aria-hidden />
                          Parcial
                        </Badge>
                      ) : null}
                      <span>{subtitle}</span>
                    </span>
                  </span>
                </Link>
              );
            }

            return (
              <div
                key={pillar.code}
                aria-disabled
                className='flex items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-3 py-3 opacity-45 grayscale'
              >
                <span className='flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground'>
                  <Icon className='size-4' aria-hidden />
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block text-sm font-medium leading-tight'>
                    {pillar.label}
                  </span>
                  <span className='mt-0.5 block text-xs text-muted-foreground'>
                    Em breve
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <Card className='min-w-0 overflow-hidden'>
        <CardHeader>
          <CardTitle className='text-base'>Setores</CardTitle>
        </CardHeader>
        <CardContent className='min-w-0 space-y-4'>
          <p className='text-sm text-muted-foreground'>
            {seesAllPillars
              ? 'Visão geral do ciclo (todos os pilares). Média do setor = soma dos pontos dos colaboradores ÷ quantidade de colaboradores.'
              : 'Visão dos pilares sob sua responsabilidade. Média do setor = soma dos pontos visíveis ÷ quantidade de colaboradores.'}
          </p>

          <div className='grid gap-3 sm:grid-cols-2 sm:max-w-md'>
            <div className='space-y-2'>
              <Label htmlFor='sector-name-filter'>Nome</Label>
              <Input
                id='sector-name-filter'
                type='search'
                placeholder='Filtrar por nome…'
                value={sectorNameFilter}
                onChange={(e) => setSectorNameFilter(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='sector-cost-center-filter'>Centro de custo</Label>
              <Input
                id='sector-cost-center-filter'
                type='search'
                placeholder='Filtrar por centro de custo…'
                value={sectorCostCenterFilter}
                onChange={(e) => setSectorCostCenterFilter(e.target.value)}
              />
            </div>
          </div>

          {loadingSectors ? (
            <p className='text-muted-foreground'>Carregando setores…</p>
          ) : sectorsTotal === 0 ? (
            <p className='text-muted-foreground'>
              {sectorNameQuery || sectorCostCenterQuery
                ? 'Nenhum setor encontrado com esses filtros.'
                : 'Nenhum setor neste ciclo. Abra o ciclo para sincronizar participantes.'}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Setor</TableHead>
                    <TableHead>Centro de custo</TableHead>
                    <TableHead>Participantes</TableHead>
                    <TableHead>Total de pontos</TableHead>
                    <TableHead>Média</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sectors.map((s) => {
                    const openSector = () => {
                      setSelectedSector({
                        sectorId: s.sectorId,
                        sectorName: s.sectorName,
                      });
                    };
                    return (
                      <TableRow
                        key={s.sectorId}
                        className='cursor-pointer'
                        tabIndex={0}
                        role='button'
                        onClick={openSector}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openSector();
                          }
                        }}
                      >
                        <TableCell className='font-medium'>
                          {s.sectorName}
                        </TableCell>
                        <TableCell>{s.costCenter ?? '—'}</TableCell>
                        <TableCell>{s.employeesCount}</TableCell>
                        <TableCell>{formatPoints(s.totalPoints)}</TableCell>
                        <TableCell>
                          <Badge>{formatPercent(s.averagePoints)}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
        </CardContent>
      </Card>

      <Card className='min-w-0 overflow-hidden'>
        <CardHeader>
          <CardTitle className='text-base'>Participantes</CardTitle>
        </CardHeader>
        <CardContent className='min-w-0 space-y-4'>
          <div className='grid gap-3 sm:grid-cols-2 sm:max-w-md'>
            <div className='space-y-2'>
              <Label htmlFor='participant-card-filter'>Cartão</Label>
              <Input
                id='participant-card-filter'
                type='text'
                inputMode='numeric'
                placeholder='Nº do cartão'
                value={displayCardNumber(cardFilter)}
                onChange={(e) =>
                  setCardFilter(parseCardNumberInput(e.target.value))
                }
                autoComplete='off'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='participant-unit-filter'>Unidade</Label>
              <Select value={unitFilter} onValueChange={setUnitFilter}>
                <SelectTrigger id='participant-unit-filter' className='w-full'>
                  <SelectValue placeholder='Todas' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='ALL'>Todas</SelectItem>
                  {UNIT.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingParticipants ? (
            <p className='text-muted-foreground'>Carregando participantes…</p>
          ) : participantsTotal === 0 ? (
            <p className='text-muted-foreground'>
              {cardQuery || unitFilter !== 'ALL'
                ? 'Nenhum participante com esses filtros.'
                : 'Nenhum participante.'}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cartão</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Pontos (parcial)</TableHead>
                    <TableHead>Ativo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((p) => (
                    <TableRow
                      key={p.id}
                      className={canViewSafety ? 'cursor-pointer' : undefined}
                      tabIndex={canViewSafety ? 0 : undefined}
                      role={canViewSafety ? 'button' : undefined}
                      onClick={
                        canViewSafety
                          ? () => setSelectedParticipantId(p.id)
                          : undefined
                      }
                      onKeyDown={
                        canViewSafety
                          ? (ev) => {
                              if (ev.key === 'Enter' || ev.key === ' ') {
                                ev.preventDefault();
                                setSelectedParticipantId(p.id);
                              }
                            }
                          : undefined
                      }
                    >
                      <TableCell>
                        {displayCardNumber(p.cardNumber)}
                      </TableCell>
                      <TableCell>{p.employeeNameSnapshot}</TableCell>
                      <TableCell>{p.sectorNameSnapshot}</TableCell>
                      <TableCell>{p.unitSnapshot}</TableCell>
                      <TableCell>
                        {p.monthlyScore
                          ? `${formatPoints(p.monthlyScore.totalPoints)}${
                              p.monthlyScore.isPartial ? ' *' : ''
                            }`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {p.activeInCycle ? 'Sim' : 'Não'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <TablePagination
                page={participantsPage}
                totalPages={participantsTotalPages}
                onPageChange={setParticipantsPage}
                className='border-t-0 px-0'
                summary={
                  <>
                    Mostrando{' '}
                    {participantsTotal === 0
                      ? '0–0'
                      : `${participantsStart + 1}–${Math.min(
                          participantsStart + participants.length,
                          participantsTotal,
                        )}`}{' '}
                    de {participantsTotal} participantes
                  </>
                }
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className='text-muted-foreground'>Sem eventos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>{auditActionLabel(log.action)}</TableCell>
                    <TableCell>
                      {auditEntityTypeLabel(log.entityType)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EmployeeSafetyLossDialog
        employee={
          canViewSafety && selectedParticipantId
            ? (participantSafetyDetail?.employee ?? null)
            : null
        }
        loading={
          canViewSafety &&
          Boolean(selectedParticipantId) &&
          loadingParticipantSafety
        }
        error={
          canViewSafety &&
          Boolean(selectedParticipantId) &&
          participantSafetyError
        }
        onClose={() => setSelectedParticipantId(null)}
      />

      <SectorParticipantsDialog
        cycleId={cycleId}
        programYearId={cycle.programYearId}
        sectorId={selectedSector?.sectorId ?? null}
        sectorName={selectedSector?.sectorName}
        onClose={() => setSelectedSector(null)}
      />
    </div>
  );
}
