import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Factory, Loader2, X } from 'lucide-react';
import { OfProcessTimeline } from '@/components/of/OfProcessTimeline';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ofApi } from '@/services/of';
import {
  solicitationApi,
  type Solicitation,
} from '@/services/solicitation';

type SolicitationOfPanelProps = {
  item: Solicitation;
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SolicitationOfToggle({
  open,
  onOpenChange,
  hasOf,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasOf: boolean;
}) {
  return (
    <Button
      type='button'
      variant={open ? 'secondary' : 'outline'}
      size='icon'
      className='shrink-0'
      aria-expanded={open}
      aria-controls='solicitation-of-panel'
      aria-label={open ? 'Fechar progresso da OF' : 'Abrir progresso da OF'}
      title={open ? 'Fechar progresso da OF' : 'Ver progresso da OF'}
      onClick={() => onOpenChange(!open)}
    >
      <Factory className={cn('size-4', hasOf && !open && 'text-amber-600')} />
    </Button>
  );
}

export function SolicitationOfPanel({
  item,
  canManage,
  open,
  onOpenChange,
}: SolicitationOfPanelProps) {
  const queryClient = useQueryClient();
  const [draftOf, setDraftOf] = useState(item.ofNumber ?? '');

  useEffect(() => {
    setDraftOf(item.ofNumber ?? '');
  }, [item.ofNumber]);

  const ofNumber = item.ofNumber?.trim() ?? '';

  const processesQuery = useQuery({
    queryKey: ['of-processes', ofNumber],
    queryFn: () => ofApi.getProcesses(ofNumber),
    enabled: open && ofNumber.length > 0,
  });

  const linkMutation = useMutation({
    mutationFn: (value: string | null) => solicitationApi.linkOf(item.id, value),
    onSuccess: (updated) => {
      queryClient.setQueryData(['solicitation', item.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['solicitations'] });
      const next = updated.ofNumber?.trim() ?? '';
      if (next) {
        void queryClient.invalidateQueries({
          queryKey: ['of-processes', next],
        });
      }
      toast.success(
        next ? `OF ${next} vinculada.` : 'Vínculo da OF removido.',
      );
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { error?: string } } }).response
              ?.data?.error
          : undefined;
      toast.error(message || 'Falha ao vincular a OF.');
    },
  });

  function handleSave(event: FormEvent) {
    event.preventDefault();
    const trimmed = draftOf.trim().replace(/\s+/g, '');
    if (!trimmed) {
      linkMutation.mutate(null);
      return;
    }
    if (!/^\d+$/.test(trimmed)) {
      toast.error('Número da OF deve conter apenas dígitos.');
      return;
    }
    linkMutation.mutate(trimmed);
  }

  function handleClear() {
    setDraftOf('');
    linkMutation.mutate(null);
  }

  if (!open) return null;

  return (
    <Card id='solicitation-of-panel' className='min-w-0 md:max-w-xl md:flex-1'>
      <CardHeader className='flex flex-row items-start justify-between gap-3 space-y-0'>
        <div className='min-w-0'>
          <CardTitle className='flex items-center gap-2'>
            <Factory className='size-4 shrink-0' />
            Progresso da OF
          </CardTitle>
          <CardDescription>
            {ofNumber
              ? `OF ${ofNumber} vinculada a esta solicitação`
              : 'Vincule um número de OF para acompanhar a produção'}
          </CardDescription>
        </div>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='shrink-0'
          aria-label='Fechar painel da OF'
          onClick={() => onOpenChange(false)}
        >
          <X className='size-4' />
        </Button>
      </CardHeader>
      <CardContent className='space-y-4'>
        {canManage ? (
          <form
            onSubmit={handleSave}
            className='flex flex-col gap-3 sm:flex-row sm:items-end'
          >
            <div className='flex min-w-0 flex-1 flex-col gap-2'>
              <Label htmlFor='solicitation-of-number'>Número da OF</Label>
              <Input
                id='solicitation-of-number'
                type='text'
                inputMode='numeric'
                placeholder='Ex.: 123456'
                value={draftOf}
                onChange={(event) => setDraftOf(event.target.value)}
                autoComplete='off'
                disabled={linkMutation.isPending}
              />
            </div>
            <div className='flex flex-wrap gap-2'>
              <Button type='submit' disabled={linkMutation.isPending}>
                {linkMutation.isPending ? (
                  <>
                    <Loader2 className='size-4 animate-spin' />
                    Salvando
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
              {ofNumber ? (
                <Button
                  type='button'
                  variant='outline'
                  disabled={linkMutation.isPending}
                  onClick={handleClear}
                >
                  Remover
                </Button>
              ) : null}
            </div>
          </form>
        ) : ofNumber ? (
          <p className='text-sm text-muted-foreground'>
            OF vinculada:{' '}
            <span className='font-medium text-foreground'>{ofNumber}</span>
          </p>
        ) : (
          <p className='rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground'>
            Nenhuma OF vinculada
          </p>
        )}

        {ofNumber ? (
          processesQuery.isLoading ? (
            <div className='flex items-center justify-center gap-2 rounded-xl border px-4 py-10 text-sm text-muted-foreground'>
              <Loader2 className='size-4 animate-spin' />
              Carregando processos da OF {ofNumber}…
            </div>
          ) : processesQuery.isError ? (
            <div className='rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive'>
              Não foi possível carregar os processos da OF {ofNumber}.
            </div>
          ) : (processesQuery.data?.length ?? 0) === 0 ? (
            <div className='rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground'>
              Nenhum processo encontrado para a OF {ofNumber}.
            </div>
          ) : (
            <OfProcessTimeline processes={processesQuery.data!} />
          )
        ) : canManage ? (
          <p className='text-sm text-muted-foreground'>
            Informe o número da OF e salve para ver a linha do tempo de
            produção.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
