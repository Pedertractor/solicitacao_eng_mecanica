import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { userApi, type UserDetail } from '@/services/user';
import type { ListUser, UserRole } from '@/types/auth';
import { ROLE_OPTIONS } from '@/pages/Usuarios/userFormConstants';
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
    mutationFn: () => userApi.updateByAdmin(detail.id, { role }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário atualizado.');
      onClose();
    },
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
        </div>
      ) : null}

      <DialogFooter>
        <Button type='button' variant='outline' onClick={onClose}>
          Cancelar
        </Button>
        <Button type='submit' disabled={updateMutation.isPending || isCurrentUser}>
          {updateMutation.isPending ? (
            <>
              <Loader2 className='animate-spin' /> Salvando…
            </>
          ) : (
            'Salvar'
          )}
        </Button>
      </DialogFooter>

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir senha?</AlertDialogTitle>
            <AlertDialogDescription>
              A senha de {detail.name} voltará a ser o número do cartão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetPasswordMutation.mutate()}
              disabled={resetPasswordMutation.isPending}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

export function EditUserModal({ user, open, onClose }: Props) {
  const detailQuery = useQuery({
    queryKey: ['users', user?.id],
    queryFn: () => userApi.getById(user!.id),
    enabled: open && Boolean(user?.id),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>
            Altere a função ou redefina a senha do usuário.
          </DialogDescription>
        </DialogHeader>
        {detailQuery.isLoading && (
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Loader2 className='size-4 animate-spin' /> Carregando…
          </div>
        )}
        {detailQuery.data ? (
          <EditUserFormBody detail={detailQuery.data} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
