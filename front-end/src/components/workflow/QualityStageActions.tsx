import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { canManageQualityStage } from '@/config/permissions';
import { Button } from '@/components/ui/button';
import { workflowCanStart, workflowPrerequisitesDone } from '@/lib/workflow';
import { solicitationApi, WORKFLOW_STAGE_LABELS, type Solicitation } from '@/services/solicitation';
import { ToolingKairoDialog } from '@/pages/Solicitacao/ToolingKairoDialog';

export function QualityStageActions({ item }: { item: Solicitation }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogStage, setDialogStage] = useState<'QUALIDADE' | null>(null);
  const mutation = useMutation({
    mutationFn: (action: 'start' | 'finish' | 'sync-kairo') =>
      solicitationApi.updateQualityStage(item.id, action),
    onSuccess: (updated) => {
      queryClient.setQueryData(['solicitation', item.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['solicitations'] });
      void queryClient.invalidateQueries({ queryKey: ['workflow-summary'] });
      toast.success('Qualidade · PPAP atualizada.');
    },
    onError: (error: unknown) => {
      const message = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error : undefined;
      toast.error(message || 'Falha ao atualizar PPAP.');
    },
  });
  if (!user || !canManageQualityStage(user.role, user.department) || !item.workflow
    || ['COMPLETED', 'CANCELLED', 'DELETED'].includes(item.status)) return null;
  const workflow = item.workflow;
  return (
    <div className='space-y-3'>
      {workflow.stages.filter((stage) => stage.stage === 'QUALIDADE').map((stage) => {
        const kind = 'QUALIDADE';
        if (stage.status === 'DONE' || stage.status === 'CANCELLED' || stage.status === 'REJECTED') return null;
        const canStart = workflowCanStart(workflow, kind);
        const inProgress = stage.status === 'IN_PROGRESS' && workflowPrerequisitesDone(workflow, kind);
        return (
          <div key={stage.id} className='space-y-2 rounded-xl border p-3'>
            <p className='text-sm font-medium'>{WORKFLOW_STAGE_LABELS[kind]}</p>
            <p className='text-xs text-muted-foreground'>Disponível desde a criação</p>
            <div className='flex flex-wrap gap-2'>
              {canStart ? <Button size='sm' disabled={mutation.isPending}
                onClick={() => mutation.mutate('start')}>Iniciar PPAP</Button> : null}
              {inProgress ? <Button size='sm' disabled={mutation.isPending}
                onClick={() => mutation.mutate('finish')}>Concluir PPAP</Button> : null}
              {(canStart || inProgress) && !stage.kairoCardIds ? <Button size='sm' variant='outline'
                disabled={mutation.isPending} onClick={() => setDialogStage(kind)}>Enviar ao Kairo</Button> : null}
              {stage.kairoCardIds ? <Button size='sm' variant='outline' disabled={mutation.isPending}
                onClick={() => mutation.mutate('sync-kairo')}>Sincronizar Kairo</Button> : null}
            </div>
          </div>
        );
      })}
      {dialogStage ? <ToolingKairoDialog key={dialogStage} open solicitation={item} stage={dialogStage}
        onOpenChange={(open) => { if (!open) setDialogStage(null); }} /> : null}
    </div>
  );
}
