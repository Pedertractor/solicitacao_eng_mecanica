import type { AbsenteeismScoreDetails } from '@/services/p5';
import { floor2, formatPercent, formatPoints } from '@/utils/p5-number';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const ABSENTEEISM_P5_MAX = 10;
const ABSENTEEISM_INTERNAL_MAX = 100;

export function AbsenteeismEmployeeBreakdown({
  weightedPoints,
  details,
}: {
  weightedPoints: number;
  details: AbsenteeismScoreDetails | null;
}) {
  const isV2 =
    details?.scoringRuleVersion === 2 ||
    details?.factoryDeductionP5 != null ||
    details?.individualDeductionP5 != null;

  if (!isV2) {
    return (
      <LegacyAbsenteeismBreakdown
        weightedPoints={weightedPoints}
        details={details}
      />
    );
  }

  const factoryDeduction = details?.factoryDeductionP5 ?? 0;
  const individualDeduction = details?.individualDeductionP5 ?? 0;
  const factoryBalance = details?.factoryBalanceP5;
  const zeroedBy = details?.zeroedBy ?? null;
  const floorP5 = details?.floorP5 ?? null;
  const zeroBelowPercent = details?.zeroBelowPercent ?? null;
  const p5Lost = floor2(ABSENTEEISM_P5_MAX - weightedPoints);
  const indexLabel =
    details?.absenteeism == null
      ? 'Sem índice na procedure'
      : `Índice ${formatPoints(details.absenteeism)}`;
  const occurrenceCount = details?.factoryOccurrenceCount ?? 0;

  return (
    <div className='space-y-3 text-sm'>
      {details?.warning ? (
        <p className='rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>
          {details.warning}
        </p>
      ) : details?.partial ? (
        <p className='rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>
          Resultado parcial: o índice do mês ainda pode mudar até o fechamento.
        </p>
      ) : null}

      <p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
        {indexLabel}
        {occurrenceCount > 0
          ? ` · ${occurrenceCount} ocorrência${occurrenceCount === 1 ? '' : 's'} na fábrica`
          : ''}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Perda (pts do pilar)</TableHead>
            <TableHead className='text-right'>Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Coletiva (fábrica → todos)</TableCell>
            <TableCell className='text-right tabular-nums'>
              {factoryDeduction > 0
                ? `−${formatPoints(factoryDeduction)}`
                : '0'}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Individual (índice &lt; 100)</TableCell>
            <TableCell className='text-right tabular-nums'>
              {individualDeduction > 0
                ? `−${formatPoints(individualDeduction)}`
                : '0'}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div className='space-y-2 rounded-md border p-3'>
        <div className='flex justify-between gap-4'>
          <span className='text-muted-foreground'>Base do pilar</span>
          <span className='tabular-nums'>
            {formatPoints(ABSENTEEISM_P5_MAX)}
          </span>
        </div>
        {factoryBalance != null ? (
          <div className='flex justify-between gap-4'>
            <span className='text-muted-foreground'>
              Saldo após perda coletiva
            </span>
            <span className='tabular-nums'>
              {formatPoints(factoryBalance)}
            </span>
          </div>
        ) : null}
        {individualDeduction > 0 ? (
          <div className='flex justify-between gap-4'>
            <span className='text-muted-foreground'>− individual</span>
            <span className='tabular-nums'>
              −{formatPoints(individualDeduction)}
            </span>
          </div>
        ) : null}
        {zeroBelowPercent != null && floorP5 != null ? (
          <p className='text-xs text-muted-foreground'>
            Limiar {zeroBelowPercent}% → abaixo de {formatPoints(floorP5)} zera
          </p>
        ) : null}
        {zeroedBy === 'factory_threshold' ? (
          <p className='text-destructive'>
            Zerado: fábrica abaixo do limiar neste mês (todos zeram).
          </p>
        ) : null}
        {zeroedBy === 'individual_threshold' ? (
          <p className='text-destructive'>
            Zerado: pontuação deste colaborador abaixo do limiar.
          </p>
        ) : null}
        <div className='flex justify-between gap-4 border-t pt-2 font-medium'>
          <span>Resultado</span>
          <span className='tabular-nums'>
            {formatPoints(weightedPoints)} / {formatPoints(ABSENTEEISM_P5_MAX)}
          </span>
        </div>
        {p5Lost > 0 ? (
          <p className='text-xs text-muted-foreground'>
            Perdeu {formatPoints(p5Lost)} pts neste pilar
          </p>
        ) : null}
      </div>
    </div>
  );
}

function LegacyAbsenteeismBreakdown({
  weightedPoints,
  details,
}: {
  weightedPoints: number;
  details: AbsenteeismScoreDetails | null;
}) {
  const individualPreserved = details?.individualPreserved ?? 40;
  const sectorPreserved = details?.sectorPreserved ?? 60;
  const internalTotal = individualPreserved + sectorPreserved;
  const deducted = details?.individualDeducted ?? false;
  const p5Lost = floor2(ABSENTEEISM_P5_MAX - weightedPoints);
  const indexLabel =
    details?.absenteeism == null
      ? 'Sem índice na procedure'
      : `Índice ${formatPoints(details.absenteeism)}`;

  return (
    <div className='space-y-3 text-sm'>
      {details?.warning ? (
        <p className='rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>
          {details.warning}
        </p>
      ) : details?.partial ? (
        <p className='rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>
          Resultado parcial: o índice do mês ainda pode mudar até o fechamento.
        </p>
      ) : null}

      <p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
        {indexLabel}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Parcela</TableHead>
            <TableHead className='text-right'>Internos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Individual (índice &lt; 100 remove 40)</TableCell>
            <TableCell className='text-right'>
              {deducted ? '0 (−40)' : individualPreserved}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Setor (reservado)</TableCell>
            <TableCell className='text-right'>{sectorPreserved}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div className='space-y-1 rounded-md border p-3'>
        <div className='flex justify-between gap-4'>
          <span className='text-muted-foreground'>Internos</span>
          <span>
            {internalTotal} / {ABSENTEEISM_INTERNAL_MAX}
          </span>
        </div>
        <div className='flex justify-between gap-4'>
          <span className='text-muted-foreground'>P5 do pilar</span>
          <span>
            {formatPoints(weightedPoints)} / {formatPoints(ABSENTEEISM_P5_MAX)}
          </span>
        </div>
        <div className='flex justify-between gap-4 font-medium'>
          <span>Perdeu</span>
          <span>
            {p5Lost > 0 ? `−${formatPoints(p5Lost)}%` : formatPercent(0)}
          </span>
        </div>
      </div>
    </div>
  );
}
