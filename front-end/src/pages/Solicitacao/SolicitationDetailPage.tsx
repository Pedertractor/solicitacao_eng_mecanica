import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Check, CircleCheck, Copy, Pencil, Trash2 } from 'lucide-react';
import {
  CheckIcon,
  StampIcon,
  type CheckIconHandle,
  type StampIconHandle,
} from 'lucide-animated';
import { KairoIcon } from '@/components/kairo-icon';
import {
  SOLICITATION_ACTIVITY_TYPE_LABELS,
  SOLICITATION_CLIENT_LABELS,
  SOLICITATION_DELETION_SOURCE_LABELS,
  SOLICITATION_PRIORITY_LABELS,
  SOLICITATION_PRODUCT_TYPE_LABELS,
  SOLICITATION_STATUS_LABELS,
  solicitationApi,
  type Solicitation,
  type SolicitationActivityType,
  type SolicitationClient,
  type SolicitationPriority,
  type SolicitationProductType,
  type SolicitationStatus,
} from '@/services/solicitation';
import { ROUTES, solicitationTrackPath } from '@/routes/constants';
import { SolicitationStatusBadge } from '@/components/SolicitationStatusBadge';
import { Button } from '@/components/ui/button';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { copyToClipboard } from '@/lib/clipboard';
import { cn, SoftBreakText } from '@/lib/utils';
import { SolicitationKairoDialog } from './SolicitationKairoDialog';

const NONE = '__none__';
const REVIEW_ICON_SIZE = 16;
const APPROVED_BUTTON_CLASS =
  'border-transparent bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:text-white';
