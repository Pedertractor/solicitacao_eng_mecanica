import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { userApi } from '@/services/user';
import type { ListUser } from '@/types/auth';
import { useAuth } from '@/contexts/useAuth';
import { canApproveUsers } from '@/config/permissions';
import { DEPARTMENT_LABELS, formattedRoles } from '@/utils/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';

const PAGE_SIZE = 10;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function UserSignupRequestsPage() {
  const { user: authUser } = useAuth();
  const allowApproval =
    authUser?.role != null && canApproveUsers(authUser.role);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const {
    data: users = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.listAll(),
    enabled: allowApproval,
  });

  const approveMutation = useMutation({
    mutationFn: (userId: string) => userApi.approve(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Cadastro aprovado.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (userId: string) => userApi.reject(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Cadastro recusado.');
    },
  });

  const pending = useMemo(
    () =>
      users
        .filter((u) => u.approvalStatus === 'PENDING')
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [users],
  );

  const totalPages = Math.max(1, Math.ceil(pending.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = pending.slice(start, start + PAGE_SIZE);
  const pendingAction =
    approveMutation.isPending || rejectMutation.isPending;

  if (!allowApproval) {
    return (
      <p className='text-sm text-muted-foreground'>
        Você não tem permissão para analisar solicitações de acesso.
      </p>
    );
  }

  return (
    <Card className='gap-0 overflow-hidden py-0'>
      {isLoading && (
        <div className='p-8'>
          <div className='animate-pulse space-y-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className='h-12 rounded bg-muted' />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <div className='m-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive'>
          {error instanceof Error
            ? error.message
            : 'Erro ao carregar solicitações.'}
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div className='hidden sm:block'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Área solicitada</TableHead>
                  <TableHead className='text-right'>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className='h-24 text-center text-muted-foreground'
                    >
                      Nenhuma solicitação de acesso pendente.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageItems.map((user) => (
                    <PendingSignupRow
                      key={user.id}
                      user={user}
                      pendingAction={pendingAction}
                      onApprove={(id) => approveMutation.mutate(id)}
                      onReject={(id) => rejectMutation.mutate(id)}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className='divide-y sm:hidden'>
            {pageItems.length === 0 ? (
              <p className='p-6 text-center text-sm text-muted-foreground'>
                Nenhuma solicitação de acesso pendente.
              </p>
            ) : (
              pageItems.map((user) => (
                <PendingSignupCard
                  key={user.id}
                  user={user}
                  pendingAction={pendingAction}
                  onApprove={(id) => approveMutation.mutate(id)}
                  onReject={(id) => rejectMutation.mutate(id)}
                />
              ))
            )}
          </div>

          {pending.length > 0 ? (
            <TablePagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              summary={
                <>
                  Mostrando {start + 1}–
                  {Math.min(start + PAGE_SIZE, pending.length)} de{' '}
                  {pending.length} solicitações
                </>
              }
            />
          ) : null}
        </>
      )}
    </Card>
  );
}

function PendingSignupRow({
  user,
  pendingAction,
  onApprove,
  onReject,
}: {
  user: ListUser;
  pendingAction: boolean;
  onApprove: (userId: string) => void;
  onReject: (userId: string) => void;
}) {
  return (
    <TableRow>
      <TableCell className='whitespace-nowrap text-sm tabular-nums'>
        {format(new Date(user.createdAt), 'dd/MM/yyyy HH:mm', {
          locale: ptBR,
        })}
      </TableCell>
      <TableCell>
        <div className='flex items-center gap-2.5'>
          <div
            className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground'
            aria-hidden
          >
            {getInitials(user.name)}
          </div>
          <div className='min-w-0'>
            <div className='truncate font-medium'>{user.name}</div>
            <div className='text-xs text-muted-foreground tabular-nums'>
              Cartão {user.cardNumber}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>{user.unit}</TableCell>
      <TableCell>
        <div>{DEPARTMENT_LABELS[user.department]}</div>
        <Badge variant='outline' className='mt-1'>
          {formattedRoles[user.role]}
        </Badge>
      </TableCell>
      <TableCell className='text-right'>
        <div className='flex justify-end gap-2'>
          <Button
            type='button'
            size='sm'
            disabled={pendingAction}
            onClick={() => onApprove(user.id)}
          >
            Aprovar
          </Button>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={pendingAction}
            onClick={() => onReject(user.id)}
          >
            Recusar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function PendingSignupCard({
  user,
  pendingAction,
  onApprove,
  onReject,
}: {
  user: ListUser;
  pendingAction: boolean;
  onApprove: (userId: string) => void;
  onReject: (userId: string) => void;
}) {
  return (
    <div className='space-y-3 p-4'>
      <div className='flex items-start gap-2.5'>
        <div
          className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground'
          aria-hidden
        >
          {getInitials(user.name)}
        </div>
        <div className='min-w-0 flex-1'>
          <p className='truncate text-sm font-medium'>{user.name}</p>
          <p className='text-xs text-muted-foreground'>
            Cartão {user.cardNumber} · {user.unit}
          </p>
          <p className='mt-1 text-xs text-muted-foreground tabular-nums'>
            {format(new Date(user.createdAt), 'dd/MM/yyyy HH:mm', {
              locale: ptBR,
            })}
          </p>
        </div>
      </div>
      <div className='flex flex-wrap gap-2'>
        <Badge variant='outline'>{DEPARTMENT_LABELS[user.department]}</Badge>
        <Badge variant='secondary'>{formattedRoles[user.role]}</Badge>
      </div>
      <div className='flex gap-2'>
        <Button
          type='button'
          size='sm'
          className='flex-1'
          disabled={pendingAction}
          onClick={() => onApprove(user.id)}
        >
          Aprovar
        </Button>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className='flex-1'
          disabled={pendingAction}
          onClick={() => onReject(user.id)}
        >
          Recusar
        </Button>
      </div>
    </div>
  );
}
