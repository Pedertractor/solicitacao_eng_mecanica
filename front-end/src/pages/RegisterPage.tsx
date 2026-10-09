import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Loader2 } from 'lucide-react';
import { PlatformPageShell } from '@/components/platform-backdrop';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { userApi } from '@/services/user';
import { ROUTES } from '@/routes/constants';
import {
  UNIT,
  USER_DEPARTMENTS,
  type Unit,
  type UserDepartment,
} from '@/types/auth';
import { DEPARTMENT_LABELS } from '@/utils/roles';
import {
  cardNumberForApi,
  displayCardNumber,
  parseCardNumberInput,
} from '@/utils/card-number-input';
import { publicSolicitationCardClass } from '@/pages/Solicitacao/PublicSolicitationShell';

export function RegisterPage() {
  const navigate = useNavigate();
  const [cardNumber, setCardNumber] = useState('');
  const [unit, setUnit] = useState<Unit>('PEDERTRACTOR');
  const [department, setDepartment] = useState<UserDepartment>('ENG_MECANICA');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [validateLoading, setValidateLoading] = useState(false);
  const validateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validateEmployee = useCallback(async () => {
    const card = cardNumberForApi(cardNumber);
    if (!card) {
      setEmployeeName(null);
      setValidateError(null);
      return;
    }
    setValidateLoading(true);
    setValidateError(null);
    try {
      const result = await userApi.validateSignup(card, unit);
      setEmployeeName(result.name);
    } catch {
      setEmployeeName(null);
      setValidateError('Colaborador não encontrado ou já cadastrado.');
    } finally {
      setValidateLoading(false);
    }
  }, [cardNumber, unit]);

  useEffect(() => {
    if (validateTimeoutRef.current) clearTimeout(validateTimeoutRef.current);
    const delay = cardNumber.trim() ? 500 : 0;
    validateTimeoutRef.current = setTimeout(validateEmployee, delay);
    return () => {
      if (validateTimeoutRef.current) clearTimeout(validateTimeoutRef.current);
    };
  }, [cardNumber, unit, validateEmployee]);

  const signupMutation = useMutation({
    mutationFn: () =>
      userApi.signup({
        cardNumber: cardNumberForApi(cardNumber),
        unit,
        password,
        confirmPassword,
        department,
      }),
    onSuccess: () => {
      toast.success(
        'Cadastro enviado. Aguarde a aprovação do administrador da área.',
      );
      navigate(ROUTES.LOGIN);
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!employeeName) {
      toast.error('Informe cartão e unidade e aguarde a validação.');
      return;
    }
    if (password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }
    signupMutation.mutate();
  }

  return (
    <PlatformPageShell
      className='min-h-svh items-center justify-center overflow-y-auto p-6 md:p-10'
      contentClassName='w-full max-w-lg flex-col items-center justify-center gap-6'
    >
      <Card className={publicSolicitationCardClass}>
        <CardHeader>
          <CardTitle>Cadastrar</CardTitle>
          <CardDescription>
            Valide seu cartão, defina a senha e escolha a área. O administrador
            dessa área precisa aprovar o acesso.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='signup-card'>Nº de cartão</Label>
                <Input
                  id='signup-card'
                  inputMode='numeric'
                  autoComplete='username'
                  value={displayCardNumber(cardNumber)}
                  onChange={(e) =>
                    setCardNumber(parseCardNumberInput(e.target.value))
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='signup-unit'>Unidade</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                  <SelectTrigger id='signup-unit' className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='signup-name'>Nome do colaborador</Label>
              <Input
                id='signup-name'
                readOnly
                value={employeeName ?? ''}
                placeholder='Aguardando cartão e unidade...'
                className='bg-muted'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='signup-department'>Acesso</Label>
              <Select
                value={department}
                onValueChange={(v) => setDepartment(v as UserDepartment)}
              >
                <SelectTrigger id='signup-department' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_DEPARTMENTS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {DEPARTMENT_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='signup-password'>Senha</Label>
                <Input
                  id='signup-password'
                  type='password'
                  autoComplete='new-password'
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='signup-confirm'>Confirmar senha</Label>
                <Input
                  id='signup-confirm'
                  type='password'
                  autoComplete='new-password'
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {validateLoading ? (
              <p className='flex items-center gap-2 text-sm text-muted-foreground'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Validando colaborador...
              </p>
            ) : null}
            {!validateLoading && employeeName ? (
              <div className='flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'>
                <Check className='mt-0.5 h-4 w-4 shrink-0' />
                <p className='font-medium'>Colaborador encontrado.</p>
              </div>
            ) : null}
            {!validateLoading && validateError && cardNumber.trim() ? (
              <p className='text-sm text-destructive'>{validateError}</p>
            ) : null}
          </CardContent>
          <CardFooter className='flex flex-col gap-3 pt-6'>
            <Button
              type='submit'
              className='w-full'
              disabled={signupMutation.isPending || !employeeName}
            >
              {signupMutation.isPending ? 'Enviando...' : 'Enviar cadastro'}
            </Button>
            <Button variant='link' asChild>
              <Link to={ROUTES.LOGIN}>Já tenho acesso</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </PlatformPageShell>
  );
}
