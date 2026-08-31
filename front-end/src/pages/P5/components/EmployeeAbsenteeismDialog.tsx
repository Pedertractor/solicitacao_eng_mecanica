import type { AbsenteeismEmployeeDetail } from '@/services/p5';
import { displayCardNumber } from '@/utils/card-number-input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AbsenteeismEmployeeBreakdown } from './AbsenteeismEmployeeBreakdown';

type EmployeeAbsenteeismDialogProps = {
  employee: AbsenteeismEmployeeDetail | null;
  loading?: boolean;
  error?: boolean;
  onClose: () => void;
};

export function EmployeeAbsenteeismDialog({
  employee,
  loading = false,
  error = false,
  onClose,
}: EmployeeAbsenteeismDialogProps) {
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
                  {employee.sectorName ? ` · ${employee.sectorName}` : ''}
                </p>
              </div>

              {employee.weightedP5 == null ? (
                <p className='text-sm text-muted-foreground'>
                  Aguardando cálculo de absenteísmo para este colaborador.
                </p>
              ) : (
                <AbsenteeismEmployeeBreakdown
                  weightedPoints={employee.weightedP5}
                  details={{
                    absenteeism: employee.absenteeism,
                    individualPreserved: employee.individualPreserved,
                    individualDeducted: employee.individualDeducted,
                    sectorPreserved: employee.sectorPreserved,
                    partial: employee.partial,
                    warning: employee.warning,
                    scoringRuleVersion: employee.scoringRuleVersion,
                    factoryOccurrenceCount: employee.factoryOccurrenceCount,
                    factoryDeductionP5: employee.factoryDeductionP5,
                    factoryBalanceP5: employee.factoryBalanceP5,
                    individualDeductionP5: employee.individualDeductionP5,
                    factoryZeroed: employee.factoryZeroed,
                    zeroedBy: employee.zeroedBy,
                    zeroBelowPercent: employee.zeroBelowPercent,
                    floorP5: employee.floorP5,
                  }}
                />
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
