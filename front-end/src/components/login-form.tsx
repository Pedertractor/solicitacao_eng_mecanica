import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, ArrowUpRight, Eye, EyeOff, Fingerprint, Loader2, LockKeyhole } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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

type PasswordFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  visible: boolean;
  autoComplete: string;
  onChange: (value: string) => void;
  onToggle: () => void;
  onKey: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
};

function PasswordField({ id, label, placeholder, value, visible, autoComplete, onChange, onToggle, onKey, onBlur }: PasswordFieldProps) {
  return (
    <div className='login-field'>
      <label htmlFor={id}>{label}</label>
      <div className='login-input-wrap'>
        <LockKeyhole className='login-input-icon' size={16} aria-hidden='true' />
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKey}
          onKeyUp={onKey}
          onBlur={onBlur}
          className='login-input login-password-input hide-native-password-reveal'
          required
        />
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          className='login-password-toggle'
          onClick={onToggle}
          aria-controls={id}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </Button>
      </div>
    </div>
  );
}

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
    <div className={cn('login-form-content', className)} {...props}>
      <div className='login-form-heading'>
        <p className='login-eyebrow'>{mustChangePassword ? 'PRIMEIRO ACESSO' : 'SEU ACESSO'}</p>
        <h1>{mustChangePassword ? 'Sua nova senha.' : 'Bem-vindo.'}</h1>
        <p>{mustChangePassword ? 'Defina uma nova senha para continuar com segurança.' : 'Entre com seus dados para continuar.'}</p>
      </div>

      <form onSubmit={mustChangePassword ? handleChangePasswordSubmit : handleSubmit} aria-busy={isLoading}>
        <fieldset className='login-fields' disabled={isLoading}>
          <legend className='sr-only'>{mustChangePassword ? 'Alterar senha de acesso' : 'Dados de acesso'}</legend>
          {mustChangePassword ? (
            <>
              <PasswordField
                id='newPassword'
                label='Nova senha'
                placeholder='Mínimo 6 caracteres'
                value={newPassword}
                visible={showNewPassword}
                autoComplete='new-password'
                onChange={setNewPassword}
                onToggle={() => setShowNewPassword((previous) => !previous)}
                onKey={syncCapsLockFromEvent}
                onBlur={(event) => handlePasswordBlur(event, ['confirmPassword'])}
              />
              <PasswordField
                id='confirmPassword'
                label='Confirmar nova senha'
                placeholder='Repita sua nova senha'
                value={confirmPassword}
                visible={showConfirmPassword}
                autoComplete='new-password'
                onChange={setConfirmPassword}
                onToggle={() => setShowConfirmPassword((previous) => !previous)}
                onKey={syncCapsLockFromEvent}
                onBlur={(event) => handlePasswordBlur(event, ['newPassword'])}
              />
            </>
          ) : (
            <>
              <div className='login-field'>
                <label htmlFor='card'>Número do crachá</label>
                <div className='login-input-wrap'>
                  <Fingerprint className='login-input-icon' size={17} aria-hidden='true' />
                  <Input
                    id='card'
                    type='text'
                    inputMode='numeric'
                    autoComplete='username'
                    placeholder='Ex.: 2282'
                    value={displayCardNumber(cardNumber)}
                    onChange={(event) => setCardNumber(parseCardNumberInput(event.target.value))}
                    className='login-input'
                    required
                  />
                </div>
              </div>

              <fieldset className='login-unit-field'>
                <legend>Sua unidade</legend>
                <div className='login-unit-options'>
                  {UNIT.map((item) => (
                    <label key={item} className='login-unit-option'>
                      <input type='radio' name='unit' value={item} checked={unit === item} onChange={() => setUnit(item)} required />
                      <span>{item === 'PEDERTRACTOR' ? 'Pedertractor' : 'Tractor'}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <PasswordField
                id='password'
                label='Senha'
                placeholder='Sua senha pessoal'
                value={password}
                visible={showPassword}
                autoComplete='current-password'
                onChange={setPassword}
                onToggle={() => setShowPassword((previous) => !previous)}
                onKey={syncCapsLockFromEvent}
                onBlur={() => setCapsLockOn(false)}
              />
            </>
          )}
          {capsLockOn ? <p className='login-caps-warning' role='status'>Caps Lock está ativo.</p> : null}
          <Button type='submit' className='login-submit' disabled={isLoading}>
            {isLoading ? (mustChangePassword ? 'Salvando...' : 'Entrando...') : (mustChangePassword ? 'Salvar nova senha' : 'Entrar')}
            {isLoading ? <Loader2 size={17} className='animate-spin motion-reduce:animate-none' aria-hidden='true' /> : <ArrowRight size={17} aria-hidden='true' />}
          </Button>
        </fieldset>
      </form>

      {mustChangePassword ? (
        <p className='login-first-access'>Escolha uma senha pessoal e mantenha seus dados protegidos.</p>
      ) : (
        <>
          <p className='login-first-access'><strong>Acesso criado pelo administrador?</strong><br />Use seu crachá como senha inicial.<br />Você poderá definir uma nova senha ao entrar.</p>
          <div className='login-register'>
            <span>Ainda não tem acesso?</span>
            <Link to={ROUTES.CADASTRO}>Solicitar cadastro <ArrowUpRight size={14} aria-hidden='true' /></Link>
          </div>
        </>
      )}
    </div>
  );
}
