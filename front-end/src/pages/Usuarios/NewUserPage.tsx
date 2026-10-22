import { useState, useCallback, useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, Loader2, UserPlus } from 'lucide-react';
import { AppPageContainer, PageHero } from '@/components/layout';
import { userApi } from '@/services/user';
import { ROUTES } from '@/routes/constants';
import { UNIT, type Unit, type UserDepartment, type UserRole } from '@/types/auth';
import { ROLE_OPTIONS } from '@/pages/Usuarios/userFormConstants';
import { useAuth } from '@/contexts/useAuth';
import {
  assignableDepartments,
  assignableRoles,
  canCreateUser,
} from '@/config/permissions';
import { DEPARTMENT_LABELS } from '@/utils/roles';
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
import { surfaceStyles } from '@/lib/surface-styles';
import { cn } from '@/lib/utils';

export function NewUserPage() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cardNumber, setCardNumber] = useState('');
  const [unit, setUnit] = useState<Unit>('PEDERTRACTOR');
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const allowedRoles = authUser
    ? assignableRoles(authUser.role, authUser.department)
    : [];
  const [roleDraft, setRoleDraft] = useState<UserRole>('USER');
  const role = allowedRoles.includes(roleDraft) ? roleDraft : 'USER';
  const departmentOptions = authUser
    ? assignableDepartments(authUser.role, authUser.department, role)
    : [];
  const [departmentDraft, setDepartmentDraft] = useState<UserDepartment>(
    authUser?.department ?? 'ENG_MECANICA',
  );
  const department = departmentOptions.includes(departmentDraft)
    ? departmentDraft
    : (departmentOptions[0] ?? 'ENG_MECANICA');
  const [validateError, setValidateError] = useState<string | null>(null);
  const [validateLoading, setValidateLoading] = useState(false);
  const validateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!departmentOptions.includes(departmentDraft) && departmentOptions[0]) {
      setDepartmentDraft(departmentOptions[0]);
    }
  }, [departmentDraft, departmentOptions]);

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
        ...(role === 'SUPER_ADMIN' ? {} : { department }),
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

  if (
    authUser &&
    !canCreateUser(authUser.role, authUser.department)
  ) {
    return <Navigate to={ROUTES.USUARIOS} replace />;
  }

  const roleOptions = ROLE_OPTIONS.filter((opt) =>
    allowedRoles.includes(opt.value),
  );
  const showDepartment = role !== 'SUPER_ADMIN';
  const departmentLocked = role === 'COMERCIAL' || departmentOptions.length <= 1;

  return (
    <AppPageContainer width='form'>
      <Button variant='ghost' size='sm' asChild className='-ml-2 w-fit'>
        <Link to={ROUTES.USUARIOS}>
          <ArrowLeft />
          Voltar
        </Link>
      </Button>

      <PageHero
        eyebrow='Administração'
        eyebrowIcon={UserPlus}
        title='Novo usuário'
        description='Crie um usuário para o painel. A senha padrão é o cartão; o usuário deverá alterá-la no primeiro login.'
        compact
      />

      <Card className={cn('w-full', surfaceStyles.card)}>
        <CardHeader>
          <CardTitle>Configurar novo usuário</CardTitle>
          <CardDescription>
            Informe cartão, unidade, função e departamento para concluir o
            cadastro.
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

            {showDepartment ? (
              <div className='space-y-2'>
                <Label htmlFor='department'>Departamento</Label>
                <Select
                  value={department}
                  disabled={departmentLocked}
                  onValueChange={(v) =>
                    setDepartmentDraft(v as UserDepartment)
                  }
                >
                  <SelectTrigger id='department' className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {DEPARTMENT_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {role === 'ADMIN' ? (
                  <p className='text-xs text-muted-foreground'>
                    O departamento define a área que este administrador lidera.
                  </p>
                ) : null}
              </div>
            ) : null}

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
    </AppPageContainer>
  );
}
