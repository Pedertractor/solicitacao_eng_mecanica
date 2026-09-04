import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/useAuth';
import { ROUTES } from '@/routes/constants';
import { loginFormSchema, changePasswordFormSchema } from '@/schemas/login';
import { UNIT } from '@/types/auth';
import { userApi } from '@/services/user';
import {
  cardNumberForApi,
  displayCardNumber,
  parseCardNumberInput,
} from '@/utils/card-number-input';
import { publicSolicitationCardClass } from '@/pages/Solicitacao/PublicSolicitationShell';

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const navigate = useNavigate();
  const { user, login, isLoading, isLoggedIn, updateUser, setLoading } =
    useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [unit, setUnit] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [capsLockOn, setCapsLockOn] = useState(false);

  const mustChangePassword = Boolean(user?.mustChangePassword);

  function syncCapsLockFromEvent(e: React.KeyboardEvent) {
    setCapsLockOn(e.getModifierState('CapsLock'));
  }

  function handlePasswordBlur(
    e: React.FocusEvent<HTMLInputElement>,
    peerIds: string[],
  ) {
    const next = e.relatedTarget as HTMLElement | null;
    if (next?.id && peerIds.includes(next.id)) return;
    setCapsLockOn(false);
  }

  useEffect(() => {
    if (isLoggedIn && user && !mustChangePassword) {
      navigate(ROUTES.HOME, { replace: true });
    }
  }, [isLoggedIn, mustChangePassword, navigate, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const result = loginFormSchema.safeParse({
      cardNumber,
      unit: unit || undefined,
      password,
    });

    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? 'Verifique os dados.');
      return;
    }

    await login({
      cardNumber: cardNumberForApi(result.data.cardNumber),
      unit: result.data.unit,
      password: result.data.password,
    });
  }

  async function handleChangePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();

    const result = changePasswordFormSchema.safeParse({
      newPassword,
      confirmPassword,
    });

    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? 'Verifique os dados.');
      return;
    }

    setLoading(true);
    try {
      const { user: updatedUser } = await userApi.changePasswordFirstLogin(
        result.data.newPassword,
      );
      updateUser(updatedUser);
      toast.success('Senha alterada com sucesso.');
      navigate(ROUTES.HOME, { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card className={publicSolicitationCardClass}>
        {mustChangePassword ? (
          <>
            <CardHeader className='text-center'>
              <CardTitle className='text-xl'>Alterar senha</CardTitle>
              <CardDescription>
                Defina uma nova senha para continuar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePasswordSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor='newPassword'>Nova senha</FieldLabel>
                    <div className='relative'>
                      <Input
                        id='newPassword'
                        type={showNewPassword ? 'text' : 'password'}
                        autoComplete='new-password'
                        placeholder='Mínimo 6 caracteres'
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        onKeyDown={syncCapsLockFromEvent}
                        onKeyUp={syncCapsLockFromEvent}
                        onBlur={(e) =>
                          handlePasswordBlur(e, ['confirmPassword'])
                        }
                        className='hide-native-password-reveal pr-9'
                        required
                      />
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-sm'
                        className='absolute inset-y-0 right-0 h-full'
                        onClick={() => setShowNewPassword((p) => !p)}
                        aria-label={
                          showNewPassword ? 'Ocultar senha' : 'Mostrar senha'
                        }
                      >
                        {showNewPassword ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor='confirmPassword'>
                      Confirmar nova senha
                    </FieldLabel>
                    <div className='relative'>
                      <Input
                        id='confirmPassword'
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete='new-password'
                        placeholder='Repita a nova senha'
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyDown={syncCapsLockFromEvent}
                        onKeyUp={syncCapsLockFromEvent}
                        onBlur={(e) => handlePasswordBlur(e, ['newPassword'])}
                        className='hide-native-password-reveal pr-9'
                        required
                      />
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-sm'
                        className='absolute inset-y-0 right-0 h-full'
                        onClick={() => setShowConfirmPassword((p) => !p)}
                        aria-label={
                          showConfirmPassword
                            ? 'Ocultar senha'
                            : 'Mostrar senha'
                        }
                      >
                        {showConfirmPassword ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </Field>
                  {capsLockOn ? (
                    <FieldDescription>Caps Lock está ativo</FieldDescription>
                  ) : null}
                  <Field>
                    <Button type='submit' disabled={isLoading}>
                      {isLoading ? 'Salvando...' : 'Alterar senha'}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className='text-center'>
              <CardTitle className='text-xl'>Bem-vindo</CardTitle>
              <CardDescription>
                Acesse com seu cartão e unidade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor='card'>Nº do cartão</FieldLabel>
                    <Input
                      id='card'
                      type='text'
                      inputMode='numeric'
                      autoComplete='username'
                      placeholder='Cartão corporativo'
                      value={displayCardNumber(cardNumber)}
                      onChange={(e) =>
                        setCardNumber(parseCardNumberInput(e.target.value))
                      }
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel id='unit-label'>Unidade</FieldLabel>
                    <div
                      className='flex gap-1.5'
                      role='group'
                      aria-labelledby='unit-label'
                    >
                      {UNIT.map((u) => (
                        <Button
                          key={u}
                          type='button'
                          size='sm'
                          variant={unit === u ? 'default' : 'outline'}
                          className='h-8 flex-1 px-2 text-xs font-medium'
                          aria-pressed={unit === u}
                          onClick={() => setUnit(u)}
                        >
                          {u}
                        </Button>
                      ))}
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor='password'>Senha</FieldLabel>
                    <div className='relative'>
                      <Input
                        id='password'
                        type={showPassword ? 'text' : 'password'}
                        autoComplete='current-password'
                        placeholder='••••••••'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={syncCapsLockFromEvent}
                        onKeyUp={syncCapsLockFromEvent}
                        onBlur={() => setCapsLockOn(false)}
                        className='hide-native-password-reveal pr-9'
                        required
                      />
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-sm'
                        className='absolute inset-y-0 right-0 h-full'
                        onClick={() => setShowPassword((p) => !p)}
                        aria-label={
                          showPassword ? 'Ocultar senha' : 'Mostrar senha'
                        }
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                    {capsLockOn ? (
                      <FieldDescription>Caps Lock está ativo</FieldDescription>
                    ) : null}
                  </Field>
                  <Field>
                    <Button type='submit' disabled={isLoading}>
                      {isLoading ? 'Entrando...' : 'Entrar'}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
