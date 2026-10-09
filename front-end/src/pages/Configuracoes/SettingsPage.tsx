import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi } from '@/services/settings';
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [editedEmails, setEditedEmails] = useState<string[] | null>(null);
  const [draftEmail, setDraftEmail] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['settings', 'email-cc'],
    queryFn: () => settingsApi.getEmailCc(),
  });

  const emails = editedEmails ?? query.data ?? [];

  const saveMutation = useMutation({
    mutationFn: (nextEmails: string[]) => settingsApi.updateEmailCc(nextEmails),
    onSuccess: () => {
      setEditedEmails(null);
      void queryClient.invalidateQueries({ queryKey: ['settings', 'email-cc'] });
      toast.success('Configurações de e-mail salvas.');
    },
  });

  const addEmail = () => {
    const value = draftEmail.trim().toLowerCase();
    if (!value) {
      setDraftError('Informe o e-mail.');
      return;
    }
    if (!EMAIL_PATTERN.test(value)) {
      setDraftError('E-mail inválido.');
      return;
    }
    if (emails.some((item) => item === value)) {
      setDraftError('Este e-mail já está na lista.');
      return;
    }
    setDraftError(null);
    setEditedEmails((prev) => [...(prev ?? query.data ?? []), value]);
    setDraftEmail('');
  };

  const removeEmail = (email: string) => {
    setEditedEmails((prev) =>
      (prev ?? query.data ?? []).filter((item) => item !== email),
    );
  };

  const handleSave = () => {
    saveMutation.mutate(emails);
  };

  const isDirty =
    JSON.stringify(emails) !== JSON.stringify(query.data ?? []);

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-xl font-semibold tracking-tight'>Configurações</h1>
        <p className='text-muted-foreground text-sm'>
          Ajustes da plataforma, começando pelas notificações por e-mail.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>E-mail</CardTitle>
          <CardDescription>
            As notificações de aprovação e conclusão são enviadas ao solicitante.
            Os e-mails abaixo entram em cópia (CC).
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-2'>
            <Label htmlFor='cc-email'>Adicionar e-mail em cópia</Label>
            <div className='flex gap-2'>
              <Input
                id='cc-email'
                type='email'
                autoComplete='email'
                placeholder='nome@empresa.com'
                value={draftEmail}
                onChange={(e) => {
                  setDraftError(null);
                  setDraftEmail(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addEmail();
                  }
                }}
                aria-invalid={!!draftError}
              />
              <Button type='button' variant='outline' onClick={addEmail}>
                <Plus className='size-4' />
                Adicionar
              </Button>
            </div>
            {draftError && (
              <p className='text-sm text-destructive'>{draftError}</p>
            )}
          </div>

          {query.isLoading ? (
            <p className='text-muted-foreground text-sm'>Carregando…</p>
          ) : query.isError ? (
            <p className='text-sm text-destructive'>
              Não foi possível carregar os e-mails em cópia.
            </p>
          ) : emails.length === 0 ? (
            <p className='text-muted-foreground text-sm'>
              Nenhum e-mail em cópia configurado.
            </p>
          ) : (
            <ul className='divide-y rounded-md border'>
              {emails.map((email) => (
                <li
                  key={email}
                  className='flex items-center justify-between gap-3 px-3 py-2 text-sm'
                >
                  <span className='min-w-0 truncate'>{email}</span>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    aria-label={`Remover ${email}`}
                    onClick={() => removeEmail(email)}
                  >
                    <Trash2 className='size-4' />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className='flex justify-end'>
            <Button
              type='button'
              onClick={handleSave}
              disabled={
                saveMutation.isPending || query.isLoading || query.isError || !isDirty
              }
            >
              {saveMutation.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
