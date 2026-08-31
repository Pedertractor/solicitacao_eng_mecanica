import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { userApi, type UserDetail } from '@/services/user';
import type { ListUser, UserRole } from '@/types/auth';
import { ROLE_OPTIONS } from '@/pages/Usuarios/userFormConstants';
import { PillarMultiSelect } from '@/pages/Usuarios/PillarMultiSelect';
import type { PillarCode } from '@/config/pillars';
import { useAuth } from '@/contexts/useAuth';
import { canResetUserPassword } from '@/config/permissions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Props = {
  user: ListUser | null;
  open: boolean;
  onClose: () => void;
};

function EditUserFormBody({
  detail,
  onClose,
}: {
  detail: UserDetail;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const [role, setRole] = useState<UserRole>(detail.role);
  const [pillarCodes, setPillarCodes] = useState<PillarCode[]>(
    detail.assignedPillarCodes ?? [],
  );
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const isCurrentUser = authUser?.id === detail.id;
  const canAssignAdminRole = authUser?.role === 'ADMIN';
  const canResetPassword =
    authUser?.role != null &&
    canResetUserPassword(authUser.role) &&
    !isCurrentUser;
  const roleOptions = useMemo(() => {
    const base = canAssignAdminRole
      ? ROLE_OPTIONS
      : ROLE_OPTIONS.filter((opt) => opt.value !== 'ADMIN');
    if (base.some((o) => o.value === detail.role)) return base;
    const current = ROLE_OPTIONS.find((o) => o.value === detail.role);
    return current ? [current, ...base] : base;
  }, [canAssignAdminRole, detail.role]);

  const updateMutation = useMutation({
    mutationFn: () =>
      userApi.updateByAdmin(detail.id, {
        role,
        ...(role === 'RESPONSIBLE' ? { pillarCodes } : {}),
      }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário atualizado.');
      onClose();
    },
    // Erros HTTP são tratados pelo interceptor do axios (toast); evita mensagem duplicada.
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => userApi.resetPasswordByAdmin(detail.id),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['users', detail.id], updatedUser);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setResetConfirmOpen(false);
      toast.success(
        `Senha de ${detail.name} redefinida para o número do cartão.`,
      );
    },
  });

  return (
    <form
      className='space-y-5'
      onSubmit={(e) => {
        e.preventDefault();
        if (role === 'RESPONSIBLE' && pillarCodes.length === 0) {
          toast.error('Selecione ao menos um pilar para o responsável.');
          return;
        }
        updateMutation.mutate();
      }}
    >
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label htmlFor='edit-cardNumber'>Nº de cartão</Label>
          <Input
            id='edit-cardNumber'
            type='text'
            readOnly
            value={detail.cardNumber}
            className='bg-muted'
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='edit-unit'>Unidade</Label>
          <Input
            id='edit-unit'
            type='text'
            readOnly
            value={detail.unit}
            className='bg-muted'
          />
        </div>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='edit-name'>Nome</Label>
        <Input
          id='edit-name'
          type='text'
          readOnly
          value={detail.name}
          className='bg-muted'
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='edit-role'>Função do usuário</Label>
        <Select
          value={role}
          disabled={isCurrentUser}
          onValueChange={(v) => setRole(v as UserRole)}
        >
          <SelectTrigger id='edit-role' className='w-full'>
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
        {isCurrentUser ? (
          <p className='text-xs text-muted-foreground'>
            Você não pode alterar a sua própria função.
          </p>
        ) : null}
      </div>

      {role === 'RESPONSIBLE' ? (
        <div className='space-y-2'>
          <Label>Pilares de responsabilidade</Label>
          <PillarMultiSelect
            idPrefix='edit-pillar'
            value={pillarCodes}
            onChange={setPillarCodes}
          />
          <p className='text-xs text-muted-foreground'>
            O responsável visualiza todos os dados dos pilares selecionados.
          </p>
        </div>
      ) : null}

      {canResetPassword ? (
        <div className='rounded-lg border bg-muted/40 p-4'>
          <p className='text-sm font-semibold'>Redefinir senha</p>
          <p className='mt-1 text-xs text-muted-foreground'>
            A senha temporária será o número do cartão e deverá ser alterada no
            próximo login.
          </p>
          <Button
            type='button'
            variant='outline'
            className='mt-3'
            onClick={() => setResetConfirmOpen(true)}
          >
            Redefinir senha
          </Button>

          <AlertDialog
            open={resetConfirmOpen}
            onOpenChange={setResetConfirmOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Redefinir senha de {detail.name}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  A senha atual deixará de funcionar. A senha temporária será o
                  número do cartão ({detail.cardNumber}) e o usuário precisará
                  criar uma nova senha ao entrar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel type='button'>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  type='button'
                  disabled={resetPasswordMutation.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    resetPasswordMutation.mutate();
                  }}
                  className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                >
                  {resetPasswordMutation.isPending ? (
                    <>
                      <Loader2 className='animate-spin' />
                      Redefinindo...
                    </>
                  ) : (
                    'Confirmar redefinição'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}

      <DialogFooter>
        <Button type='button' variant='outline' onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type='submit'
          disabled={isCurrentUser || updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className='animate-spin' />
              Salvando...
            </>
          ) : (
            'Salvar alterações'
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditUserModal({ user, open, onClose }: Props) {
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['users', user?.id],
    queryFn: () => userApi.getById(user!.id),
    enabled: open && !!user,
  });

  return (
    <Dialog
      open={open && !!user}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>
            Altere a função do usuário. Cartão e unidade não podem ser alterados
            aqui.
          </DialogDescription>
        </DialogHeader>

        {detailLoading && (
          <div className='flex justify-center py-12'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        )}

        {!detailLoading && detail && (
          <EditUserFormBody
            key={detail.id}
            detail={detail}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
