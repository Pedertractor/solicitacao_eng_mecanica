import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { isProcessEngineeringLead } from '@/config/permissions';
import { Button } from '@/components/ui/button';
import { solicitationApi, type Solicitation } from '@/services/solicitation';

export function AddSimulationTooling({ item }: { item: Solicitation }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => solicitationApi.addTooling(item.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(['solicitation', item.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['solicitations'] });
      void queryClient.invalidateQueries({ queryKey: ['workflow-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['production-tracking'] });
      toast.success('Ferramentaria adicionada. As equipes podem trabalhar em paralelo.');
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['solicitation', item.id] });
      toast.error('Não foi possível adicionar a Ferramentaria. Atualize o chamado e tente novamente.');
    },
  });
  const engineering = item.workflow?.stages.find((stage) => stage.stage === 'ENGENHARIA');
  if (!user || (user.role !== 'SUPER_ADMIN' && !isProcessEngineeringLead(user.role, user.department))
    || item.workflow?.kind !== 'COMMERCIAL_SIMULATION'
    || ['COMPLETED', 'CANCELLED', 'DELETED'].includes(item.status)
    || !engineering || !['PENDING', 'READY', 'IN_PROGRESS'].includes(engineering.status)
    || item.workflow.stages.some((stage) => stage.stage === 'FERRAMENTARIA')) return null;
  return <Button type='button' disabled={mutation.isPending} onClick={() => mutation.mutate()}>
    {mutation.isPending ? 'Adicionando...' : 'Adicionar Ferramentaria'}
  </Button>;
}
