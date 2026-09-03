import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { IntegrationsDialog } from '@/components/IntegrationsDialog';
import { KairoCardPreview } from '@/components/kairo-card-preview';
import { KairoIcon } from '@/components/kairo-icon';
import {
  KairoSendProgressDialog,
  type KairoSendPhase,
} from '@/components/kairo-send-progress-dialog';
import { KairoTagBadge } from '@/components/kairo-tag-badge';
import { kairoApi } from '@/services/kairo';
import {
  solicitationApi,
  SOLICITATION_KIND_LABELS,
  type Solicitation,
  type SolicitationKind,
} from '@/services/solicitation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildDefaultKairoDescription } from '@/lib/kairo-send-content';
import { cn } from '@/lib/utils';
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

export function SolicitationKairoDialog({
  open,
  onOpenChange,
  solicitation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitation: Solicitation;
}) {
  const queryClient = useQueryClient();
  const [accountIntegrationsOpen, setAccountIntegrationsOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-0">
          <KairoSendView
            key={solicitation.id}
            solicitation={solicitation}
            onClose={() => onOpenChange(false)}
            onOpenAccountIntegrations={() => setAccountIntegrationsOpen(true)}
          />
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

function KairoSendView({
  solicitation,
  onClose,
  onOpenAccountIntegrations,
}: {
  solicitation: Solicitation;
  onClose: () => void;
  onOpenAccountIntegrations: () => void;
}) {
  const queryClient = useQueryClient();
  const [teamId, setTeamId] = useState('');
  const [kind, setKind] = useState<SolicitationKind>(
    solicitation.kind ?? 'ATIVIDADE',
  );
  const [tagId, setTagId] = useState('');
  const [title, setTitle] = useState(solicitation.title);
  const [description, setDescription] = useState(() =>
    buildDefaultKairoDescription(solicitation),
  );
  const [estimatedHours, setEstimatedHours] = useState('');
  const [sendProgressOpen, setSendProgressOpen] = useState(false);
  const [sendPhase, setSendPhase] = useState<KairoSendPhase>('running');
  const [sendErrorMessage, setSendErrorMessage] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ['kairo-status'],
    queryFn: () => kairoApi.getStatus(),
  });

  const teamsQuery = useQuery({
    queryKey: ['kairo-teams'],
    queryFn: () => kairoApi.listTeams(),
    enabled: statusQuery.data?.linked === true && !solicitation.kairoCardId,
  });

  const tagsQuery = useQuery({
    queryKey: ['kairo-tags', teamId],
    queryFn: () => kairoApi.listTags(teamId),
    enabled:
      !solicitation.kairoCardId &&
      kind === 'ATIVIDADE' &&
      Boolean(teamId),
  });

  const parsedEstimatedHours = estimatedHours.trim()
    ? Number.parseFloat(estimatedHours)
    : Number.NaN;
  const validEstimatedHours =
    Number.isFinite(parsedEstimatedHours) && parsedEstimatedHours > 0
      ? parsedEstimatedHours
      : undefined;

  const sendMutation = useMutation({
    mutationFn: () =>
      solicitationApi.sendToKairo(solicitation.id, {
        teamId,
        kind,
        title: title.trim(),
        description: description.trim(),
        ...(kind === 'ATIVIDADE' && tagId ? { tagId } : {}),
        ...(kind === 'PROJETO' && validEstimatedHours
          ? { estimatedHours: validEstimatedHours }
          : {}),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['solicitation', solicitation.id], updated);
      queryClient.invalidateQueries({ queryKey: ['solicitations'] });
      setSendPhase('success');
    },
    onError: (error: { message?: string }) => {
      setSendErrorMessage(
        error.message?.trim() || 'Não foi possível enviar ao Kairo.',
      );
      setSendPhase('error');
    },
  });

  function startSend() {
    setSendErrorMessage(null);
    setSendPhase('running');
    setSendProgressOpen(true);
    sendMutation.mutate();
  }

  function closeSendProgress() {
    setSendProgressOpen(false);
    if (sendPhase === 'success') {
      onClose();
    }
  }

  function retrySend() {
    setSendErrorMessage(null);
    setSendPhase('running');
    sendMutation.mutate();
  }

  const linked = statusQuery.data?.linked === true;
  const alreadySent = Boolean(solicitation.kairoCardId);
  const canSubmit =
    linked &&
    Boolean(title.trim()) &&
    Boolean(description.trim()) &&
    Boolean(teamId) &&
    (kind === 'PROJETO' || Boolean(tagId)) &&
    !sendMutation.isPending;
  const selectedTag =
    kind === 'ATIVIDADE'
      ? (tagsQuery.data ?? []).find((tag) => tag.id === tagId) ?? null
      : null;

  return (
    <>
      <DialogHeader className="shrink-0 px-6 pt-6 pr-12">
        <DialogTitle className="flex items-center gap-2">
          <KairoIcon className="size-6" />
          Enviar ao Kairo
        </DialogTitle>
        <DialogDescription>
          {alreadySent
            ? 'Esta solicitação já foi enviada ao Kairo.'
            : 'Escolha o time e se a solicitação será criada como projeto ou atividade.'}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {alreadySent ? (
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <SentField label="Card Kairo" value={solicitation.kairoCardId ?? '—'} />
            <SentField label="Time" value={solicitation.kairoTeamId ?? '—'} />
            <SentField
              label="Enviado em"
              value={
                solicitation.kairoSyncedAt
                  ? format(
                      new Date(solicitation.kairoSyncedAt),
                      "dd/MM/yyyy 'às' HH:mm",
                      { locale: ptBR },
                    )
                  : '—'
              }
            />
          </div>
        ) : statusQuery.isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando…</p>
        ) : !linked ? (
          <div className="space-y-3 text-sm">
            <p>
              Você ainda não vinculou uma chave do Kairo. Gere a chave no Kairo e
              vincule em Integrações.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={onOpenAccountIntegrations}
            >
              Vincular Kairo
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Time</Label>
              <Select
                value={teamId || undefined}
                onValueChange={(value) => {
                  setTeamId(value);
                  setTagId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o time" />
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

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={kind}
                onValueChange={(value) => {
                  const nextKind = value as SolicitationKind;
                  setKind(nextKind);
                  setTagId('');
                  if (nextKind !== 'PROJETO') {
                    setEstimatedHours('');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(SOLICITATION_KIND_LABELS) as SolicitationKind[]
                  ).map((option) => (
                    <SelectItem key={option} value={option}>
                      {SOLICITATION_KIND_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {kind === 'ATIVIDADE' && (
              <div className="space-y-2">
                <Label>Etiqueta</Label>
                <Select
                  value={tagId || undefined}
                  onValueChange={setTagId}
                  disabled={!teamId || tagsQuery.isLoading}
                >
                  <SelectTrigger className="h-auto min-h-8 py-1">
                    <SelectValue
                      placeholder={
                        !teamId
                          ? 'Selecione um time primeiro'
                          : tagsQuery.isLoading
                            ? 'Carregando etiquetas…'
                            : 'Selecione a etiqueta'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(tagsQuery.data ?? []).map((tag) => (
                      <SelectItem key={tag.id} value={tag.id} className="py-2">
                        <KairoTagBadge tag={tag} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {kind === 'PROJETO' && (
              <div className="space-y-2">
                <Label htmlFor="kairo-send-estimated-hours">
                  Horas estimadas
                </Label>
                <Input
                  id="kairo-send-estimated-hours"
                  type="number"
                  min="0"
                  step="0.25"
                  value={estimatedHours}
                  onChange={(event) => setEstimatedHours(event.target.value)}
                  placeholder="Ex.: 40"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="kairo-send-title">Título</Label>
              <Input
                id="kairo-send-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kairo-send-description">Descrição</Label>
              <textarea
                id="kairo-send-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={cn(
                  'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-28 w-full resize-y rounded-md border px-3 py-2 text-sm whitespace-pre-wrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                )}
              />
            </div>

            <KairoCardPreview
              title={title}
              description={description}
              kind={kind}
              tag={selectedTag}
              estimatedHours={estimatedHours}
            />
          </div>
        )}
      </div>

      <DialogFooter className="shrink-0 border-t px-6 py-4">
        <Button type="button" variant="outline" onClick={onClose}>
          {alreadySent ? 'Fechar' : 'Cancelar'}
        </Button>
        {!alreadySent && linked && (
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={startSend}
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enviando…
              </>
            ) : (
              'Confirmar envio'
            )}
          </Button>
        )}
      </DialogFooter>

      <KairoSendProgressDialog
        open={sendProgressOpen}
        phase={sendPhase}
        errorMessage={sendErrorMessage}
        onClose={closeSendProgress}
        onRetry={retrySend}
      />
    </>
  );
}

function SentField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 break-all text-sm">{value}</div>
    </div>
  );
}
