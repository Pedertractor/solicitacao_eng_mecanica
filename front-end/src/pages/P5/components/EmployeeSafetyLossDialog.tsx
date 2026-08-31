import type { SafetyEmployeeLossDetail } from '@/services/p5';
import { displayCardNumber } from '@/utils/card-number-input';
import { floor2, formatPoints } from '@/utils/p5-number';
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

/** Máximo do pilar Segurança (mesma escala interna e da fábrica). */
const SAFETY_P5_MAX = 20;

type EmployeeSafetyLossDialogProps = {
  employee: SafetyEmployeeLossDetail | null;
  loading?: boolean;
  error?: boolean;
  onClose: () => void;
};

export function EmployeeSafetyLossDialog({
  employee,
  loading = false,
  error = false,
  onClose,
}: EmployeeSafetyLossDialogProps) {
  const p5Final = employee?.weightedP5 ?? null;
  const p5Lost =
    p5Final == null ? null : floor2(SAFETY_P5_MAX - p5Final);

  const factoryDeduction = employee?.factoryDeductionP5 ?? 0;
  const individualDeduction = employee?.individualDeductionP5 ?? 0;
  const factoryBalance = employee?.factoryBalanceP5 ?? null;
  const zeroedBy = employee?.zeroedBy ?? null;
  const floorP5 = employee?.floorP5 ?? null;
  const zeroBelowPercent = employee?.zeroBelowPercent ?? null;

  return (
    <Dialog
      open={employee !== null || loading || error}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className='flex max-h-[90vh] flex-col overflow-hidden sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Onde perdeu pontos</DialogTitle>
        </DialogHeader>
        <div className='min-h-0 overflow-y-auto pr-2'>
          {loading ? (
            <p className='text-sm text-muted-foreground'>Carregando…</p>
          ) : error ? (
            <p className='text-sm text-destructive'>
              Não foi possível carregar o detalhamento deste participante.
            </p>
          ) : employee ? (
            <div className='space-y-4 text-sm'>
              <div>
                <p className='font-medium'>{employee.name}</p>
                <p className='text-muted-foreground'>
                  Cartão {displayCardNumber(employee.cardNumber)}
                </p>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ocorrência</TableHead>
                    <TableHead className='text-right'>Qtd.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Com afastamento</TableCell>
                    <TableCell className='text-right'>
                      {employee.withLeave}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Sem afastamento</TableCell>
                    <TableCell className='text-right'>
                      {employee.withoutLeave}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

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
                    <TableCell>Individual (só a vítima)</TableCell>
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
                    {formatPoints(SAFETY_P5_MAX)}
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
                    Limiar {zeroBelowPercent}% → abaixo de{' '}
                    {formatPoints(floorP5)} zera
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
                    {p5Final == null
                      ? '—'
                      : `${formatPoints(p5Final)} / ${formatPoints(SAFETY_P5_MAX)}`}
                  </span>
                </div>
                {p5Lost != null && p5Lost > 0 ? (
                  <p className='text-xs text-muted-foreground'>
                    Perdeu {formatPoints(p5Lost)} pts neste pilar
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
