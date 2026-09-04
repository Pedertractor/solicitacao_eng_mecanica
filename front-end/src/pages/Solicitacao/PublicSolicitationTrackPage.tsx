import { Link, useParams } from 'react-router-dom';
import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, Circle, Loader2, XCircle } from 'lucide-react';
import {
  BookmarkPlusIcon,
  type BookmarkPlusIconHandle,
} from '@/components/icons/bookmark-plus';
import {
  solicitationApi,
  type SolicitationStatus,
} from '@/services/solicitation';
import { ROUTES } from '@/routes/constants';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn, SoftBreakText } from '@/lib/utils';
import {
  PublicSolicitationShell,
  publicSolicitationTicketCardClass,
  TicketStub,
} from '@/pages/Solicitacao/PublicSolicitationShell';

const UNIT_LABELS = {
  PEDERTRACTOR: 'Pedertractor',
  TRACTOR: 'Tractor',
} as const;

const FLOW_STEPS: {
  status: Exclude<SolicitationStatus, 'CANCELLED' | 'DELETED'>;
  label: string;
}[] = [
  { status: 'PENDING', label: 'Pendente' },
  { status: 'IN_REVIEW', label: 'Em análise' },
  { status: 'APPROVED', label: 'Aprovado' },
  { status: 'COMPLETED', label: 'Concluída' },
];

const FLOW_ORDER: Record<
  Exclude<SolicitationStatus, 'CANCELLED' | 'DELETED'>,
  number
> = {
  PENDING: 0,
  IN_REVIEW: 1,
  APPROVED: 2,
  COMPLETED: 3,
};

const DESCRIPTION_MAX_LENGTH = 200;

const breakableTextClass =
  'block w-full min-w-0 max-w-full overflow-hidden [overflow-wrap:anywhere] [word-break:break-word]';

function formatDateTime(value: string) {
  return format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

function NewSolicitationLink() {
  const mobileIconRef = useRef<BookmarkPlusIconHandle>(null);
  const desktopIconRef = useRef<BookmarkPlusIconHandle>(null);

  return (
    <>
      <Link
        to={ROUTES.SOLICITACAO}
        className='mb-3 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:hidden'
      >
        <BookmarkPlusIcon ref={mobileIconRef} size={20} className='shrink-0' />
        Nova solicitação
      </Link>

      <Link
        to={ROUTES.SOLICITACAO}
        className='group absolute top-3 right-full z-10 mr-2 hidden items-center text-sm text-muted-foreground transition-colors hover:text-foreground sm:flex'
        aria-label='Nova solicitação'
        onMouseEnter={() => desktopIconRef.current?.startAnimation()}
        onMouseLeave={() => desktopIconRef.current?.stopAnimation()}
      >
        <span
          className={cn(
            'inline-block overflow-hidden whitespace-nowrap pr-0',
            'max-w-0 opacity-0',
            'transition-[max-width,opacity,padding-right] duration-300 ease-out',
            'group-hover:max-w-44 group-hover:pr-2 group-hover:opacity-100',
          )}
        >
          Nova solicitação
        </span>
        <BookmarkPlusIcon ref={desktopIconRef} size={20} className='shrink-0' />
      </Link>
    </>
  );
}

export function PublicSolicitationTrackPage() {
  const { trackingCode = '' } = useParams();

  const query = useQuery({
    queryKey: ['solicitation-track', trackingCode],
    queryFn: () => solicitationApi.getByTrackingCode(trackingCode),
    enabled: Boolean(trackingCode),
    retry: false,
  });

  return (
    <PublicSolicitationShell contentClassName='min-h-0 overflow-x-hidden overflow-y-auto'>
      <div className='flex w-full min-w-0 flex-1 flex-col justify-center py-1'>
        <div className='relative w-full min-w-0 max-w-full'>
          <NewSolicitationLink />
          <Card
            className={cn(
              'flex w-full min-w-0 max-w-full flex-col gap-0 overflow-hidden rounded-xl py-0',
              publicSolicitationTicketCardClass,
            )}
          >
          {query.isLoading && (
            <CardContent className='flex items-center justify-center gap-2 py-12 text-muted-foreground'>
              <Loader2 className='size-5 animate-spin' />
              Carregando ticket…
            </CardContent>
          )}

          {query.isError && (
            <CardHeader className='shrink-0 space-y-3 border-b py-6'>
              <CardTitle>Solicitação não encontrada</CardTitle>
              <CardDescription>
                O protocolo informado é inválido ou não existe mais.
              </CardDescription>
            </CardHeader>
          )}

          {query.data && (
            <>
              <CardHeader className='min-w-0 shrink-0 space-y-2 overflow-hidden border-b border-dashed py-4'>
                <div className='min-w-0 overflow-hidden'>
                  <p className='text-muted-foreground text-xs uppercase tracking-wide'>
                    Protocolo
                  </p>
                  <CardTitle
                    className={cn(
                      'mt-1 font-mono text-lg tracking-wide',
                      breakableTextClass,
                    )}
                  >
                    <SoftBreakText text={query.data.trackingCode} />
                  </CardTitle>
                </div>
                <CardDescription
                  className={cn(
                    'line-clamp-2 text-sm text-foreground',
                    breakableTextClass,
                  )}
                >
                  <SoftBreakText text={query.data.title} />
                </CardDescription>
              </CardHeader>

              <CardContent className='min-w-0 max-w-full space-y-4 overflow-x-hidden py-4'>
                <div className='grid min-w-0 max-w-full grid-cols-1 gap-3 sm:grid-cols-2'>
                  <Field label='Solicitante' value={query.data.requesterName} />
                  <Field label='Unidade' value={UNIT_LABELS[query.data.unit]} />
                  <Field label='Setor' value={query.data.sectorName} />
                  <Field
                    label='Pilar / local'
                    value={query.data.pillarOrLocation}
                  />
                  <Field
                    label='Criada em'
                    value={formatDateTime(query.data.createdAt)}
                  />
                  <Field
                    label='Última atualização'
                    value={
                      query.data.statusUpdatedAt
                        ? formatDateTime(query.data.statusUpdatedAt)
                        : '—'
                    }
                  />
                </div>

                <div className='min-w-0 max-w-full overflow-hidden'>
                  <p className='text-muted-foreground text-xs uppercase tracking-wide'>
                    Descrição
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-sm leading-snug',
                      breakableTextClass,
                    )}
                    style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}
                    title={query.data.description}
                  >
                    <SoftBreakText
                      text={truncateText(
                        query.data.description,
                        DESCRIPTION_MAX_LENGTH,
                      )}
                    />
                  </p>
                </div>
              </CardContent>

              <TicketStub>
                {query.data.status !== 'COMPLETED' && (
                  <p className='mb-3 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground'>
                    Andamento da solicitação
                  </p>
                )}
                <StatusStepper status={query.data.status} />
              </TicketStub>
            </>
          )}
        </Card>
        </div>
      </div>
    </PublicSolicitationShell>
  );
}