const OPEN_STATUSES: SolicitationStatus[] = [
  'PENDING',
  'IN_REVIEW',
  'APPROVED',
];
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
  const queryClient = useQueryClient();
  const [kairoDialogOpen, setKairoDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
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
      !query.data.kairoCardId ||
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
  const canDelete = item ? OPEN_STATUSES.includes(item.status) : false;

  return (
    <div className="min-w-0 max-w-full space-y-4 md:p-6">
      <Button asChild variant="ghost" size="sm">
        <Link to={ROUTES.SOLICITACOES}>
          <ArrowLeft className="mr-2 size-4" /> Voltar
        </Link>
      </Button>

      {query.isLoading && <p>Carregando…</p>}
      {query.isError && <p>Não foi possível carregar a solicitação.</p>}

      {item && (
        <>
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <CardTitle className="break-words">{item.title}</CardTitle>
                <CardDescription>
                  Criada em{' '}
                  {format(new Date(item.createdAt), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <EditableSolicitationStatus
                  status={item.status}
                  disabled={
                    statusMutation.isPending || item.status === 'DELETED'
                  }
                  onStatusChange={(status) => statusMutation.mutate(status)}
                />
                {canDelete ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="mr-1.5 size-3.5" />
                    Excluir
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="grid min-w-0 max-w-full gap-4 md:grid-cols-2">
              {item.status === 'DELETED' ? (
                <div className="min-w-0 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 md:col-span-2 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
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
              <div className="min-w-0 md:col-span-2">
                <div className="text-muted-foreground text-xs uppercase tracking-wide">
                  Protocolo
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-sm font-medium tracking-wide">
                    {item.trackingCode}
                  </span>
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
                          await copyText(
                            trackAbsoluteUrl(item.trackingCode),
                          );
                          setTrackLinkCopied(true);
                          window.setTimeout(
                            () => setTrackLinkCopied(false),
                            2000,
                          );
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
              </div>
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
              <div className="min-w-0 md:col-span-2">
                <Field label="Descrição" value={item.description} multiline />
              </div>
            </CardContent>
          </Card>

          <SolicitationReviewPanel
            key={`${item.id}-${item.updatedAt}`}
            id={id}
            item={item}
            onApproved={openKairoDialogAfterApprove}
            onOpenKairo={() => setKairoDialogOpen(true)}
          />

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
                  {item.kairoCardId
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
      )}
    </div>
  );
}

function SolicitationReviewPanel({
  id,
  item,
  onApproved,
  onOpenKairo,
}: {
  id: string;
  item: Solicitation;
  onApproved?: () => void;
  onOpenKairo?: () => void;
}) {
  const queryClient = useQueryClient();
  const saveIconRef = useRef<CheckIconHandle>(null);
  const approveIconRef = useRef<StampIconHandle>(null);
  const isDeleted = item.status === 'DELETED';
  const isApproved =
    item.status === 'APPROVED' ||
    item.status === 'COMPLETED' ||
    isDeleted;
  const sentToKairo = Boolean(item.kairoCardId);

  const [client, setClient] = useState<SolicitationClient | null>(item.client);
  const [activityType, setActivityType] =
    useState<SolicitationActivityType | null>(item.activityType);
  const [productType, setProductType] =
    useState<SolicitationProductType | null>(item.productType);
  const [priority, setPriority] = useState<SolicitationPriority | null>(
    item.priority,
  );

  const reviewMutation = useMutation({
    mutationFn: (approve: boolean) =>
      solicitationApi.updateReview(id, {
        client,
        activityType,
        productType,
        priority,
        approve,
      }),
    onSuccess: (updated, approve) => {
      queryClient.setQueryData(['solicitation', id], updated);
      queryClient.invalidateQueries({ queryKey: ['solicitations'] });
      toast.success(approve ? 'Solicitação aprovada.' : 'Revisão salva.');
      if (approve && !updated.kairoCardId) {
        onApproved?.();
      }
    },
  });

  const saving = reviewMutation.isPending;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>Revisão</CardTitle>
        <CardDescription>
          {isDeleted
            ? 'Solicitação excluída. Os dados de classificação foram preservados no histórico.'
            : isApproved
              ? 'Solicitação aprovada. Os campos de classificação não podem mais ser editados.'
              : 'Preencha os campos para classificar a solicitação. Aprovar exige todos preenchidos.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <ReviewSelect
            label="Cliente"
            value={client}
            labels={SOLICITATION_CLIENT_LABELS}
            onChange={setClient}
            disabled={isApproved}
          />
          <ReviewSelect
            label="Tipo de Atividade"
            value={activityType}
            labels={SOLICITATION_ACTIVITY_TYPE_LABELS}
            onChange={setActivityType}
            disabled={isApproved}
          />
          <ReviewSelect
            label="Tipo de Produto"
            value={productType}
            labels={SOLICITATION_PRODUCT_TYPE_LABELS}
            onChange={setProductType}
            disabled={isApproved}
          />
          <ReviewSelect
            label="Prioridade"
            value={priority}
            labels={SOLICITATION_PRIORITY_LABELS}
            onChange={setPriority}
            disabled={isApproved}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {!isApproved && (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onMouseEnter={() => saveIconRef.current?.startAnimation()}
              onMouseLeave={() => saveIconRef.current?.stopAnimation()}
              onClick={() => reviewMutation.mutate(false)}
            >
              <CheckIcon
                ref={saveIconRef}
                size={REVIEW_ICON_SIZE}
                animateOnHover={false}
              />
              Salvar
            </Button>
          )}
          {isApproved ? (
            <>
              {!isDeleted ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onOpenKairo}
                >
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
                  className={cn(
                    APPROVED_BUTTON_CLASS,
                    'disabled:opacity-100',
                  )}
                >
                  <Check className="size-4" />
                  Aprovado
                </Button>
              ) : null}
            </>
          ) : (
            <Button
              type="button"
              disabled={saving}
              onMouseEnter={() => approveIconRef.current?.startAnimation()}
              onMouseLeave={() => approveIconRef.current?.stopAnimation()}
              onClick={() => reviewMutation.mutate(true)}
            >
              <StampIcon
                ref={approveIconRef}
                size={REVIEW_ICON_SIZE}
                animateOnHover={false}
              />
              Aprovar
            </Button>
          )}
        </div>
      </CardContent>
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
      {status !== 'DELETED' ? (
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

function ReviewSelect<T extends string>({
  label,
  value,
  labels,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T | null;
  labels: Record<T, string>;
  onChange: (value: T | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Label>{label} *</Label>
      <Select
        value={value ?? NONE}
        disabled={disabled}
        onValueChange={(next) =>
          onChange(next === NONE ? null : (next as T))
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Selecione</SelectItem>
          {(Object.keys(labels) as T[]).map((key) => (
            <SelectItem key={key} value={key}>
              {labels[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
