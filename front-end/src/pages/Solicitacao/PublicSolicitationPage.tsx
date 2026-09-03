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
import { BrushCleaning, Check, CircleCheck, Copy, Loader2 } from 'lucide-react';
import { SendIcon, type SendIconHandle } from 'lucide-animated';
import { motion, useAnimation } from 'motion/react';
import {
  solicitationApi,
  type Solicitation,
} from '@/services/solicitation';
import { type Unit } from '@/types/auth';
import {
  cardNumberForApi,
  displayCardNumber,
  parseCardNumberInput,
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
import { cn } from '@/lib/utils';
import type { AnimatedIconHandle } from '@/config/sidebar';
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

type FieldErrors = {
  cardNumber?: string;
  costCenter?: string;
  pillarOrLocation?: string;
  title?: string;
  description?: string;
};

function trackAbsoluteUrl(trackingCode: string) {
  return `${window.location.origin}${solicitationTrackPath(trackingCode)}`;
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
  toast.success('Copiado.');
}

export function PublicSolicitationPage() {
  const [cardNumber, setCardNumber] = useState('');
  const [unit, setUnit] = useState<Unit>('PEDERTRACTOR');
  const [requesterName, setRequesterName] = useState<string | null>(null);
  const [requesterError, setRequesterError] = useState<string | null>(null);
  const [requesterLoading, setRequesterLoading] = useState(false);

  const [costCenter, setCostCenter] = useState('');
  const [sectorName, setSectorName] = useState<string | null>(null);
  const [sectorError, setSectorError] = useState<string | null>(null);
  const [sectorLoading, setSectorLoading] = useState(false);

  const [pillarOrLocation, setPillarOrLocation] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submittedSolicitation, setSubmittedSolicitation] =
    useState<Solicitation | null>(null);
  const [trackLinkCopied, setTrackLinkCopied] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const cardDigitCountRef = useRef(0);
  const sectorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearIconRef = useRef<AnimatedIconHandle>(null);
  const sendIconRef = useRef<SendIconHandle>(null);
  const validateRequester = useCallback(async () => {
    if (cardDigitCountRef.current !== 4) {
      setRequesterName(null);
      setRequesterError(null);
      return false;
    }

    const card = cardNumberForApi(cardNumber);
    if (!card) {
      setRequesterName(null);
      setRequesterError(null);
      return false;
    }

    setRequesterLoading(true);
    setRequesterError(null);
    setRequesterName(null);
    try {
      const result = await solicitationApi.validateRequester(card, unit);
      setRequesterName(result.name);
      return true;
    } catch {
      setRequesterName(null);
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
    if (cardDigitCountRef.current !== 4) return;
    void validateRequesterRef.current();
  }, [unit]);

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
    mutationFn: () =>
      solicitationApi.create({
        cardNumber: cardNumberForApi(cardNumber),
        unit,
        costCenter: costCenter.trim(),
        pillarOrLocation: pillarOrLocation.trim(),
        title: title.trim(),
        description: description.trim(),
      }),
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
    cardDigitCountRef.current = 0;
    setCardNumber('');
    setUnit('PEDERTRACTOR');
    setRequesterName(null);
    setRequesterError(null);
    setRequesterLoading(false);
    setCostCenter('');
    setSectorName(null);
    setSectorError(null);
    setSectorLoading(false);
    setPillarOrLocation('');
    setTitle('');
    setDescription('');
    setFieldErrors({});
  };

  const handleClearForm = () => {
    resetFormFields();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let requesterValidated = Boolean(requesterName);
    if (
      cardDigitCountRef.current === 4 &&
      !requesterValidated &&
      !requesterLoading
    ) {
      requesterValidated = await validateRequester();
    }

    const errors: FieldErrors = {};

    if (!requesterValidated) {
      if (cardDigitCountRef.current !== 4 || !cardNumberForApi(cardNumber)) {
        errors.cardNumber = 'Informe o número do cartão.';
      } else if (requesterLoading) {
        errors.cardNumber = 'Aguarde a validação do cartão.';
      } else {
        errors.cardNumber =
          requesterError ?? 'Colaborador não encontrado ou inativo.';
      }
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
    if (!title.trim()) {
      errors.title = 'Campo obrigatório.';
    }
    if (!description.trim()) {
      errors.description = 'Campo obrigatório.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
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
              Sua solicitação foi registrada e será analisada pela engenharia
              mecânica. Guarde o protocolo para acompanhar o andamento.
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
                    void copyText(trackUrl).then(() => {
                      setTrackLinkCopied(true);
                      window.setTimeout(() => setTrackLinkCopied(false), 2000);
                    });
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
    <PublicSolicitationShell contentClassName='justify-center'>
      <Card
        className={cn(
          'flex h-[min(720px,calc(100svh-2rem))] w-full flex-col gap-0 overflow-hidden py-0',
          publicSolicitationCardClass,
        )}
      >
        <CardHeader className='shrink-0 border-b py-6'>
          <CardTitle>Solicitação de projetos - Engenharia Mecânica</CardTitle>
          <CardDescription>
            Página para fazer solicitações para equipe de engenharia mecânica
          </CardDescription>
        </CardHeader>
        <form
          onSubmit={handleSubmit}
          className='flex min-h-0 flex-1 flex-col overflow-hidden'
        >
          <CardContent className='min-h-0 flex-1 space-y-4 overflow-y-auto py-6'>
            <div className='grid gap-2'>
              <div className='flex items-start gap-3'>
                <div className='grid min-w-0 flex-1 gap-2'>
                  <Label htmlFor='cardNumber'>Cartão</Label>
                  <Input
                    id='cardNumber'
                    inputMode='numeric'
                    value={displayCardNumber(cardNumber)}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(-4);
                      cardDigitCountRef.current = digits.length;
                      clearFieldError('cardNumber');
                      setRequesterName(null);
                      setRequesterError(null);
                      setCardNumber(parseCardNumberInput(e.target.value));
                    }}
                    onBlur={() => {
                      if (cardDigitCountRef.current === 4) {
                        void validateRequester();
                      }
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
                        onClick={() => setUnit(value)}
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
                <p className='text-sm text-destructive'>{fieldErrors.title}</p>
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

            <div className='flex flex-col gap-2 sm:flex-row'>
              <Button
                type='button'
                variant='outline'
                className='flex-1'
                disabled={
                  createMutation.isPending || requesterLoading || sectorLoading
                }
                onMouseEnter={() => clearIconRef.current?.startAnimation()}
                onMouseLeave={() => clearIconRef.current?.stopAnimation()}
                onClick={handleClearForm}
              >
                <AnimatedBrushCleaning ref={clearIconRef} />
                Limpar formulário
              </Button>
              <Button
                type='submit'
                className='flex-1'
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
                ) : (
                  <>
                    <SendIcon
                      ref={sendIconRef}
                      size={FORM_ICON_SIZE}
                      animateOnHover={false}
                    />
                    Enviar solicitações
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </PublicSolicitationShell>
  );
}
