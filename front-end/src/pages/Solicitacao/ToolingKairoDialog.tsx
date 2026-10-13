import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { IntegrationsDialog } from '@/components/IntegrationsDialog';
import { KairoIcon } from '@/components/kairo-icon';
import { KairoTagBadge } from '@/components/kairo-tag-badge';
import { kairoApi } from '@/services/kairo';
import {
  solicitationApi,
  type Solicitation,
  type WorkflowStageKind,
} from '@/services/solicitation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const STAGE_COPY: Record<
  'FERRAMENTARIA' | 'AMOSTRA',
  { title: string; description: (code: string) => string; success: string; error: string; defaultTitle: (code: string) => string }
> = {
  FERRAMENTARIA: {
    title: 'Enviar Ferramentaria ao Kairo',
    description: (code) =>
      `Publique a atividade de ferramentaria para a solicitação ${code}.`,
    success: 'Ferramentaria enviada ao Kairo.',
    error: 'Falha ao enviar ferramentaria ao Kairo.',
    defaultTitle: (code) => `${code} — Ferramentaria`,
  },
  AMOSTRA: {
    title: 'Enviar Amostra ao Kairo',
    description: (code) =>
      `Publique a atividade de amostra para a solicitação ${code}.`,
    success: 'Amostra enviada ao Kairo.',
    error: 'Falha ao enviar amostra ao Kairo.',
    defaultTitle: (code) => `${code} — Amostra`,
  },
};

export function ToolingKairoDialog({
  open,
  onOpenChange,
  solicitation,
  stage = 'FERRAMENTARIA',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitation: Solicitation;
  stage?: Extract<WorkflowStageKind, 'FERRAMENTARIA' | 'AMOSTRA'>;
}) {
  const queryClient = useQueryClient();
  const copy = STAGE_COPY[stage];
  const [accountIntegrationsOpen, setAccountIntegrationsOpen] = useState(false);
  const [teamId, setTeamId] = useState('');
  const [tagId, setTagId] = useState('');
  const [title, setTitle] = useState(
    copy.defaultTitle(solicitation.trackingCode),
  );

  const statusQuery = useQuery({
    queryKey: ['kairo-status'],
    queryFn: () => kairoApi.getStatus(),
    enabled: open,
  });

  const teamsQuery = useQuery({
    queryKey: ['kairo-teams'],
    queryFn: () => kairoApi.listTeams(),
    enabled: open && Boolean(statusQuery.data?.linked),
  });

  const tagsQuery = useQuery({
    queryKey: ['kairo-tags', teamId],
    queryFn: () => kairoApi.listTags(teamId),
    enabled: open && Boolean(teamId),
  });

  const sendMutation = useMutation({
    mutationFn: () => {
      const payload = {
        teamId,
        title: title.trim() || undefined,
        ...(tagId ? { tagId } : {}),
      };
      return stage === 'AMOSTRA'
        ? solicitationApi.sendSampleToKairo(solicitation.id, payload)
        : solicitationApi.sendToolingToKairo(solicitation.id, payload);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['solicitation', solicitation.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['solicitations'] });
      toast.success(copy.success);
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { error?: string } } }).response
              ?.data?.error
          : undefined;
      toast.error(message || copy.error);
    },
  });

  const linked = Boolean(statusQuery.data?.linked);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <KairoIcon className='size-5' />
              {copy.title}
            </DialogTitle>
            <DialogDescription>
              {copy.description(solicitation.trackingCode)}
            </DialogDescription>
          </DialogHeader>

          {!linked ? (
            <div className='space-y-3 py-2'>
              <p className='text-sm text-muted-foreground'>
                Vincule sua chave de API do Kairo em Integrações para continuar.
              </p>
              <Button
                type='button'
                variant='outline'
                onClick={() => setAccountIntegrationsOpen(true)}
              >
                Abrir Integrações
              </Button>
            </div>
          ) : (
            <div className='space-y-4 py-2'>
              <div className='grid gap-2'>
                <Label htmlFor='workflow-stage-kairo-title'>Título</Label>
                <Input
                  id='workflow-stage-kairo-title'
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>

              <div className='grid gap-2'>
                <Label>Time no Kairo</Label>
                <Select
                  value={teamId || undefined}
                  onValueChange={(value) => {
                    setTeamId(value);
                    setTagId('');
                  }}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Selecione o time...' />
                  </SelectTrigger>
                  <SelectContent>
                    {(teamsQuery.data ?? []).map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {teamId ? (
                <div className='grid gap-2'>
                  <Label>Etiqueta (opcional)</Label>
                  <Select
                    value={tagId || undefined}
                    onValueChange={setTagId}
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Sem etiqueta' />
                    </SelectTrigger>
                    <SelectContent>
                      {(tagsQuery.data ?? []).map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <KairoTagBadge tag={tag} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type='button'
              disabled={!linked || !teamId || sendMutation.isPending}
              onClick={() => sendMutation.mutate()}
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className='mr-2 size-4 animate-spin' />
                  Enviando…
                </>
              ) : (
                'Enviar ao Kairo'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IntegrationsDialog
        open={accountIntegrationsOpen}
        onOpenChange={(nextOpen) => {
          setAccountIntegrationsOpen(nextOpen);
          if (!nextOpen) {
            void queryClient.invalidateQueries({ queryKey: ['kairo-status'] });
          }
        }}
      />
    </>
  );
}
