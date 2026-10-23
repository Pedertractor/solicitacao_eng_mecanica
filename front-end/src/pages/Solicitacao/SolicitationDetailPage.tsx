import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Check,
  CircleCheck,
  Copy,
  FileText,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import {
  AppPageContainer,
  ListErrorState,
  ListLoadingState,
  PageHero,
} from '@/components/layout';
import {
  SolicitationOfPanel,
  SolicitationOfToggle,
} from '@/components/of/SolicitationOfPanel';
import {
  StampIcon,
  type StampIconHandle,
} from 'lucide-animated';
import { KairoIcon } from '@/components/kairo-icon';
import { listKairoCardIds } from '@/lib/kairo-cards';
import {
  SOLICITATION_CLIENT_LABELS,
  SOLICITATION_DELETION_SOURCE_LABELS,
  SOLICITATION_STATUS_LABELS,
  solicitationApi,
  type Solicitation,
  type SolicitationStatus,
} from '@/services/solicitation';
import { ROUTES, solicitationTrackPath } from '@/routes/constants';
import { SolicitationStatusBadge } from '@/components/SolicitationStatusBadge';
import { Button } from '@/components/ui/button';
import { surfaceStyles } from '@/lib/surface-styles';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { copyToClipboard } from '@/lib/clipboard';
import { cn, SoftBreakText } from '@/lib/utils';
import { useAuth } from '@/contexts/useAuth';
import {
  canManageSampleStage,
  canManageSolicitations,
  canManageToolingStage,
} from '@/config/permissions';
import { formatIsoDateLabel } from '@/config/process-instruction';
import { PartNumberChips } from '@/components/PartNumberAllocator';
import { WorkflowTimeline } from '@/components/workflow/WorkflowTimeline';
import { SolicitationKairoDialog } from './SolicitationKairoDialog';
import { ToolingKairoDialog } from './ToolingKairoDialog';

const REVIEW_ICON_SIZE = 16;
const REJECTED_BUTTON_CLASS =
  'border-transparent bg-muted text-muted-foreground hover:bg-muted dark:bg-muted';
const APPROVED_BUTTON_CLASS =
  'border-transparent bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:text-white';
const EDITABLE_STATUSES: SolicitationStatus[] = [
  'PENDING',
  'IN_REVIEW',
  'APPROVED',
  'COMPLETED',
  'CANCELLED',
];

function trackAbsoluteUrl(trackingCode: string) {
  return `${window.location.origin}${solicitationTrackPath(trackingCode)}`;
}

async function copyText(value: string) {
  await copyToClipboard(value);
  toast.success('Copiado.');
}

