import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { p5Api } from '@/services/p5';
import { useAuth } from '@/contexts/useAuth';
import { canManageP5Configuration } from '@/config/permissions';
import { ROUTES } from '@/routes/constants';
import {
  calculationTypeLabel,
  indicatorScopeLabel,
  sourceSystemLabel,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function P5ConfigPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const allowed = Boolean(user && canManageP5Configuration(user.role));
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncPhase, setSyncPhase] = useState('');
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);

  const { data: programs = [] } = useQuery({
    queryKey: ['p5', 'program-years'],
    queryFn: () => p5Api.listProgramYears(),
    enabled: allowed,
  });
  const activeProgram =
    programs.find((p) => p.active) ?? programs[0] ?? null;

  const { data: pillars = [], isLoading } = useQuery({
    queryKey: ['p5', 'pillars', activeProgram?.id],
    queryFn: () => p5Api.listPillars(activeProgram!.id),
    enabled: Boolean(activeProgram) && allowed,
  });

  const syncMutation = useMutation({
    mutationFn: () => p5Api.syncEmployees(),
    onSuccess: (summary) => {
      setSyncConfirmOpen(false);
      setSyncProgress(100);
      setSyncPhase('Concluído');
      toast.success('Setores e colaboradores sincronizados');
      console.info('P5 sync summary', summary);
      void queryClient.invalidateQueries({ queryKey: ['p5'] });
      window.setTimeout(() => {
        setSyncProgress(0);
        setSyncPhase('');
      }, 1200);
    },
    onError: () => {
      setSyncProgress(0);
      setSyncPhase('');
    },
  });

  const purgeMutation = useMutation({
    mutationFn: () => p5Api.purgeEmployeesAndSectors(),
    onSuccess: (summary) => {
      setPurgeConfirmOpen(false);
      toast.success(
        `Removidos ${summary.employees} colaboradores e ${summary.sectors} setores`,
      );
      void queryClient.invalidateQueries({ queryKey: ['p5'] });
    },
  });

  useEffect(() => {
    if (!syncMutation.isPending) return;

    setSyncProgress(8);
    setSyncPhase('Buscando setores e colaboradores na API…');

    const timer = window.setInterval(() => {
      setSyncProgress((prev) => {
        if (prev >= 92) return prev;
        const next = prev + Math.max(1, (92 - prev) * 0.06);
        if (next > 40 && next <= 70) {
          setSyncPhase('Relacionando colaboradores aos setores…');
        } else if (next > 70) {
          setSyncPhase('Finalizando sincronização…');
        }
        return next;
      });
    }, 400);

    return () => window.clearInterval(timer);
  }, [syncMutation.isPending]);

  if (!user || !canManageP5Configuration(user.role)) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  const busy = syncMutation.isPending || purgeMutation.isPending;
  const showSyncProgress = syncMutation.isPending || syncProgress > 0;

  return (
    <div className='space-y-6'>
      <AlertDialog
        open={purgeConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !purgeMutation.isPending) setPurgeConfirmOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Apagar todos os colaboradores e setores do P5?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove também participantes de ciclo, pontuações e ocorrências
              vinculadas. Contas de login (User) não serão apagadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type='button' disabled={purgeMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              type='button'
              disabled={purgeMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                purgeMutation.mutate();
              }}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {purgeMutation.isPending ? 'Apagando…' : 'Apagar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={syncConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !syncMutation.isPending) setSyncConfirmOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Sincronizar setores e colaboradores?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Serão sincronizados setores (/sector/list) e colaboradores
              (/employee/get), relacionando pelo id do setor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type='button' disabled={syncMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              type='button'
              disabled={syncMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                syncMutation.mutate();
              }}
            >
              {syncMutation.isPending ? 'Sincronizando…' : 'Sincronizar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h1>Configurações P5</h1>
          <p className='text-muted-foreground'>
            Pilares, indicadores e sincronização de base. Setores vêm de{' '}
            <code>/sector/list</code>; colaboradores de <code>/employee/get</code>
            ; o vínculo usa o id do setor na designation. Contas de login (User)
            não são apagadas.
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            variant='destructive'
            disabled={busy}
            onClick={() => setPurgeConfirmOpen(true)}
          >
            Apagar colaboradores e setores
          </Button>
          <Button
            type='button'
            disabled={busy}
            onClick={() => setSyncConfirmOpen(true)}
          >
            {syncMutation.isPending
              ? 'Sincronizando…'
              : 'Sincronizar setores + colaboradores'}
          </Button>
        </div>
      </div>

      {showSyncProgress ? (
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>
              Sincronização em andamento
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex items-center justify-between text-sm'>
              <span className='text-muted-foreground'>
                {syncPhase || 'Preparando…'}
              </span>
              <span className='font-medium tabular-nums'>
                {Math.round(syncProgress)}%
              </span>
            </div>
            <Progress value={syncProgress} />
          </CardContent>
        </Card>
      ) : null}

      {!activeProgram ? (
        <p className='text-muted-foreground'>
          Nenhum programa anual. Execute o seed do back-end.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>{activeProgram.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className='text-muted-foreground'>Carregando…</p>
            ) : (
              pillars.map((pillar) => (
                <div key={pillar.id} className='mb-6'>
                  <div className='mb-2 flex items-center gap-2'>
                    <h2 className='text-lg font-medium'>{pillar.name}</h2>
                    <Badge variant='secondary'>
                      {pillar.maxPoints} pts
                    </Badge>
                    <Badge variant='outline'>{pillar.code}</Badge>
                  </div>
                  {pillar.indicators.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      Indicadores ainda não configurados (pilar futuro).
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Escopo</TableHead>
                          <TableHead>Cálculo</TableHead>
                          <TableHead>Internos</TableHead>
                          <TableHead>Fonte</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pillar.indicators.map((ind) => (
                          <TableRow key={ind.id}>
                            <TableCell>{ind.code}</TableCell>
                            <TableCell>{ind.name}</TableCell>
                            <TableCell>
                              {indicatorScopeLabel(ind.scope)}
                            </TableCell>
                            <TableCell>
                              {calculationTypeLabel(ind.calculationType)}
                            </TableCell>
                            <TableCell>{ind.maxInternalPoints}</TableCell>
                            <TableCell>
                              {sourceSystemLabel(ind.sourceSystem)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
