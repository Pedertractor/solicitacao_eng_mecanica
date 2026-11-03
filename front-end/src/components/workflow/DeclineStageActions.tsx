import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { canDeclineWorkflowStage } from '@/config/permissions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { solicitationApi, WORKFLOW_STAGE_LABELS, type Solicitation, type WorkflowStageKind } from '@/services/solicitation';

export function DeclineStageActions({ item, onlyStage }: { item: Solicitation; onlyStage?: WorkflowStageKind }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<WorkflowStageKind | null>(null);
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: ({ stage, reason }: { stage: WorkflowStageKind; reason: string }) => solicitationApi.declineStage(item.id, stage, reason),
    onSuccess: ({ solicitation, warnings }) => {
      queryClient.setQueryData(['solicitation', item.id], solicitation);
      void queryClient.invalidateQueries({ queryKey: ['solicitations'] });
      void queryClient.invalidateQueries({ queryKey: ['workflow-summary'] });
      setSelected(null);
      setReason('');
      toast.success('Etapa recusada. O restante do workflow continua.');
      for (const warning of warnings) toast.warning(warning, { duration: 12000 });
    },
    onError: () => toast.error('Não foi possível recusar a etapa. Atualize a página e tente novamente.'),
  });
  if (!user || !item.workflow || ['COMPLETED', 'CANCELLED', 'DELETED'].includes(item.status)) return null;
  const stages = item.workflow.stages.filter((stage) => (!onlyStage || stage.stage === onlyStage)
    && ['PENDING', 'READY', 'IN_PROGRESS'].includes(stage.status)
    && canDeclineWorkflowStage(user.role, user.department, stage.stage));
  if (!stages.length) return null;
  return (
    <div className='flex flex-wrap gap-2'>
      {stages.map((stage) => <Button key={stage.id} type='button' variant='destructive' size='sm'
        className='h-auto max-w-full whitespace-normal text-left' disabled={mutation.isPending} onClick={() => { setReason(''); setSelected(stage.stage); }}>
        Recusar etapa · {WORKFLOW_STAGE_LABELS[stage.stage]}
      </Button>)}
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open && !mutation.isPending) setSelected(null); }}>
        <DialogContent>
          <form onSubmit={(event) => { event.preventDefault(); if (selected && reason.trim() && !mutation.isPending) mutation.mutate({ stage: selected, reason: reason.trim() }); }}>
            <DialogHeader>
              <DialogTitle>Recusar etapa{selected ? ` · ${WORKFLOW_STAGE_LABELS[selected]}` : ''}</DialogTitle>
              <DialogDescription>Somente esta etapa será recusada. A solicitação continuará pelas demais etapas do workflow. Esta ação não pode ser desfeita.</DialogDescription>
            </DialogHeader>
            <div className='my-4 space-y-2'>
              <Label htmlFor={`decline-reason-${item.id}`}>Motivo da recusa</Label>
              <textarea className='min-h-24 w-full rounded-md border bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' id={`decline-reason-${item.id}`} value={reason} required disabled={mutation.isPending}
                onChange={(event) => setReason(event.target.value)} />
            </div>
            <DialogFooter>
              <Button type='button' variant='outline' disabled={mutation.isPending} onClick={() => setSelected(null)}>Voltar</Button>
              <Button type='submit' variant='destructive' disabled={!reason.trim() || mutation.isPending}>
                {mutation.isPending ? 'Recusando...' : 'Confirmar recusa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