export function SolicitationDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const canManage =
    user?.role != null &&
    canManageSolicitations(user.role, user.department);
  const canTooling =
    user?.role != null &&
    canManageToolingStage(user.role, user.department);
  const canSample =
    user?.role != null &&
    canManageSampleStage(user.role, user.department);
  const queryClient = useQueryClient();
  const [kairoDialogOpen, setKairoDialogOpen] = useState(false);
  const [toolingDialogOpen, setToolingDialogOpen] = useState(false);
  const [sampleDialogOpen, setSampleDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [ofPanelOpen, setOfPanelOpen] = useState(false);
  const [trackLinkCopied, setTrackLinkCopied] = useState(false);
  const kairoOpenTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (kairoOpenTimeoutRef.current !== null) {
        window.clearTimeout(kairoOpenTimeoutRef.current);
      }
    };
  }, []);

  function openKairoDialogAfterApprove() {
    if (kairoOpenTimeoutRef.current !== null) {
      window.clearTimeout(kairoOpenTimeoutRef.current);
    }
    kairoOpenTimeoutRef.current = window.setTimeout(() => {
      setKairoDialogOpen(true);
      kairoOpenTimeoutRef.current = null;
    }, 1000);
  }

  const query = useQuery({
    queryKey: ['solicitation', id],
    queryFn: () => solicitationApi.getById(id),
    enabled: Boolean(id),
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (!id || !query.data || query.data.status !== 'PENDING') return;

    let cancelled = false;
    void (async () => {
      try {
        const updated = await solicitationApi.startReview(id);
        if (cancelled) return;
        queryClient.setQueryData(['solicitation', id], updated);
        queryClient.invalidateQueries({ queryKey: ['solicitations'] });
      } catch {
        // toast global do axios cobre o erro
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, query.data, queryClient]);

  useEffect(() => {
    if (
      !id ||
      !query.data ||
      !listKairoCardIds(query.data).length ||
      query.data.status === 'COMPLETED' ||
      query.data.status === 'CANCELLED' ||
      query.data.status === 'DELETED'
    ) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const updated = await solicitationApi.syncFromKairo(id);
        if (cancelled) return;
        queryClient.setQueryData(['solicitation', id], updated);
        if (
          updated.status === 'COMPLETED' ||
          updated.status === 'DELETED'
        ) {
          queryClient.invalidateQueries({ queryKey: ['solicitations'] });
        }
      } catch {
        // sync silencioso — toast só em erros relevantes do usuário
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, query.data, queryClient]);

  const statusMutation = useMutation({
    mutationFn: (status: SolicitationStatus) =>
      solicitationApi.updateStatus(id, status),
    onSuccess: (updated) => {
      queryClient.setQueryData(['solicitation', id], updated);
      queryClient.invalidateQueries({ queryKey: ['solicitations'] });
      toast.success('Status atualizado.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => solicitationApi.delete(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(['solicitation', id], updated);
      queryClient.invalidateQueries({ queryKey: ['solicitations'] });
      setDeleteConfirmOpen(false);
      toast.success('Solicitação excluída.');
    },
  });

  const item = query.data;
  const canDelete = item ? item.status !== 'DELETED' : false;
  const fromComercial =
    (location.state as { from?: string } | null)?.from === 'comercial';

  return (
    <AppPageContainer className="min-w-0">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to={fromComercial ? ROUTES.WORKFLOW : ROUTES.SOLICITACOES}>
          <ArrowLeft className="mr-2 size-4" /> Voltar
        </Link>
      </Button>

      {query.isLoading ? <ListLoadingState count={2} heightClass="h-40" /> : null}
      {query.isError ? (
        <ListErrorState>
          Não foi possível carregar a solicitação.
        </ListErrorState>
      ) : null}

      {item && (
        <>
          <PageHero
            eyebrow="Detalhe do chamado"
            eyebrowIcon={FileText}
            title={item.title}
            description={`Criada em ${format(new Date(item.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
            compact
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {canManage ? (
                  <EditableSolicitationStatus
                    status={item.status}
                    disabled={
                      statusMutation.isPending ||
                      item.status === 'DELETED' ||
                      item.status === 'COMPLETED'
                    }
                    onStatusChange={(status) => statusMutation.mutate(status)}
                  />
                ) : (
                  <SolicitationStatusBadge status={item.status} />
                )}
                {canManage && canDelete ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="mr-1.5 size-3.5" />
                    Excluir
                  </Button>
                ) : null}
              </div>
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={surfaceStyles.monoCode}>{item.trackingCode}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="shrink-0 text-muted-foreground"
                aria-label={
                  trackLinkCopied ? 'Link copiado' : 'Copiar link público'
                }
                onClick={() => {
                  void (async () => {
                    try {
                      await copyText(trackAbsoluteUrl(item.trackingCode));
                      setTrackLinkCopied(true);
                      window.setTimeout(() => setTrackLinkCopied(false), 2000);
                    } catch {
                      toast.error('Não foi possível copiar o link.');
                    }
                  })();
                }}
              >
                {trackLinkCopied ? (
                  <CircleCheck className="size-3 text-green-600" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
            </div>
          </PageHero>

          <div className="space-y-3">
            {item.workflow ? (
              <WorkflowActionsCard
                item={item}
                canTooling={canTooling}
                canSample={canSample}
                onOpenTooling={() => setToolingDialogOpen(true)}
                onOpenSample={() => setSampleDialogOpen(true)}
              />
            ) : null}
            <div className="space-y-2">
              <SolicitationOfToggle
                open={ofPanelOpen}
                onOpenChange={setOfPanelOpen}
                hasOf={Boolean(item.ofNumber)}
                ofNumber={item.ofNumber}
              />
              <SolicitationOfPanel
                item={item}
                canManage={canManage}
                open={ofPanelOpen}
                onOpenChange={setOfPanelOpen}
              />
            </div>
          </div>

          <Card className={cn('min-w-0 overflow-hidden', surfaceStyles.card)}>
            <CardHeader>
              <CardTitle>Dados da solicitação</CardTitle>
              <CardDescription>
                Informações do solicitante e da instrução de processo
              </CardDescription>
            </CardHeader>
            <CardContent className="grid min-w-0 max-w-full gap-4 md:grid-cols-2">
              {item.status === 'DELETED' ? (
                <div className="min-w-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 md:col-span-2 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
                  <p className="font-medium">Solicitação excluída</p>
                  <p className="mt-1 text-muted-foreground dark:text-red-200/80">
                    Por {item.deletedByName ?? '—'}
                    {item.deletedFrom
                      ? ` · via ${SOLICITATION_DELETION_SOURCE_LABELS[item.deletedFrom]}`
                      : ''}
                    {item.deletedAt
                      ? ` · ${format(new Date(item.deletedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                      : ''}
                  </p>
                </div>
              ) : null}
              <Field label="Solicitante" value={item.requesterName} />
              <Field
                label="E-mail"
                value={item.requesterEmail ?? '—'}
              />
              <Field
                label="Cartão / Unidade"
                value={`${item.cardNumber} · ${item.unit}`}
              />
              <Field label="Centro de custo" value={item.costCenter} />
              <Field label="Setor" value={item.sectorName} />
              <Field label="Pilar / local" value={item.pillarOrLocation} />
              {item.department === 'DESENVOLVIMENTO_PROCESSOS' ? (
                <div className="grid min-w-0 gap-4 md:col-span-2 md:grid-cols-2">
                  <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide md:col-span-2">
                    Instrução de processo
                  </div>
                  <Field
                    label="Área solicitante"
                    value={item.processInstructionRequester ?? '—'}
                  />
                  <Field
                    label="Processo"
                    value={item.processInstructionProcess ?? '—'}
                  />
                  <Field
                    label="Tipo"
                    value={item.processInstructionType ?? '—'}
                  />
                  <Field
                    label="Cliente"
                    value={
                      item.client
                        ? SOLICITATION_CLIENT_LABELS[item.client]
                        : '—'
                    }
                  />
                  <Field
                    label="Prazo"
                    value={item.processInstructionDeadlineLabel ?? '—'}
                  />
                  <Field
                    label="Data limite"
                    value={item.processInstructionDeadlineDate ?? '—'}
                  />
                  {item.deliveryDate ? (
                    <Field
                      label="Data de entrega"
                      value={formatIsoDateLabel(item.deliveryDate)}
                    />
                  ) : null}
                  <div className="min-w-0">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide">
                      Part Number
                    </div>
                    <PartNumberChips value={item.partNumbers} />
                  </div>
                  <Field
                    label="Link de arquivos"
                    value={item.fileLink?.trim() || '—'}
                  />
                  {item.description.trim() ? (
                    <div className="min-w-0 md:col-span-2">
                      <Field
                        label="Comentários"
                        value={item.description}
                        multiline
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="min-w-0 md:col-span-2">
                  <Field label="Descrição" value={item.description} multiline />
                </div>
              )}
              {listKairoCardIds(item).length > 0 ? (
                <div className="min-w-0 md:col-span-2">
                  <div className="text-muted-foreground text-xs uppercase tracking-wide">
                    {listKairoCardIds(item).length > 1
                      ? 'Cards Kairo'
                      : 'Card Kairo'}
                  </div>
                  <ul className="mt-1 space-y-1">
                    {listKairoCardIds(item).map((cardId) => (
                      <li key={cardId} className="break-all font-mono text-sm">
                        {cardId}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {canManage &&
              item.department === 'DESENVOLVIMENTO_PROCESSOS' ? (
                <SolicitationReviewPanel
                  key={`${item.id}-${item.updatedAt}-embedded`}
                  id={id}
                  item={item}
                  variant="embedded"
                  onApproved={openKairoDialogAfterApprove}
                  onOpenKairo={() => setKairoDialogOpen(true)}
                />
              ) : null}
            </CardContent>
          </Card>

          {item.workflow ? (
            <>
              <ToolingKairoDialog
                open={toolingDialogOpen}
                onOpenChange={setToolingDialogOpen}
                solicitation={item}
                stage='FERRAMENTARIA'
              />
              <ToolingKairoDialog
                open={sampleDialogOpen}
                onOpenChange={setSampleDialogOpen}
                solicitation={item}
                stage='AMOSTRA'
              />
            </>
          ) : null}

          {canManage ? (
            <>
          {item.department !== 'DESENVOLVIMENTO_PROCESSOS' ? (
            <SolicitationReviewPanel
              key={`${item.id}-${item.updatedAt}`}
              id={id}
              item={item}
              onApproved={openKairoDialogAfterApprove}
              onOpenKairo={() => setKairoDialogOpen(true)}
            />
          ) : null}

          <SolicitationKairoDialog
            open={kairoDialogOpen}
            onOpenChange={setKairoDialogOpen}
            solicitation={item}
          />

          <AlertDialog
            open={deleteConfirmOpen}
            onOpenChange={setDeleteConfirmOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
                <AlertDialogDescription>
                  A solicitação permanecerá no histórico como excluída.
                  {listKairoCardIds(item).length > 1
                    ? ' Os cards correspondentes no Kairo também serão excluídos.'
                    : listKairoCardIds(item).length === 1
                      ? ' O card correspondente no Kairo também será excluído.'
                      : ''}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  disabled={deleteMutation.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    deleteMutation.mutate();
                  }}
                >
                  {deleteMutation.isPending ? 'Excluindo…' : 'Excluir'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
            </>
          ) : null}
        </>
      )}
    </AppPageContainer>
  );
}

function WorkflowActionsCard({
  item,
  canTooling,
  canSample,
  onOpenTooling,
  onOpenSample,
}: {
  item: Solicitation;
  canTooling: boolean;
  canSample: boolean;
  onOpenTooling: () => void;
  onOpenSample: () => void;
}) {
  const queryClient = useQueryClient();
  const workflow = item.workflow!;
  const tooling = workflow.stages.find((stage) => stage.stage === 'FERRAMENTARIA');
  const sample = workflow.stages.find((stage) => stage.stage === 'AMOSTRA');
  const engineering = workflow.stages.find((stage) => stage.stage === 'ENGENHARIA');

  const toolingReady =
    engineering?.status === 'DONE' &&
    tooling != null &&
    (tooling.status === 'READY' || tooling.status === 'PENDING') &&
    !tooling.kairoCardIds;

  const previousDoneForSample = tooling
    ? tooling.status === 'DONE'
    : engineering?.status === 'DONE';

  const sampleReady =
    previousDoneForSample &&
    sample != null &&
    (sample.status === 'READY' || sample.status === 'PENDING') &&
    !sample.kairoCardIds;

  const syncToolingMutation = useMutation({
    mutationFn: () => solicitationApi.syncToolingFromKairo(item.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(['solicitation', item.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['solicitations'] });
      void queryClient.invalidateQueries({ queryKey: ['workflow-summary'] });
      toast.success('Ferramentaria sincronizada.');
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { error?: string } } }).response
              ?.data?.error
          : undefined;
      toast.error(message || 'Falha ao sincronizar ferramentaria.');
    },
  });

  const syncSampleMutation = useMutation({
    mutationFn: () => solicitationApi.syncSampleFromKairo(item.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(['solicitation', item.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['solicitations'] });
      void queryClient.invalidateQueries({ queryKey: ['workflow-summary'] });
      toast.success('Amostra sincronizada.');
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { error?: string } } }).response
              ?.data?.error
          : undefined;
      toast.error(message || 'Falha ao sincronizar amostra.');
    },
  });

  return (
    <Card id="workflow" className={cn(surfaceStyles.card)}>
      <CardHeader>
        <CardTitle>Workflow</CardTitle>
        <CardDescription>
          Engenharia →{workflow.requiresTooling ? ' Ferramentaria →' : ''}{' '}
          Amostra
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <WorkflowTimeline workflow={workflow} />

        {(canTooling || canSample) && (
          <div className='flex flex-wrap gap-2'>
            {canTooling && toolingReady ? (
              <Button type='button' onClick={onOpenTooling}>
                Enviar Ferramentaria ao Kairo
              </Button>
            ) : null}
            {canTooling && tooling?.kairoCardIds ? (
              <Button
                type='button'
                variant='outline'
                disabled={syncToolingMutation.isPending}
                onClick={() => syncToolingMutation.mutate()}
              >
                {syncToolingMutation.isPending
                  ? 'Sincronizando…'
                  : 'Sincronizar Ferramentaria'}
              </Button>
            ) : null}
            {canSample && sampleReady ? (
              <Button type='button' onClick={onOpenSample}>
                Enviar Amostra ao Kairo
              </Button>
            ) : null}
            {canSample && sample?.kairoCardIds ? (
              <Button
                type='button'
                variant='outline'
                disabled={syncSampleMutation.isPending}
                onClick={() => syncSampleMutation.mutate()}
              >
                {syncSampleMutation.isPending
                  ? 'Sincronizando…'
                  : 'Sincronizar Amostra'}
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SolicitationReviewPanel({
  id,
  item,
  variant = 'card',
  onApproved,
  onOpenKairo,
}: {
  id: string;
  item: Solicitation;
  variant?: 'card' | 'embedded';
  onApproved?: () => void;
  onOpenKairo?: () => void;
}) {
  const queryClient = useQueryClient();
  const approveIconRef = useRef<StampIconHandle>(null);
  const isDeleted = item.status === 'DELETED';
  const isRejected = item.status === 'CANCELLED';
  const isApproved =
    item.status === 'APPROVED' ||
    item.status === 'COMPLETED' ||
    isDeleted;
  const reviewClosed = isApproved || isRejected;
  const sentToKairo = listKairoCardIds(item).length > 0;

  const approveMutation = useMutation({
    mutationFn: () => solicitationApi.updateReview(id, { approve: true }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['solicitation', id], updated);
      queryClient.invalidateQueries({ queryKey: ['solicitations'] });
      toast.success('Solicitação aprovada.');
      if (!listKairoCardIds(updated).length) {
        onApproved?.();
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => solicitationApi.updateStatus(id, 'CANCELLED'),
    onSuccess: (updated) => {
      queryClient.setQueryData(['solicitation', id], updated);
      queryClient.invalidateQueries({ queryKey: ['solicitations'] });
      toast.success('Solicitação reprovada.');
    },
  });

  const acting =
    approveMutation.isPending || rejectMutation.isPending;

  const reviewDescription = isDeleted
    ? 'Solicitação excluída.'
    : isRejected
      ? 'Solicitação reprovada.'
      : isApproved
        ? 'Solicitação aprovada.'
        : 'Aprove ou reprove a solicitação.';

  const actions = (
    <div className="flex flex-wrap justify-end gap-2">
      {isRejected ? (
        <Button
          type="button"
          disabled
          variant="outline"
          className={cn(REJECTED_BUTTON_CLASS, 'disabled:opacity-100')}
        >
          <X className="size-4" />
          Reprovada
        </Button>
      ) : null}
      {isApproved ? (
        <>
          {!isDeleted ? (
            <Button type="button" variant="outline" onClick={onOpenKairo}>
              <KairoIcon className="size-4" />
              Kairo
              {sentToKairo && (
                <CircleCheck
                  className="size-4 text-emerald-600"
                  aria-label="Enviado ao Kairo"
                />
              )}
            </Button>
          ) : null}
          {!isDeleted ? (
            <Button
              type="button"
              disabled
              className={cn(APPROVED_BUTTON_CLASS, 'disabled:opacity-100')}
            >
              <Check className="size-4" />
              Aprovado
            </Button>
          ) : null}
        </>
      ) : !reviewClosed ? (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={acting}
            onClick={() => rejectMutation.mutate()}
          >
            <X className="size-4" />
            Reprovar
          </Button>
          <Button
            type="button"
            disabled={acting}
            onMouseEnter={() => approveIconRef.current?.startAnimation()}
            onMouseLeave={() => approveIconRef.current?.stopAnimation()}
            onClick={() => approveMutation.mutate()}
          >
            <StampIcon
              ref={approveIconRef}
              size={REVIEW_ICON_SIZE}
              animateOnHover={false}
            />
            Aprovar
          </Button>
        </>
      ) : null}
    </div>
  );

  if (variant === 'embedded') {
    return (
      <div className="min-w-0 space-y-3 border-t pt-4 md:col-span-2">
        {!isApproved && !isRejected && !isDeleted ? (
          <p className="text-muted-foreground text-sm">{reviewDescription}</p>
        ) : null}
        {actions}
      </div>
    );
  }

  return (
    <Card className={cn('min-w-0 overflow-hidden', surfaceStyles.card)}>
      <CardHeader>
        <CardTitle>Revisão</CardTitle>
        <CardDescription>{reviewDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{actions}</CardContent>
    </Card>
  );
}

function EditableSolicitationStatus({
  status,
  disabled,
  onStatusChange,
}: {
  status: SolicitationStatus;
  disabled?: boolean;
  onStatusChange: (status: SolicitationStatus) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <Select
        open
        value={status}
        onOpenChange={(open) => {
          if (!open) setEditing(false);
        }}
        onValueChange={(value) => {
          onStatusChange(value as SolicitationStatus);
          setEditing(false);
        }}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EDITABLE_STATUSES.map((option) => (
            <SelectItem key={option} value={option}>
              {SOLICITATION_STATUS_LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <SolicitationStatusBadge status={status} />
      {status !== 'DELETED' && status !== 'COMPLETED' ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          aria-label="Editar status"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden">
      <div className="text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 max-w-full overflow-hidden text-sm [overflow-wrap:anywhere] [word-break:break-word]',
          multiline && 'whitespace-pre-wrap',
        )}
        style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}
      >
        <SoftBreakText text={value} />
      </div>
    </div>
  );
}

