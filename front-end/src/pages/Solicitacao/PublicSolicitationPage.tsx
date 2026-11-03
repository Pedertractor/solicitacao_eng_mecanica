import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, BrushCleaning, Check, CircleCheck, Copy, Loader2 } from 'lucide-react';
import { SendIcon, type SendIconHandle } from 'lucide-animated';
import { motion, useAnimation } from 'motion/react';
import {
  ProcessInstructionFormSection,
} from '@/components/ProcessInstructionFormSection';
import {
  emptyProcessInstructionDraft,
  type ProcessInstructionDraft,
} from '@/config/process-instruction-draft';
import {
  shouldShowDeliveryDate,
  validateProcessInstructionFields,
  type ProcessInstructionFieldErrors,
} from '@/config/process-instruction';
import {
  solicitationApi,
  type Solicitation,
  type SolicitationClient,
} from '@/services/solicitation';
import { type Unit } from '@/types/auth';
import { changeSolicitationDestination } from '@/config/solicitation-routing';
import {
  cardNumberForApi,
} from '@/utils/card-number-input';
import { solicitationTrackPath } from '@/routes/constants';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { copyToClipboard } from '@/lib/clipboard';
import { cn } from '@/lib/utils';
import type { AnimatedIconHandle } from '@/config/sidebar';
import { SolicitationRoutingStep } from '@/components/SolicitationRoutingStep';
import { SolicitationWorkflowPreview } from '@/components/SolicitationWorkflowPreview';
import { SOLICITATION_DESTINATIONS, validateSolicitationRouting, type SolicitationDestination, type SolicitationRoutingErrors } from '@/config/solicitation-routing';
import './solicitation-create.css';
import {
  PublicSolicitationShell,
  publicSolicitationCardClass,
  publicSolicitationTicketCardClass,
} from '@/pages/Solicitacao/PublicSolicitationShell';

const FORM_ICON_SIZE = 16;

const AnimatedBrushCleaning = forwardRef<
  AnimatedIconHandle,
  { size?: number; className?: string }
>(function AnimatedBrushCleaning({ size = FORM_ICON_SIZE, className }, ref) {
  const controls = useAnimation();

  useImperativeHandle(ref, () => ({
    startAnimation: () => {
      void controls.start({
        rotate: [0, -18, 18, -10, 0],
        x: [0, 3, -3, 0],
        transition: { duration: 0.55, ease: 'easeInOut' },
      });
    },
    stopAnimation: () => {
      controls.stop();
      void controls.start({ rotate: 0, x: 0, transition: { duration: 0.15 } });
    },
  }));

  return (
    <motion.span animate={controls} className='inline-flex shrink-0'>
      <BrushCleaning size={size} className={className} aria-hidden />
    </motion.span>
  );
});
const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: 'PEDERTRACTOR', label: 'P' },
  { value: 'TRACTOR', label: 'T' },
];

const CARD_NUMBER_LENGTH = 4;

function isCompleteCardNumber(value: string) {
  return value.length === CARD_NUMBER_LENGTH && /^\d+$/.test(value);
}

type FieldErrors = {
  cardNumber?: string;
  requesterEmail?: string;
  costCenter?: string;
  pillarOrLocation?: string;
  title?: string;
  description?: string;
};

function trackAbsoluteUrl(trackingCode: string) {
  return `${window.location.origin}${solicitationTrackPath(trackingCode)}`;
}

async function copyText(value: string) {
  await copyToClipboard(value);
  toast.success('Copiado.');
}

