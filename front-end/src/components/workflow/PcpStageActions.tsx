import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { canManagePcpStage } from '@/config/permissions';
import { Button } from '@/components/ui/button';
import { workflowCanStart, workflowPrerequisitesDone } from '@/lib/workflow';
import { solicitationApi, WORKFLOW_STAGE_LABELS, type PcpStageKind, type Solicitation } from '@/services/solicitation';
import { ToolingKairoDialog } from '@/pages/Solicitacao/ToolingKairoDialog';

export function PcpStageActions({ item }: { item: Solicitation }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogStage, setDialogStage] = useState<PcpStageKind | null>(null);
  const mutation = useMutation({
    mutationFn: ({ stage, action }: { stage: PcpStageKind; action: 'start' | 'finish' | 'sync-kairo' }) =>
      solicitationApi.updatePcpStage(item.id, stage, action),
    onSuccess: (updated) => {
      queryClient.setQueryData(['solicitation', item.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['solicitations'] });
      void queryClient.invalidateQueries({ queryKey: ['workflow-summary'] });
      toast.success('Etapa PCP atualizada.');
    },
    onError: (error: unknown) => {
      const message = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
      toast.error(message || 'Falha ao atualizar PCP.');
    },
  });
  if (!user || !canManagePcpStage(user.role) || !item.workflow
    || ['COMPLETED', 'CANCELLED', 'DELETED'].includes(item.status)) return null;
  const workflow = item.workflow;
  return (
    <div className='space-y-3'>
      {workflow.stages.filter((stage) => stage.stage === 'PCP_FERRAMENTARIA' || stage.stage === 'PCP_AMOSTRA').map((stage) => {
        const kind = stage.stage as PcpStageKind;
        if (stage.status === 'DONE' || stage.status === 'CANCELLED' || stage.status === 'REJECTED') return null;
        const canStart = workflowCanStart(workflow, kind);
        const inProgress = stage.status === 'IN_PROGRESS' && workflowPrerequisitesDone(workflow, kind);
        return (
          <div key={stage.id} className='space-y-2 rounded-xl border p-3'>
            <p className='text-sm font-medium'>{WORKFLOW_STAGE_LABELS[kind]}</p>
            <div className='flex flex-wrap gap-2'>
              {canStart ? <Button size='sm' disabled={mutation.isPending}
                onClick={() => mutation.mutate({ stage: kind, action: 'start' })}>Iniciar manualmente</Button> : null}
              {inProgress ? <Button size='sm' disabled={mutation.isPending}
                onClick={() => mutation.mutate({ stage: kind, action: 'finish' })}>Concluir manualmente</Button> : null}
              {(canStart || inProgress) && !stage.kairoCardIds ? <Button size='sm' variant='outline'
                disabled={mutation.isPending} onClick={() => setDialogStage(kind)}>Enviar ao Kairo</Button> : null}
              {stage.kairoCardIds ? <Button size='sm' variant='outline' disabled={mutation.isPending}
                onClick={() => mutation.mutate({ stage: kind, action: 'sync-kairo' })}>Sincronizar Kairo</Button> : null}
              {!canStart && !inProgress ? <p className='text-xs text-muted-foreground'>Aguardando a conclusão da etapa anterior.</p> : null}
            </div>
          </div>
        );
      })}
      {dialogStage ? <ToolingKairoDialog key={dialogStage} open solicitation={item} stage={dialogStage}
        onOpenChange={(open) => { if (!open) setDialogStage(null); }} /> : null}
    </div>
  );
}
