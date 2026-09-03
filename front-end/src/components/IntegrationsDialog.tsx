import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ChevronDown, Unplug } from 'lucide-react';
import { KairoIcon } from '@/components/kairo-icon';
import { kairoApi } from '@/services/kairo';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

function KairoLinkStatusBadge({ linked }: { linked: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        linked &&
          'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
      )}
    >
      {linked ? 'Vinculado' : 'Não vinculado'}
    </Badge>
  );
}

export function IntegrationsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['kairo-status'],
    queryFn: () => kairoApi.getStatus(),
    enabled: open,
  });

  const linkMutation = useMutation({
    mutationFn: (key: string) => kairoApi.link(key),
    onSuccess: (status) => {
      queryClient.setQueryData(['kairo-status'], status);
      setApiKey('');
      toast.success('Chave do Kairo vinculada.');
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: () => kairoApi.unlink(),
    onSuccess: (status) => {
      queryClient.setQueryData(['kairo-status'], status);
      setUnlinkConfirmOpen(false);
      toast.success('Vínculo com o Kairo removido.');
    },
  });

  const status = statusQuery.data;
  const isLinked = status?.linked === true;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setApiKey('');
            setUnlinkConfirmOpen(false);
          }
          onOpenChange(nextOpen);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unplug className="size-5" />
              Integrações
            </DialogTitle>
            <DialogDescription>
              Gerencie as integrações vinculadas à sua conta neste sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {statusQuery.isLoading && (
              <p className="text-muted-foreground text-sm">Carregando…</p>
            )}

            {!statusQuery.isLoading && (
              <Collapsible
                defaultOpen={isLinked}
                className="group/kairo overflow-hidden rounded-lg border shadow-sm"
              >
                <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 data-[state=open]:bg-muted/20">
                  <KairoIcon className="size-7" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Kairo</p>
                    <p className="text-muted-foreground text-xs">
                      Apontamentos e envio de solicitações
                    </p>
                  </div>
                  <KairoLinkStatusBadge linked={isLinked} />
                  <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/kairo:rotate-180" />
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="space-y-4 border-t bg-muted/20 px-4 py-4">
                    {isLinked ? (
                      <>
                        <dl className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                              Prefixo
                            </dt>
                            <dd className="bg-background rounded-md border px-3 py-2 font-mono text-sm break-all">
                              {status.keyPrefix}…
                            </dd>
                          </div>
                          <div className="space-y-1.5">
                            <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                              Vinculado em
                            </dt>
                            <dd className="text-sm font-medium">
                              {format(
                                new Date(status.linkedAt),
                                "dd/MM/yyyy 'às' HH:mm",
                                { locale: ptBR },
                              )}
                            </dd>
                          </div>
                        </dl>

                        <Separator />

                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={unlinkMutation.isPending}
                            onClick={() => setUnlinkConfirmOpen(true)}
                          >
                            Desvincular
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-muted-foreground rounded-md border border-dashed bg-background/80 px-3 py-2.5 text-sm">
                          Vincule a chave pessoal gerada no Kairo. Ela fica
                          associada apenas à sua conta neste sistema.
                        </p>
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="kairo-api-key-modal">
                              Chave de API do Kairo
                            </Label>
                            <Input
                              id="kairo-api-key-modal"
                              type="password"
                              autoComplete="off"
                              placeholder="kairo_…"
                              value={apiKey}
                              onChange={(event) =>
                                setApiKey(event.target.value)
                              }
                            />
                          </div>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              disabled={
                                !apiKey.trim() || linkMutation.isPending
                              }
                              onClick={() =>
                                linkMutation.mutate(apiKey.trim())
                              }
                            >
                              Vincular
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={unlinkConfirmOpen} onOpenChange={setUnlinkConfirmOpen}>
        <AlertDialogContent className="sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular Kairo?</AlertDialogTitle>
            <AlertDialogDescription>
              Sua chave de API será removida deste sistema. Para usar o Kairo
              novamente, será necessário vincular uma nova chave.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unlinkMutation.mutate()}
              disabled={unlinkMutation.isPending}
            >
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
