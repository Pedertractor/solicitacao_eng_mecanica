import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { p5Api, type MonthlyCycle } from '@/services/p5';
import { useAuth } from '@/contexts/useAuth';
import { useP5Permissions } from '@/hooks/useP5Permissions';
import { p5CyclePath, ROUTES } from '@/routes/constants';
import { cycleStatusLabel } from '@/utils/status-labels';
import { preferredDraftCycle } from './preferredDraftCycle';
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
  CycleOpenProgressDialog,
  useCycleOpenProgress,
} from './components/CycleOpenProgressDialog';

const MONTH_LABELS = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const VISIBLE_STATUSES = new Set([
  'OPEN',
  'CALCULATED',
  'UNDER_REVIEW',
  'HOMOLOGATED',
  'LOCKED',
]);

function monthLabel(cycle: Pick<MonthlyCycle, 'month' | 'year'>) {
  return `${MONTH_LABELS[cycle.month] ?? cycle.month}/${cycle.year}`;
}

export function P5CyclesPage() {
  const { user } = useAuth();
  const { canAccessP5, canManageCycles } = useP5Permissions();
  const queryClient = useQueryClient();
  const [reviewCycle, setReviewCycle] = useState<MonthlyCycle | null>(null);
  const [openConfirmCycle, setOpenConfirmCycle] = useState<MonthlyCycle | null>(
    null,
  );
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  const { data: programs = [] } = useQuery({
    queryKey: ['p5', 'program-years'],
    queryFn: () => p5Api.listProgramYears(),
    enabled: Boolean(user && canAccessP5),
  });
  const activeProgram =
    programs.find((p) => p.active) ?? programs[0] ?? null;

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ['p5', 'cycles', activeProgram?.id],
    queryFn: () =>
      p5Api.listCycles(
        activeProgram ? { programYearId: activeProgram.id } : undefined,
      ),
    enabled: Boolean(user && canAccessP5),
  });

  const ensureMutation = useMutation({
    mutationFn: () => p5Api.ensureYearCycles(activeProgram!.id),
    onSuccess: (result) => {
      toast.success(
        result.created > 0
          ? `${result.created} ciclos criados (total ${result.total}/12)`
          : `Ano completo já existia (${result.total}/12 ciclos)`,
      );
      void queryClient.invalidateQueries({ queryKey: ['p5', 'cycles'] });
    },
  });

  const openMutation = useMutation({
    mutationFn: (cycleId: string) => p5Api.openCycle(cycleId),
    onSuccess: (result) => {
      setOpenConfirmCycle(null);
      const participants = result.sync.participantsUpserted;
      toast.success(
        `Ciclo aberto · ${participants} participante${participants === 1 ? '' : 's'} sincronizado${participants === 1 ? '' : 's'}`,
      );
      void queryClient.invalidateQueries({ queryKey: ['p5'] });
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: (cycleId: string) => p5Api.submitReview(cycleId),
    onSuccess: () => {
      setReviewCycle(null);
      toast.success('Ciclo enviado para revisão');
      void queryClient.invalidateQueries({ queryKey: ['p5'] });
    },
  });

  const openProgress = useCycleOpenProgress(openMutation.status);

  if (!user || !canAccessP5) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  const sortedCycles = [...cycles].sort((a, b) => a.month - b.month);
  const visibleCycles = sortedCycles.filter((c) =>
    VISIBLE_STATUSES.has(c.status),
  );
  const workingCycle = sortedCycles.find(
    (c) => c.status === 'OPEN' || c.status === 'CALCULATED',
  );
  const draftCycles = sortedCycles.filter((c) => c.status === 'DRAFT');
  const selectedDraft =
    draftCycles.find((c) => c.id === selectedDraftId) ??
    preferredDraftCycle(draftCycles);
  const canOpenSelected = Boolean(selectedDraft) && !workingCycle;

  return (
    <div className='space-y-6'>
      <CycleOpenProgressDialog
        open={openProgress.visible}
        progress={openProgress.progress}
        phase={openProgress.phase}
      />

      <AlertDialog
        open={Boolean(reviewCycle)}
        onOpenChange={(open) => {
          if (!open && !submitReviewMutation.isPending) setReviewCycle(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmar revisão
              {reviewCycle ? ` — ${monthLabel(reviewCycle)}` : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O ciclo será fechado e marcado como revisado. Depois disso será
              possível abrir outro mês. Esta ação não homologa o ciclo — apenas
              libera a abertura de um novo ciclo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type='button' disabled={submitReviewMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              type='button'
              disabled={!reviewCycle || submitReviewMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (reviewCycle) submitReviewMutation.mutate(reviewCycle.id);
              }}
            >
              {submitReviewMutation.isPending
                ? 'Confirmando…'
                : 'Confirmar revisão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(openConfirmCycle)}
        onOpenChange={(open) => {
          if (!open && !openMutation.isPending) setOpenConfirmCycle(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Abrir ciclo
              {openConfirmCycle ? ` ${monthLabel(openConfirmCycle)}` : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Setores e colaboradores serão sincronizados com a API base. Meses
              em rascunho que você pular continuam fechados e não entram no
              consolidado do ano. Só é possível abrir um novo ciclo quando não
              há outro em trabalho.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type='button' disabled={openMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              type='button'
              disabled={!openConfirmCycle || openMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (openConfirmCycle) openMutation.mutate(openConfirmCycle.id);
              }}
            >
              {openMutation.isPending ? 'Abrindo…' : 'Abrir ciclo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div>
        <h1>Ciclos mensais</h1>
        <p className='text-muted-foreground'>
          Exibimos apenas ciclos abertos ou já finalizados. Cada colaborador
          inicia o mês com 100 pontos (preservação) — até 1.200 pontos no ano.
          O admin escolhe qual mês abrir; não é obrigatório seguir a ordem do
          calendário. Para abrir outro mês, confirme a revisão do ciclo em
          trabalho.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>
            {activeProgram?.name ?? 'Programa anual'}
          </CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <Badge variant='secondary'>100 pts / mês</Badge>
            <Badge variant='secondary'>1.200 pts / ano</Badge>
            <Badge variant='outline'>
              {visibleCycles.length} visíveis · {sortedCycles.length}/12 gerados
            </Badge>
            {canManageCycles && sortedCycles.length < 12 ? (
              <Button
                type='button'
                variant='outline'
                disabled={
                  !activeProgram ||
                  ensureMutation.isPending ||
                  openMutation.isPending
                }
                onClick={() => ensureMutation.mutate()}
              >
                Garantir 12 ciclos do ano
              </Button>
            ) : null}
            {canManageCycles && workingCycle ? (
              <Button
                type='button'
                variant='secondary'
                disabled={submitReviewMutation.isPending}
                onClick={() => setReviewCycle(workingCycle)}
              >
                Confirmar revisão de {monthLabel(workingCycle)}
              </Button>
            ) : null}
          </div>
          {canManageCycles && draftCycles.length > 0 ? (
            <div className='flex flex-wrap items-end gap-3'>
              <div className='space-y-2 sm:w-64'>
                <Label htmlFor='open-cycle-month'>Mês a abrir</Label>
                <Select
                  value={selectedDraft?.id ?? ''}
                  onValueChange={setSelectedDraftId}
                  disabled={openMutation.isPending}
                >
                  <SelectTrigger id='open-cycle-month' className='w-full'>
                    <SelectValue placeholder='Selecione o mês' />
                  </SelectTrigger>
                  <SelectContent>
                    {draftCycles.map((cycle) => (
                      <SelectItem key={cycle.id} value={cycle.id}>
                        {monthLabel(cycle)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type='button'
                disabled={!canOpenSelected || openMutation.isPending}
                title={
                  workingCycle
                    ? `Revise ${monthLabel(workingCycle)} antes de abrir outro ciclo`
                    : undefined
                }
                onClick={() => {
                  if (selectedDraft) setOpenConfirmCycle(selectedDraft);
                }}
              >
                {selectedDraft
                  ? `Abrir ${monthLabel(selectedDraft)}`
                  : 'Abrir ciclo'}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isLoading ? (
        <p className='text-muted-foreground'>Carregando…</p>
      ) : visibleCycles.length === 0 ? (
        <p className='text-muted-foreground'>
          Nenhum ciclo aberto ou finalizado. Use “Garantir 12 ciclos do ano” e
          depois escolha o mês que deseja abrir.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead>Ano</TableHead>
              <TableHead>Programa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Base (pts)</TableHead>
              <TableHead>Participantes</TableHead>
              <TableHead>Cálculo</TableHead>
              <TableHead>Homologação</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleCycles.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  {MONTH_LABELS[c.month] ?? c.month}
                </TableCell>
                <TableCell>{c.year}</TableCell>
                <TableCell>{c.programName}</TableCell>
                <TableCell>
                  <Badge>{cycleStatusLabel(c.status)}</Badge>
                </TableCell>
                <TableCell>{c.basePointsPerEmployee ?? 100}</TableCell>
                <TableCell>{c.participantsCount}</TableCell>
                <TableCell>
                  {c.calculatedAt
                    ? new Date(c.calculatedAt).toLocaleString('pt-BR')
                    : '—'}
                </TableCell>
                <TableCell>
                  {c.homologatedAt
                    ? new Date(c.homologatedAt).toLocaleString('pt-BR')
                    : '—'}
                </TableCell>
                <TableCell className='space-x-2'>
                  <Button asChild size='sm' variant='outline'>
                    <Link to={p5CyclePath(c.id)}>Detalhe</Link>
                  </Button>
                  {canManageCycles &&
                  (c.status === 'OPEN' || c.status === 'CALCULATED') ? (
                    <Button
                      size='sm'
                      variant='secondary'
                      disabled={submitReviewMutation.isPending}
                      onClick={() => setReviewCycle(c)}
                    >
                      Confirmar revisão
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
