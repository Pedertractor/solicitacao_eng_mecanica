import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  p5Api,
  type ScoringConfigV2,
  type ScoringPillarCode,
} from '@/services/p5';
import { useAuth } from '@/contexts/useAuth';
import { canManageP5Configuration } from '@/config/permissions';
import { PILLAR_OPTIONS } from '@/config/pillars';
import { ROUTES } from '@/routes/constants';
import {
  deductionFromOccurrences,
  factoryBalanceAfter,
  occurrencesToZero,
  thresholdFloorP5,
} from '@/utils/scoring-rules';
import { formatPoints } from '@/utils/p5-number';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const SAFETY_MAX = 20;
const ABSENTEEISM_MAX = 10;

const PILLAR_MAX: Record<ScoringPillarCode, number> = {
  SAFETY: 20,
  PRODUCTIVITY: 25,
  QUALITY_5S: 20,
  ABSENTEEISM: 10,
  REVENUE: 25,
};

function defaultConfig(): ScoringConfigV2 {
  return {
    version: 2,
    globalZeroBelowPercent: 70,
    pillars: {
      SAFETY: { zeroBelowPercent: null },
      PRODUCTIVITY: { zeroBelowPercent: null },
      QUALITY_5S: { zeroBelowPercent: null },
      ABSENTEEISM: { zeroBelowPercent: null },
      REVENUE: { zeroBelowPercent: null },
    },
    safety: {
      withLeave: { individualPenaltyP5: 20, factoryDeductionP5: 2.06 },
      withoutLeave: { individualPenaltyP5: 20, factoryDeductionP5: 2.06 },
    },
    absenteeism: { individualPenaltyP5: 10, factoryDeductionP5: 1 },
  };
}

function asV2(config: unknown): ScoringConfigV2 {
  const clamp = (v: number, max: number) =>
    Math.min(max, Math.max(0, Number(Number(v).toFixed(2))));

  if (
    config &&
    typeof config === 'object' &&
    (config as ScoringConfigV2).version === 2
  ) {
    const c = config as ScoringConfigV2;
    return {
      ...defaultConfig(),
      ...c,
      pillars: {
        ...defaultConfig().pillars,
        ...c.pillars,
      },
      safety: {
        withLeave: {
          individualPenaltyP5: clamp(
            c.safety?.withLeave?.individualPenaltyP5 ?? 20,
            SAFETY_MAX,
          ),
          factoryDeductionP5: clamp(
            c.safety?.withLeave?.factoryDeductionP5 ?? 2.06,
            SAFETY_MAX,
          ),
        },
        withoutLeave: {
          individualPenaltyP5: clamp(
            c.safety?.withoutLeave?.individualPenaltyP5 ?? 20,
            SAFETY_MAX,
          ),
          factoryDeductionP5: clamp(
            c.safety?.withoutLeave?.factoryDeductionP5 ?? 2.06,
            SAFETY_MAX,
          ),
        },
      },
      absenteeism: {
        individualPenaltyP5: clamp(
          c.absenteeism?.individualPenaltyP5 ?? 10,
          ABSENTEEISM_MAX,
        ),
        factoryDeductionP5: clamp(
          c.absenteeism?.factoryDeductionP5 ?? 1,
          ABSENTEEISM_MAX,
        ),
      },
    };
  }
  return defaultConfig();
}

function effectiveZeroPercent(
  config: ScoringConfigV2,
  code: ScoringPillarCode,
): number {
  const override = config.pillars[code]?.zeroBelowPercent;
  return override == null ? config.globalZeroBelowPercent : override;
}

type AccidentEditorProps = {
  title: string;
  individual: number;
  factory: number;
  zeroBelowPercent: number;
  maxPoints: number;
  individualHint: string;
  factoryHint: string;
  onIndividualChange: (v: number) => void;
  onFactoryChange: (v: number) => void;
};