export function PublicSolicitationPage() {
  const [department, setDepartment] =
    useState<SolicitationDestination | ''>('');
  const [step, setStep] = useState<1 | 2>(1);
  const [routingErrors, setRoutingErrors] = useState<SolicitationRoutingErrors>({});
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const fieldsScrollRef = useRef<HTMLDivElement>(null);
  const previousStepRef = useRef(step);
  const [cardNumber, setCardNumber] = useState('');
  const [unit, setUnit] = useState<Unit>('PEDERTRACTOR');
  const [requesterName, setRequesterName] = useState<string | null>(null);
  const [requesterEmail, setRequesterEmail] = useState('');
  const [requesterError, setRequesterError] = useState<string | null>(null);
  const [requesterLoading, setRequesterLoading] = useState(false);

  const [costCenter, setCostCenter] = useState('');
  const [sectorName, setSectorName] = useState<string | null>(null);
  const [sectorError, setSectorError] = useState<string | null>(null);
  const [sectorLoading, setSectorLoading] = useState(false);

  const [pillarOrLocation, setPillarOrLocation] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [processDraft, setProcessDraft] = useState<ProcessInstructionDraft>(
    emptyProcessInstructionDraft,
  );
  const [processErrors, setProcessErrors] =
    useState<ProcessInstructionFieldErrors>({});
  const [submittedSolicitation, setSubmittedSolicitation] =
    useState<Solicitation | null>(null);
  const [trackLinkCopied, setTrackLinkCopied] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const sectorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearIconRef = useRef<AnimatedIconHandle>(null);
  const sendIconRef = useRef<SendIconHandle>(null);
  const route = { destination: department, requester: processDraft.requester, type: processDraft.type,
    requiresTooling: processDraft.requiresTooling, directTooling: processDraft.directTooling };

  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    if (stepHeadingRef.current) {
      stepHeadingRef.current.focus({ preventScroll: true });
      if (fieldsScrollRef.current) fieldsScrollRef.current.scrollTop = 0;
    }
  }, [step]);

  const continueToDetails = () => {
    const errors = validateSolicitationRouting(route);
    setRoutingErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setStep(2);
  };
  const validateRequester = useCallback(async () => {
    if (!isCompleteCardNumber(cardNumber)) {
      setRequesterName(null);
      setRequesterEmail('');
      setRequesterError(null);
      return false;
    }

    const card = cardNumberForApi(cardNumber);
    if (!card) {
      setRequesterName(null);
      setRequesterEmail('');
      setRequesterError(null);
      return false;
    }

    setRequesterLoading(true);
    setRequesterError(null);
    setRequesterName(null);
    setRequesterEmail('');
    try {
      const result = await solicitationApi.validateRequester(card, unit);
      setRequesterName(result.name);
      setRequesterEmail(result.email?.trim() ?? '');
      return true;
    } catch {
      setRequesterName(null);
      setRequesterEmail('');
      setRequesterError('Colaborador não encontrado ou inativo.');
      return false;
    } finally {
      setRequesterLoading(false);
    }
  }, [cardNumber, unit]);

  const validateRequesterRef = useRef(validateRequester);

  useEffect(() => {
    validateRequesterRef.current = validateRequester;
  }, [validateRequester]);

  useEffect(() => {
    if (!isCompleteCardNumber(cardNumber)) return;
    void validateRequesterRef.current();
  }, [cardNumber, unit]);

  const lookupSector = useCallback(async () => {
    const cc = costCenter.trim();
    if (!/^\d{4}$/.test(cc)) {
      setSectorName(null);
      setSectorError(null);
      return;
    }
    setSectorLoading(true);
    setSectorError(null);
    setSectorName(null);
    try {
      const sector = await solicitationApi.getSectorByCostCenter(cc);
      setSectorName(sector.name);
    } catch {
      setSectorName(null);
      setSectorError('Centro de custo não encontrado.');
    } finally {
      setSectorLoading(false);
    }
  }, [costCenter]);

  useEffect(() => {
    if (sectorTimeoutRef.current) clearTimeout(sectorTimeoutRef.current);
    const delay = /^\d{4}$/.test(costCenter.trim()) ? 500 : 0;
    sectorTimeoutRef.current = setTimeout(lookupSector, delay);
    return () => {
      if (sectorTimeoutRef.current) clearTimeout(sectorTimeoutRef.current);
    };
  }, [costCenter, lookupSector]);

  const createMutation = useMutation({
    mutationFn: () => {
      const shared = {
        cardNumber: cardNumberForApi(cardNumber),
        unit,
        costCenter: costCenter.trim(),
        pillarOrLocation: pillarOrLocation.trim(),
        requesterEmail: requesterEmail.trim(),
      };

      if (department === 'FERRAMENTARIA') {
        return solicitationApi.create({
          ...shared, department, processInstructionRequester: 'Comercial',
          processInstructionType: 'Simulação Comercial',
          executionUnit: processDraft.executionUnit as Unit,
          client: processDraft.client as SolicitationClient,
          partNumbers: processDraft.allocatedPartNumbers.join(', '),
          fileLink: processDraft.fileLink.trim(), comments: processDraft.comments.trim(),
        });
      }
      if (department === 'DESENVOLVIMENTO_PROCESSOS') {
        return solicitationApi.create({
          ...shared,
          department,
          processInstructionRequester: processDraft.requester,
          processInstructionProcess: processDraft.process,
          processInstructionType: processDraft.type,
          client: processDraft.client as SolicitationClient,
          ...(shouldShowDeliveryDate(
            processDraft.requester,
            processDraft.process,
            processDraft.type,
          )
            ? { deliveryDate: processDraft.deliveryDate }
            : {}),
          ...(processDraft.allocatedPartNumbers.length > 0
            ? { partNumbers: processDraft.allocatedPartNumbers.join(', ') }
            : {}),
          ...(processDraft.fileLink.trim()
            ? { fileLink: processDraft.fileLink.trim() }
            : {}),
          ...(processDraft.comments.trim()
            ? { comments: processDraft.comments.trim() }
            : {}),
          ...(processDraft.requester === 'Comercial'
            ? {
                requiresTooling: processDraft.requiresTooling,
                executionUnit: processDraft.executionUnit as Unit,
                directTooling: processDraft.directTooling,
              }
            : {}),
        });
      }

      return solicitationApi.create({
        ...shared,
        department: 'ENG_MECANICA',
        processInstructionRequester: processDraft.requester,
        title: title.trim(),
        description: description.trim(),
      });
    },
    onSuccess: (solicitation) => {
      setSubmittedSolicitation(solicitation);
      toast.success('Solicitação enviada com sucesso.');
    },
  });

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const resetFormFields = () => {
    setDepartment('');
    setStep(1);
    setRoutingErrors({});
    setCardNumber('');
    setUnit('PEDERTRACTOR');
    setRequesterName(null);
    setRequesterEmail('');
    setRequesterError(null);
    setRequesterLoading(false);
    setCostCenter('');
    setSectorName(null);
    setSectorError(null);
    setSectorLoading(false);
    setPillarOrLocation('');
    setTitle('');
    setDescription('');
    setProcessDraft(emptyProcessInstructionDraft());
    setProcessErrors({});
    setFieldErrors({});
  };

  const handleClearForm = () => {
    resetFormFields();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      continueToDetails();
      return;
    }
    const routeErrors = validateSolicitationRouting(route);
    if (Object.keys(routeErrors).length > 0) {
      setRoutingErrors(routeErrors);
      setStep(1);
      return;
    }

    let requesterValidated = Boolean(requesterName);
    if (
      isCompleteCardNumber(cardNumber) &&
      !requesterValidated &&
      !requesterLoading
    ) {
      requesterValidated = await validateRequester();
    }

    const errors: FieldErrors = {};

    if (!requesterValidated) {
      if (!isCompleteCardNumber(cardNumber) || !cardNumberForApi(cardNumber)) {
        errors.cardNumber = 'Informe o número do cartão.';
      } else if (requesterLoading) {
        errors.cardNumber = 'Aguarde a validação do cartão.';
      } else {
        errors.cardNumber =
          requesterError ?? 'Colaborador não encontrado ou inativo.';
      }
    }

    const emailTrimmed = requesterEmail.trim();
    if (!emailTrimmed) {
      errors.requesterEmail = 'Informe o e-mail.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      errors.requesterEmail = 'E-mail inválido.';
    }

    if (!sectorName) {
      if (!costCenter.trim()) {
        errors.costCenter = 'Informe o centro de custo.';
      } else if (!/^\d{4}$/.test(costCenter.trim())) {
        errors.costCenter = 'Centro de custo deve ter 4 dígitos.';
      } else if (sectorLoading) {
        errors.costCenter = 'Aguarde a busca do setor.';
      } else {
        errors.costCenter = sectorError ?? 'Centro de custo não encontrado.';
      }
    }

    if (!pillarOrLocation.trim()) {
      errors.pillarOrLocation = 'Campo obrigatório.';
    }

    const nextProcessErrors =
      department === 'DESENVOLVIMENTO_PROCESSOS' || department === 'FERRAMENTARIA'
        ? validateProcessInstructionFields({
            directCommercialTooling: department === 'FERRAMENTARIA',
            executionUnit: processDraft.executionUnit,
            requester: processDraft.requester,
            process: processDraft.process,
            type: processDraft.type,
            deliveryDate: processDraft.deliveryDate,
            client: processDraft.client,
            fileLink: processDraft.fileLink,
          })
        : {};

    if (department === 'ENG_MECANICA') {
      if (!title.trim()) {
        errors.title = 'Campo obrigatório.';
      }
      if (!description.trim()) {
        errors.description = 'Campo obrigatório.';
      }
    }

    if (
      Object.keys(errors).length > 0 ||
      Object.keys(nextProcessErrors).length > 0
    ) {
      setProcessErrors(nextProcessErrors);
      setFieldErrors(errors);
      if (fieldsScrollRef.current) fieldsScrollRef.current.scrollTop = 0;
      return;
    }

    setFieldErrors({});
    setProcessErrors({});
    createMutation.mutate();
  };

  if (submittedSolicitation) {
    const trackPath = solicitationTrackPath(submittedSolicitation.trackingCode);
    const trackUrl = trackAbsoluteUrl(submittedSolicitation.trackingCode);

    return (
      <PublicSolicitationShell contentClassName='justify-center'>
        <Card className={cn('w-full', publicSolicitationTicketCardClass)}>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              Solicitação enviada
              <CircleCheck
                className='size-5 shrink-0 text-green-600'
                aria-hidden
              />
            </CardTitle>
            <CardDescription>
              Sua solicitação foi registrada e será analisada pela equipe de{' '}
              {submittedSolicitation.department === 'DESENVOLVIMENTO_PROCESSOS'
                ? 'desenvolvimento de processos'
                : submittedSolicitation.department === 'FERRAMENTARIA' ? 'ferramentaria'
                : 'engenharia mecânica'}
              . Guarde o protocolo para acompanhar o andamento.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='rounded-md border bg-muted/30 px-4 py-3'>
              <p className='text-muted-foreground text-xs uppercase tracking-wide'>
                Protocolo
              </p>
              <p className='mt-1 font-mono text-lg font-semibold tracking-wide'>
                {submittedSolicitation.trackingCode}
              </p>
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='trackLink'>Link de acompanhamento</Label>
              <div className='flex gap-2'>
                <Input
                  id='trackLink'
                  readOnly
                  value={trackUrl}
                  className='font-mono text-xs'
                />
                <Button
                  type='button'
                  variant='outline'
                  size='icon-sm'
                  className='shrink-0'
                  aria-label={trackLinkCopied ? 'Link copiado' : 'Copiar link'}
                  onClick={() => {
                    void (async () => {
                      try {
                        await copyText(trackUrl);
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
                    <CircleCheck className='size-4 text-green-600' />
                  ) : (
                    <Copy className='size-4' />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className='flex flex-wrap gap-2'>
            <Button asChild className='flex-1'>
              <Link to={trackPath}>Acompanhar solicitação</Link>
            </Button>
            <Button
              type='button'
              variant='outline'
              className='flex-1'
              onClick={() => {
                setSubmittedSolicitation(null);
                setTrackLinkCopied(false);
                resetFormFields();
              }}
            >
              Nova solicitação
            </Button>
          </CardFooter>
        </Card>
      </PublicSolicitationShell>
    );
  }

  return (
    <PublicSolicitationShell wide className='solicitation-create-shell' contentClassName='solicitation-create-content'>
      <div className='solicitation-create-intro'>
        <p>NOVA SOLICITAÇÃO</p>
        <h1>Um bom começo faz o fluxo acontecer.</h1>
        <span>Defina o caminho. Conte o que precisa. Acompanhe cada etapa.</span>
      </div>
      <div className='solicitation-create-layout'>
      <Card
        className={cn(
          'solicitation-create-card w-full gap-0 py-0',
          publicSolicitationCardClass,
        )}
      >
        <div className='solicitation-create-card-heading'>
          <ol className='solicitation-stepper' aria-label='Etapas da solicitação'>
            <li aria-current={step === 1 ? 'step' : undefined} data-complete={step === 2}>
              <button type='button' onClick={() => setStep(1)} disabled={createMutation.isPending}><span>{step === 2 ? <Check size={13} aria-hidden /> : '1'}</span>Definir o caminho</button>
            </li>
            <li className='solicitation-stepper-line' aria-hidden />
            <li aria-current={step === 2 ? 'step' : undefined}>
              <button type='button' disabled={step === 1 || createMutation.isPending}><span>2</span>Detalhar o chamado</button>
            </li>
          </ol>
          <div className='solicitation-step-title'>
            <p>ETAPA {step} DE 2</p>
            <h2 ref={stepHeadingRef} tabIndex={-1}>{step === 1 ? 'Por onde vamos começar?' : 'Conte o que você precisa.'}</h2>
            <span>{step === 1 ? 'Escolha a origem e o destino. O fluxo se desenha ao lado.' : 'O caminho está definido. Agora, preencha os dados da solicitação.'}</span>
          </div>
        </div>
        <form
          onSubmit={handleSubmit}
          noValidate
        >
          <CardContent ref={fieldsScrollRef} className='solicitation-create-fields space-y-5'>
            {step === 1 ? (
              <SolicitationRoutingStep destination={department} value={processDraft} errors={routingErrors}
                onDestinationChange={(destination) => {
                  if (destination === department) return;
                  setDepartment(destination);
                  setRoutingErrors((prev) => ({ ...prev, destination: undefined }));
                  setProcessErrors({});
                  setProcessDraft((prev) => changeSolicitationDestination(prev, department, destination));
                }}
                onChange={(draft) => {
                  setProcessDraft(draft);
                  setProcessErrors({});
                  setRoutingErrors((prev) => ({ ...prev, requester: undefined }));
                }} />
            ) : <>
            <div className='solicitation-route-summary'>
              <span><small>CAMINHO DEFINIDO</small><strong>{processDraft.requester} <ArrowRight size={13} aria-hidden /> {SOLICITATION_DESTINATIONS.find((item) => item.value === department)?.label}</strong></span>
              <button type='button' onClick={() => setStep(1)} disabled={createMutation.isPending}>Alterar</button>
            </div>
            <h3 className='solicitation-details-section-title'>Seus dados</h3>
            <div className='grid gap-2'>
              <div className='flex items-start gap-3'>
                <div className='grid min-w-0 flex-1 gap-2'>
                  <Label htmlFor='cardNumber'>Cartão</Label>
                  <Input
                    id='cardNumber'
                    inputMode='numeric'
                    maxLength={CARD_NUMBER_LENGTH}
                    value={cardNumber}
                    onChange={(e) => {
                      clearFieldError('cardNumber');
                      setRequesterName(null);
                      setRequesterEmail('');
                      setRequesterError(null);
                      setCardNumber(
                        e.target.value.replace(/\D/g, '').slice(0, CARD_NUMBER_LENGTH),
                      );
                    }}
                    placeholder='0000'
                    disabled={requesterLoading}
                    aria-invalid={!!fieldErrors.cardNumber}
                  />
                </div>
                <div className='grid gap-2'>
                  <Label>Unidade</Label>
                  <div className='flex gap-1'>
                    {UNIT_OPTIONS.map(({ value, label }) => (
                      <Button
                        key={value}
                        type='button'
                        variant={unit === value ? 'default' : 'outline'}
                        size='icon'
                        className='size-8 font-semibold'
                        aria-pressed={unit === value}
                        aria-label={value}
                        disabled={requesterLoading}
                        onClick={() => {
                          setRequesterName(null);
                          setRequesterEmail('');
                          setRequesterError(null);
                          setUnit(value);
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              {fieldErrors.cardNumber && (
                <p className='text-sm text-destructive'>
                  {fieldErrors.cardNumber}
                </p>
              )}
              {requesterError && !fieldErrors.cardNumber && (
                <p className='text-sm text-destructive'>{requesterError}</p>
              )}
              <div className='grid gap-2'>
                <Label htmlFor='requesterName'>Nome</Label>
                <div className='relative'>
                  <Input
                    id='requesterName'
                    value={requesterName ?? ''}
                    disabled
                    readOnly
                    placeholder='—'
                    aria-label='Nome do colaborador'
                    aria-busy={requesterLoading}
                    className={cn(
                      (requesterLoading || requesterName) && 'pr-9',
                    )}
                  />
                  {requesterLoading && (
                    <Loader2
                      className='pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground'
                      aria-hidden
                    />
                  )}
                  {requesterName && !requesterLoading && (
                    <Check
                      className='pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-green-600'
                      aria-hidden
                    />
                  )}
                </div>
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='requesterEmail'>E-mail</Label>
                <Input
                  id='requesterEmail'
                  type='email'
                  autoComplete='email'
                  value={requesterEmail}
                  onChange={(e) => {
                    clearFieldError('requesterEmail');
                    setRequesterEmail(e.target.value);
                  }}
                  placeholder='seu.email@empresa.com'
                  disabled={requesterLoading || !requesterName}
                  aria-invalid={!!fieldErrors.requesterEmail}
                />
                {fieldErrors.requesterEmail && (
                  <p className='text-sm text-destructive'>
                    {fieldErrors.requesterEmail}
                  </p>
                )}
              </div>
            </div>

            <Separator className='bg-border/60' />

            <div className='grid gap-2'>
              <div className='flex items-start gap-3'>
                <div className='grid min-w-0 flex-1 gap-2'>
                  <Label htmlFor='costCenter'>Centro de custo</Label>
                  <Input
                    id='costCenter'
                    inputMode='numeric'
                    maxLength={4}
                    value={costCenter}
                    onChange={(e) => {
                      clearFieldError('costCenter');
                      setCostCenter(
                        e.target.value.replace(/\D/g, '').slice(0, 4),
                      );
                    }}
                    placeholder='0000'
                    disabled={sectorLoading}
                    aria-invalid={!!fieldErrors.costCenter}
                  />
                </div>
                <div className='grid min-w-0 flex-1 gap-2'>
                  <Label htmlFor='sectorName'>Setor</Label>
                  <div className='relative'>
                    <Input
                      id='sectorName'
                      value={sectorName ?? ''}
                      disabled
                      readOnly
                      placeholder='—'
                      aria-label='Nome do setor'
                      aria-busy={sectorLoading}
                      className={cn((sectorLoading || sectorName) && 'pr-9')}
                    />
                    {sectorLoading && (
                      <Loader2
                        className='pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground'
                        aria-hidden
                      />
                    )}
                    {sectorName && !sectorLoading && (
                      <Check
                        className='pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-green-600'
                        aria-hidden
                      />
                    )}
                  </div>
                </div>
              </div>
              {fieldErrors.costCenter && (
                <p className='text-sm text-destructive'>
                  {fieldErrors.costCenter}
                </p>
              )}
              {sectorError && !fieldErrors.costCenter && (
                <p className='text-sm text-destructive'>{sectorError}</p>
              )}
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='pillarOrLocation'>Pilar / local</Label>
              <Input
                id='pillarOrLocation'
                value={pillarOrLocation}
                onChange={(e) => {
                  clearFieldError('pillarOrLocation');
                  setPillarOrLocation(e.target.value);
                }}
                aria-invalid={!!fieldErrors.pillarOrLocation}
              />
              {fieldErrors.pillarOrLocation && (
                <p className='text-sm text-destructive'>
                  {fieldErrors.pillarOrLocation}
                </p>
              )}
            </div>

            <Separator className='bg-border/60' />
            <h3 className='solicitation-details-section-title'>Detalhes da solicitação</h3>

            {department === 'DESENVOLVIMENTO_PROCESSOS' || department === 'FERRAMENTARIA' ? (
              <ProcessInstructionFormSection
                directCommercialTooling={department === 'FERRAMENTARIA'}
                showRouting={false}
                value={processDraft}
                errors={processErrors}
                onChange={setProcessDraft}
                onClearError={(field) => {
                  setProcessErrors((prev) => {
                    if (!prev[field]) return prev;
                    const next = { ...prev };
                    delete next[field];
                    return next;
                  });
                }}
              />
            ) : (
              <>
                <div className='grid gap-2'>
                  <Label htmlFor='title'>Título</Label>
                  <Input
                    id='title'
                    value={title}
                    onChange={(e) => {
                      clearFieldError('title');
                      setTitle(e.target.value);
                    }}
                    aria-invalid={!!fieldErrors.title}
                  />
                  {fieldErrors.title && (
                    <p className='text-sm text-destructive'>
                      {fieldErrors.title}
                    </p>
                  )}
                </div>

                <div className='grid gap-2'>
                  <Label htmlFor='description'>Descrição</Label>
                  <textarea
                    id='description'
                    className={cn(
                      'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-28 w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                      fieldErrors.description &&
                        'border-destructive aria-invalid:border-destructive',
                    )}
                    value={description}
                    onChange={(e) => {
                      clearFieldError('description');
                      setDescription(e.target.value);
                    }}
                    aria-invalid={!!fieldErrors.description}
                  />
                  {fieldErrors.description && (
                    <p className='text-sm text-destructive'>
                      {fieldErrors.description}
                    </p>
                  )}
                </div>
              </>
            )}

            </>}
          </CardContent>
          <div className='solicitation-create-actions'>
            {step === 2 && <Button type='button' variant='ghost' onClick={() => setStep(1)} disabled={createMutation.isPending}><ArrowLeft size={16} aria-hidden /> Voltar</Button>}
              <Button
                type='button'
                variant='outline'
                className='solicitation-clear-action'
                disabled={
                  createMutation.isPending || requesterLoading || sectorLoading
                }
                onMouseEnter={() => clearIconRef.current?.startAnimation()}
                onMouseLeave={() => clearIconRef.current?.stopAnimation()}
                onClick={handleClearForm}
              >
                <AnimatedBrushCleaning ref={clearIconRef} />
                Limpar
              </Button>
              <Button
                type='submit'
                className='solicitation-continue-action'
                disabled={
                  createMutation.isPending || requesterLoading || sectorLoading
                }
                onMouseEnter={() => sendIconRef.current?.startAnimation()}
                onMouseLeave={() => sendIconRef.current?.stopAnimation()}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className='size-4 animate-spin' /> Enviando…
                  </>
                ) : step === 1 ? <>Continuar <ArrowRight size={16} aria-hidden /></> : (
                  <>
                    <SendIcon
                      ref={sendIconRef}
                      size={FORM_ICON_SIZE}
                      animateOnHover={false}
                    />
                    Enviar solicitação
                  </>
                )}
              </Button>
          </div>
        </form>
      </Card>
      <SolicitationWorkflowPreview route={route} />
      </div>
    </PublicSolicitationShell>
  );
}
