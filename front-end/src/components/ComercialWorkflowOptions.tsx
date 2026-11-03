import type { ProcessInstructionDraft } from '@/config/process-instruction-draft';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export function ComercialWorkflowOptions({ value, onChange }: {
  value: ProcessInstructionDraft;
  onChange: (next: ProcessInstructionDraft) => void;
}) {
  const simulation = value.requester === 'Comercial' && value.type === 'Simulação Comercial';
  return (
    <div className='solicitation-workflow-options space-y-3'>
      {simulation && <p className='text-sm text-muted-foreground'>A Engenharia avaliará a necessidade de envolver a Ferramentaria.</p>}
      <div className='flex items-start gap-3 rounded-xl border bg-background/70 p-4'>
        <Checkbox id='requiresTooling' checked={!simulation && value.requiresTooling} disabled={simulation}
          onCheckedChange={(checked) => onChange({ ...value, directTooling: false, requiresTooling: checked === true })} />
        <div className='grid gap-1'>
          <Label htmlFor='requiresTooling' className='cursor-pointer'>Requer ferramentaria</Label>
          <p className='text-xs text-muted-foreground'>
            {simulation ? 'Inclusão disponível para a Engenharia durante o atendimento.' : 'Adiciona PCP e Ferramentaria ao fluxo, em paralelo à Engenharia.'}
          </p>
        </div>
      </div>
    </div>
  );
}