function AccidentTypeEditor({
  title,
  individual,
  factory,
  zeroBelowPercent,
  maxPoints,
  individualHint,
  factoryHint,
  onIndividualChange,
  onFactoryChange,
}: AccidentEditorProps) {
  const nToZero = occurrencesToZero(maxPoints, zeroBelowPercent, factory);
  const floor = thresholdFloorP5(maxPoints, zeroBelowPercent);
  const balanceAtN =
    Number.isFinite(nToZero) && nToZero < 1000
      ? factoryBalanceAfter(maxPoints, factory, nToZero)
      : null;

  const [occurrencesInput, setOccurrencesInput] = useState(
    Number.isFinite(nToZero) ? String(nToZero) : '3',
  );

  useEffect(() => {
    if (Number.isFinite(nToZero)) {
      setOccurrencesInput(String(nToZero));
    }
  }, [nToZero]);

  function clampPillarPoints(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(maxPoints, Math.max(0, Number(value.toFixed(2))));
  }

  return (
    <div className='space-y-3 rounded-lg border p-4'>
      <p className='font-medium'>{title}</p>
      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='space-y-1.5'>
          <Label>Perda individual (P5)</Label>
          <Input
            type='number'
            min={0}
            max={maxPoints}
            step={0.01}
            value={individual}
            onChange={(e) =>
              onIndividualChange(clampPillarPoints(Number(e.target.value)))
            }
          />
          <p className='text-xs text-muted-foreground'>
            {individualHint}
          </p>
        </div>
        <div className='space-y-1.5'>
          <Label>Perda da fábrica (P5)</Label>
          <Input
            type='number'
            min={0}
            max={maxPoints}
            step={0.01}
            value={factory}
            onChange={(e) =>
              onFactoryChange(clampPillarPoints(Number(e.target.value)))
            }
          />
          <p className='text-xs text-muted-foreground'>
            {factoryHint}
          </p>
        </div>
      </div>
      <div className='space-y-1.5'>
        <Label>Ocorrências para zerar o pilar na fábrica</Label>
        <Input
          type='number'
          min={1}
          step={1}
          value={occurrencesInput}
          onChange={(e) => {
            const raw = e.target.value;
            setOccurrencesInput(raw);
            const n = Math.trunc(Number(raw));
            if (n >= 1) {
              onFactoryChange(
                clampPillarPoints(
                  deductionFromOccurrences(maxPoints, zeroBelowPercent, n),
                ),
              );
            }
          }}
        />
        <p className='text-xs text-muted-foreground'>
          Ao alterar este número, a perda de fábrica é recalculada para ficar
          abaixo de {formatPoints(floor)} pts ({zeroBelowPercent}% de{' '}
          {formatPoints(maxPoints)}).
        </p>
      </div>
      {balanceAtN != null && Number.isFinite(nToZero) ? (
        <p className='rounded-md bg-muted/50 px-3 py-2 text-sm'>
          Com −{formatPoints(factory)}, {nToZero} ocorrência
          {nToZero === 1 ? '' : 's'} deixam {formatPoints(balanceAtN)} (abaixo
          de {formatPoints(floor)}) e zeram o pilar na fábrica.
        </p>
      ) : null}
    </div>
  );
}