function StatusStepper({ status }: { status: SolicitationStatus }) {
  if (status === 'CANCELLED' || status === 'DELETED') {
    return (
      <div className='flex min-w-0 items-start gap-3 rounded-md border border-border bg-muted/40 px-4 py-3'>
        <XCircle className='mt-0.5 size-5 shrink-0 text-muted-foreground' />
        <div className='min-w-0 overflow-hidden'>
          <p className='text-sm font-medium'>
            {status === 'DELETED'
              ? 'Solicitação excluída'
              : 'Solicitação cancelada'}
          </p>
          <p className={cn('text-muted-foreground text-sm', breakableTextClass)}>
            Esta solicitação foi encerrada e não seguirá no fluxo.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'COMPLETED') {
    return (
      <div className='flex items-center justify-center gap-2 py-1'>
        <span className='flex size-8 items-center justify-center rounded-full bg-emerald-600 text-white'>
          <Check className='size-4' aria-hidden />
        </span>
        <p className='text-sm font-medium text-emerald-700'>Concluído</p>
      </div>
    );
  }

  const currentIndex = FLOW_ORDER[status];

  return (
    <ol className='flex w-full min-w-0 max-w-full'>
      {FLOW_STEPS.map((step, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        const pending = index > currentIndex;
        const isFirst = index === 0;
        const isLast = index === FLOW_STEPS.length - 1;

        return (
          <li
            key={step.status}
            className='flex min-w-0 flex-1 flex-col items-center'
          >
            <div className='flex w-full items-center'>
              <span
                className={cn(
                  'h-0.5 flex-1',
                  isFirst
                    ? 'invisible'
                    : done || current
                      ? 'bg-emerald-600'
                      : 'bg-border',
                )}
                aria-hidden
              />
              <span className='relative flex size-7 shrink-0 items-center justify-center'>
                {current && (
                  <span
                    className='absolute inset-0 animate-[ping_3s_ease-in-out_infinite] rounded-full bg-primary/15'
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    'relative flex size-7 items-center justify-center rounded-full border',
                    done && 'border-emerald-600 bg-emerald-600 text-white',
                    current &&
                      'border-primary bg-primary text-primary-foreground',
                    pending &&
                      'border-muted-foreground/30 bg-background text-muted-foreground',
                  )}
                  aria-current={current ? 'step' : undefined}
                >
                  {done ? (
                    <Check className='size-3.5' aria-hidden />
                  ) : (
                    <Circle
                      className={cn('size-3', current && 'fill-current')}
                      aria-hidden
                    />
                  )}
                </span>
              </span>
              <span
                className={cn(
                  'h-0.5 flex-1',
                  isLast ? 'invisible' : done ? 'bg-emerald-600' : 'bg-border',
                )}
                aria-hidden
              />
            </div>
            <div className='mt-2 w-full min-w-0 px-0.5 text-center'>
              <p
                className={cn(
                  'text-[10px] font-medium leading-tight sm:text-xs',
                  breakableTextClass,
                  pending && 'text-muted-foreground',
                )}
              >
                {step.label}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className='min-w-0 max-w-full overflow-hidden'>
      <p className='text-muted-foreground text-xs uppercase tracking-wide'>
        {label}
      </p>
      <p
        className={cn('mt-0.5 text-sm', breakableTextClass)}
        style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}
        title={value}
      >
        <SoftBreakText text={value} />
      </p>
    </div>
  );
}
