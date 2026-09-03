import { useState, useCallback, useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { userApi } from '@/services/user';
import { ROUTES } from '@/routes/constants';
import { UNIT, type Unit, type UserRole } from '@/types/auth';
import { ROLE_OPTIONS } from '@/pages/Usuarios/userFormConstants';
import { useAuth } from '@/contexts/useAuth';
import {
  canAssignAdminRoleOnRegister,
  canCreateUser,
} from '@/config/permissions';
import {
  cardNumberForApi,
  displayCardNumber,
  parseCardNumberInput,
} from '@/utils/card-number-input';
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

export function NewUserPage() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cardNumber, setCardNumber] = useState('');
  const [unit, setUnit] = useState<Unit>('PEDERTRACTOR');
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState<UserRole>('USER');
  const role =
    authUser &&
    !canAssignAdminRoleOnRegister(authUser.role) &&
    roleDraft === 'ADMIN'
      ? 'USER'
      : roleDraft;
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
      const result = await userApi.validateEmployee(card, unit);
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

  const registerMutation = useMutation({
    mutationFn: () =>
      userApi.register({
        cardNumber: cardNumberForApi(cardNumber),
        unit,
        role,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário criado com sucesso.');
      navigate(ROUTES.USUARIOS);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeName) {
      toast.error(
        'Informe cartão e unidade e aguarde a validação do colaborador.',
      );
      return;
    }
    registerMutation.mutate();
  };

  if (authUser && !canCreateUser(authUser.role)) {
    return <Navigate to={ROUTES.USUARIOS} replace />;
  }

  const roleOptions =
    authUser && canAssignAdminRoleOnRegister(authUser.role)
      ? ROLE_OPTIONS
      : ROLE_OPTIONS.filter((opt) => opt.value !== 'ADMIN');

  return (
    <div className='space-y-6'>
      <Button variant='ghost' size='sm' asChild>
        <Link to={ROUTES.USUARIOS}>
          <ArrowLeft />
          Voltar
        </Link>
      </Button>

      <Card className='mx-auto w-full max-w-2xl'>
        <CardHeader>
          <CardTitle>Configurar novo usuário</CardTitle>
          <CardDescription>
            Crie um usuário admin/usuário para o painel. A senha padrão é o
            cartão; o usuário deverá alterá-la no primeiro login.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className='space-y-5'>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='cardNumber'>Nº de cartão</Label>
                <Input
                  id='cardNumber'
                  type='text'
                  inputMode='numeric'
                  value={displayCardNumber(cardNumber)}
                  onChange={(e) =>
                    setCardNumber(parseCardNumberInput(e.target.value))
                  }
                  placeholder='Número de cartão do colaborador...'
                  autoComplete='off'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='unit'>Unidade</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                  <SelectTrigger id='unit' className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='employeeName'>Nome do colaborador</Label>
              <Input
                id='employeeName'
                type='text'
                readOnly
                value={employeeName ?? ''}
                placeholder='Aguardando cartão e unidade...'
                className='bg-muted'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='role'>Função do usuário</Label>
              <Select
                value={role}
                onValueChange={(v) => setRoleDraft(v as UserRole)}
              >
                <SelectTrigger id='role' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {validateLoading && (
              <p className='flex items-center gap-2 text-sm text-muted-foreground'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Validando colaborador...
              </p>
            )}
            {!validateLoading && employeeName && (
              <div className='flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'>
                <Check className='mt-0.5 h-4 w-4 shrink-0' />
                <div>
                  <p className='font-medium'>
                    Colaborador encontrado com sucesso, pronto para registro!
                  </p>
                </div>
              </div>
            )}
            {!validateLoading && validateError && cardNumber.trim() && (
              <p className='text-sm text-destructive'>{validateError}</p>
            )}
          </CardContent>

          <CardFooter className='flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'>
            <Button variant='outline' asChild>
              <Link to={ROUTES.USUARIOS}>Cancelar</Link>
            </Button>
            <Button
              type='submit'
              disabled={!employeeName || registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className='animate-spin' />
                  Criando...
                </>
              ) : (
                'Criar usuário'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