export function P5ScoringPanelPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const allowed = Boolean(user && canManageP5Configuration(user.role));
  const [draft, setDraft] = useState<ScoringConfigV2>(defaultConfig);
  const [saveOpen, setSaveOpen] = useState(false);

  const { data: programs = [] } = useQuery({
    queryKey: ['p5', 'program-years'],
    queryFn: () => p5Api.listProgramYears(),
    enabled: allowed,
  });
  const activeProgram =
    programs.find((p) => p.active) ?? programs[0] ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ['p5', 'scoring-rules', activeProgram?.id],
    queryFn: () => p5Api.getProgramYearScoringRules(activeProgram!.id),
    enabled: Boolean(activeProgram) && allowed,
  });

  useEffect(() => {
    if (data?.config) {
      setDraft(asV2(data.config));
    }
  }, [data]);

  const safetyZeroPercent = useMemo(
    () => effectiveZeroPercent(draft, 'SAFETY'),
    [draft],
  );
  const absenteeismZeroPercent = useMemo(
    () => effectiveZeroPercent(draft, 'ABSENTEEISM'),
    [draft],
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      p5Api.updateProgramYearScoringRules(activeProgram!.id, draft),
    onSuccess: (result) => {
      setSaveOpen(false);
      setDraft(asV2(result.config));
      toast.success(
        result.editableCycle
          ? `Regras salvas e ciclo ${result.editableCycle.month}/${result.editableCycle.year} recalculado`
          : 'Regras salvas (valem para o próximo ciclo aberto)',
      );
      void queryClient.invalidateQueries({ queryKey: ['p5'] });
    },
  });

  if (!allowed) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Painel de pontuação
          </h1>
          <p className='text-sm text-muted-foreground'>
            Limiar de zeragem, overrides por pilar e perdas de Segurança e
            Absenteísmo. Alterações só afetam o ciclo aberto (ou o próximo, se
            não houver).
          </p>
        </div>
        <Button
          disabled={!activeProgram || saveMutation.isPending || isLoading}
          onClick={() => setSaveOpen(true)}
        >
          Salvar regras
        </Button>
      </div>

      {data?.editableCycle ? (
        <Badge variant='secondary'>
          Editando ciclo aberto {data.editableCycle.month}/
          {data.editableCycle.year} ({data.editableCycle.status})
        </Badge>
      ) : (
        <Badge variant='outline'>
          Sem ciclo aberto — regras valem para o próximo ciclo
        </Badge>
      )}

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Limiar global</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          <Label htmlFor='global-zero'>
            Zerar pilar se ficar abaixo de (%)
          </Label>
          <Input
            id='global-zero'
            type='number'
            min={0}
            max={100}
            className='max-w-xs'
            value={draft.globalZeroBelowPercent}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                globalZeroBelowPercent: Math.min(
                  100,
                  Math.max(0, Math.trunc(Number(e.target.value) || 0)),
                ),
              }))
            }
          />
          <p className='text-xs text-muted-foreground'>
            Exato no limiar não zera; só abaixo. Padrão: 70%.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Limiar por pilar</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pilar</TableHead>
                <TableHead>Máx. P5</TableHead>
                <TableHead>Override (%)</TableHead>
                <TableHead>Efetivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PILLAR_OPTIONS.map((pillar) => {
                const code = pillar.value as ScoringPillarCode;
                const override = draft.pillars[code]?.zeroBelowPercent;
                const effective = effectiveZeroPercent(draft, code);
                return (
                  <TableRow key={code}>
                    <TableCell>{pillar.label}</TableCell>
                    <TableCell>{PILLAR_MAX[code]}</TableCell>
                    <TableCell>
                      <Input
                        type='number'
                        min={0}
                        max={100}
                        placeholder='Herda global'
                        className='max-w-[8rem]'
                        value={override ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          setDraft((prev) => ({
                            ...prev,
                            pillars: {
                              ...prev.pillars,
                              [code]: {
                                zeroBelowPercent:
                                  raw === ''
                                    ? null
                                    : Math.min(
                                        100,
                                        Math.max(
                                          0,
                                          Math.trunc(Number(raw) || 0),
                                        ),
                                      ),
                              },
                            },
                          }));
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {effective}% (piso{' '}
                      {formatPoints(
                        thresholdFloorP5(PILLAR_MAX[code], effective),
                      )}
                      )
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Segurança — perdas</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <p className='text-sm text-muted-foreground'>
            Cada acidente tira a perda de fábrica de todos. A vítima também
            perde a parcela individual. Se o saldo da fábrica ficar abaixo do
            limiar, o pilar zera para todos neste mês.
          </p>
          <AccidentTypeEditor
            title='Com afastamento'
            individual={draft.safety.withLeave.individualPenaltyP5}
            factory={draft.safety.withLeave.factoryDeductionP5}
            zeroBelowPercent={safetyZeroPercent}
            maxPoints={SAFETY_MAX}
            individualHint={`Descontado só da vítima (além da perda de fábrica). Máximo ${formatPoints(SAFETY_MAX)} pts (zera o pilar dela).`}
            factoryHint={`Descontado de todos a cada ocorrência. Máximo ${formatPoints(SAFETY_MAX)} pts.`}
            onIndividualChange={(v) =>
              setDraft((prev) => ({
                ...prev,
                safety: {
                  ...prev.safety,
                  withLeave: {
                    ...prev.safety.withLeave,
                    individualPenaltyP5: v,
                  },
                },
              }))
            }
            onFactoryChange={(v) =>
              setDraft((prev) => ({
                ...prev,
                safety: {
                  ...prev.safety,
                  withLeave: {
                    ...prev.safety.withLeave,
                    factoryDeductionP5: v,
                  },
                },
              }))
            }
          />
          <AccidentTypeEditor
            title='Sem afastamento'
            individual={draft.safety.withoutLeave.individualPenaltyP5}
            factory={draft.safety.withoutLeave.factoryDeductionP5}
            zeroBelowPercent={safetyZeroPercent}
            maxPoints={SAFETY_MAX}
            individualHint={`Descontado só da vítima (além da perda de fábrica). Máximo ${formatPoints(SAFETY_MAX)} pts (zera o pilar dela).`}
            factoryHint={`Descontado de todos a cada ocorrência. Máximo ${formatPoints(SAFETY_MAX)} pts.`}
            onIndividualChange={(v) =>
              setDraft((prev) => ({
                ...prev,
                safety: {
                  ...prev.safety,
                  withoutLeave: {
                    ...prev.safety.withoutLeave,
                    individualPenaltyP5: v,
                  },
                },
              }))
            }
            onFactoryChange={(v) =>
              setDraft((prev) => ({
                ...prev,
                safety: {
                  ...prev.safety,
                  withoutLeave: {
                    ...prev.safety.withoutLeave,
                    factoryDeductionP5: v,
                  },
                },
              }))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Absenteísmo — perdas</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <p className='text-sm text-muted-foreground'>
            Cada colaborador com índice abaixo de 100 tira a perda de fábrica de
            todos. Essa pessoa também perde a parcela individual. Se o saldo da
            fábrica ficar abaixo do limiar, o pilar zera para todos neste mês.
          </p>
          <AccidentTypeEditor
            title='Índice abaixo de 100'
            individual={draft.absenteeism.individualPenaltyP5}
            factory={draft.absenteeism.factoryDeductionP5}
            zeroBelowPercent={absenteeismZeroPercent}
            maxPoints={ABSENTEEISM_MAX}
            individualHint={`Descontado só de quem ficou abaixo de 100 (além da perda de fábrica). Máximo ${formatPoints(ABSENTEEISM_MAX)} pts.`}
            factoryHint={`Descontado de todos a cada colaborador abaixo de 100. Máximo ${formatPoints(ABSENTEEISM_MAX)} pts.`}
            onIndividualChange={(v) =>
              setDraft((prev) => ({
                ...prev,
                absenteeism: {
                  ...prev.absenteeism,
                  individualPenaltyP5: v,
                },
              }))
            }
            onFactoryChange={(v) =>
              setDraft((prev) => ({
                ...prev,
                absenteeism: {
                  ...prev.absenteeism,
                  factoryDeductionP5: v,
                },
              }))
            }
          />
        </CardContent>
      </Card>

      <AlertDialog open={saveOpen} onOpenChange={setSaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar regras de pontuação?</AlertDialogTitle>
            <AlertDialogDescription>
              {data?.editableCycle
                ? `As regras serão aplicadas ao ciclo ${data.editableCycle.month}/${data.editableCycle.year} e a pontuação de Segurança e Absenteísmo será recalculada. Ciclos fechados não mudam.`
                : 'Não há ciclo aberto. As regras ficam salvas no programa e serão usadas ao abrir o próximo ciclo.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={saveMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
            >
              {saveMutation.isPending ? 'Salvando…' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
