import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserRound } from 'lucide-react';
import { AppPageContainer, PageHero } from '@/components/layout';
import { authApi } from '@/services/auth';
import { useAuth } from '@/contexts/useAuth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { surfaceStyles } from '@/lib/surface-styles';
import { cn } from '@/lib/utils';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [email, setEmail] = useState(user?.notificationEmail ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEmail(user?.notificationEmail ?? '');
  }, [user?.notificationEmail]);

  const saveMutation = useMutation({
    mutationFn: (nextEmail: string | null) =>
      authApi.updateNotificationEmail(nextEmail),
    onSuccess: (data) => {
      updateUser(data.user);
      setEmail(data.user.notificationEmail ?? '');
      toast.success('E-mail de notificação salvo.');
    },
  });

  const savedEmail = user?.notificationEmail ?? '';
  const trimmed = email.trim().toLowerCase();
  const isDirty = trimmed !== savedEmail.toLowerCase();

  const handleSave = () => {
    if (trimmed && !EMAIL_PATTERN.test(trimmed)) {
      setError('E-mail inválido.');
      return;
    }
    setError(null);
    saveMutation.mutate(trimmed.length > 0 ? trimmed : null);
  };

  return (
    <AppPageContainer width='narrow'>
      <PageHero
        eyebrow='Conta'
        eyebrowIcon={UserRound}
        title='Perfil'
        description='Dados da conta e preferências de notificação.'
        compact
      />

      <Card className={cn(surfaceStyles.card)}>
        <CardHeader>
          <CardTitle>E-mail de notificação</CardTitle>
          <CardDescription>
            Se você for administrador da área, informe um e-mail para receber
            avisos quando uma nova solicitação for criada. Deixe em branco para
            não receber.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-2'>
            <Label htmlFor='notification-email'>E-mail</Label>
            <Input
              id='notification-email'
              type='email'
              autoComplete='email'
              placeholder='nome@empresa.com'
              className={surfaceStyles.field}
              value={email}
              onChange={(e) => {
                setError(null);
                setEmail(e.target.value);
              }}
              aria-invalid={!!error}
            />
            {error ? <p className='text-sm text-destructive'>{error}</p> : null}
          </div>

          <div className='flex justify-end'>
            <Button
              type='button'
              onClick={handleSave}
              disabled={saveMutation.isPending || !isDirty}
            >
              {saveMutation.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </AppPageContainer>
  );
}
