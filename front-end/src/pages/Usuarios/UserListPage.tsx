import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { userApi } from '@/services/user';
import { ROUTES } from '@/routes/constants';
import type { ListUser, UserRole } from '@/types/auth';
import { useAuth } from '@/contexts/useAuth';
import {
  canCreateUser,
  canEditUserAsAdmin,
} from '@/config/permissions';
import { EditUserModal } from '@/pages/Usuarios/EditUserModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'ADMIN',
  USER: 'USUÁRIO',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function UserListPage() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const showNewUser = authUser?.role != null && canCreateUser(authUser.role);
  const allowAdminEdit =
    authUser?.role != null && canEditUserAsAdmin(authUser.role);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editUser, setEditUser] = useState<ListUser | null>(null);

  const {
    data: users = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.listAll(),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.trim().toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q));
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageUsers = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className='space-y-6'>
      <EditUserModal
        user={editUser}
        open={editUser !== null}
        onClose={() => setEditUser(null)}
      />

      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1>Usuários</h1>
          <p className='text-muted-foreground'>
            Lista de usuários do sistema
          </p>
        </div>
        {showNewUser ? (
          <Button
            type='button'
            onClick={() => navigate(ROUTES.USUARIOS_NOVO)}
            className='shrink-0'
          >
            <Plus />
            Novo usuário
          </Button>
        ) : null}
      </div>

      <div className='relative max-w-md'>
        <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
        <Input
          type='search'
          placeholder='Procurar por nome...'
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className='pl-9'
          aria-label='Procurar por nome'
        />
      </div>

      <Card className='gap-0 overflow-hidden py-0'>
        {isLoading && (
          <div className='p-8'>
            <div className='animate-pulse space-y-4'>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className='h-12 rounded bg-muted' />
              ))}
            </div>
          </div>
        )}

        {isError && (
          <div className='m-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive'>
            {error instanceof Error
              ? error.message
              : 'Erro ao carregar usuários.'}
          </div>
        )}

        {!isLoading && !isError && (
          <>
            <div className='hidden sm:block'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cartão</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageUsers.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      isAdmin={allowAdminEdit}
                      onEdit={allowAdminEdit ? setEditUser : undefined}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className='divide-y sm:hidden'>
              {pageUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  isAdmin={allowAdminEdit}
                  onEdit={allowAdminEdit ? setEditUser : undefined}
                />
              ))}
            </div>

            <TablePagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              summary={
                <>
                  Mostrando{' '}
                  {filtered.length === 0
                    ? '0–0'
                    : `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)}`}{' '}
                  de {filtered.length} usuários
                </>
              }
            />
          </>
        )}
      </Card>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge variant={role === 'ADMIN' ? 'secondary' : 'outline'}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? 'secondary' : 'outline'}>
      {active ? 'Ativo' : 'Inativo'}
    </Badge>
  );
}

function UserRow({
  user,
  isAdmin,
  onEdit,
}: {
  user: ListUser;
  isAdmin: boolean;
  onEdit?: (u: ListUser) => void;
}) {
  return (
    <TableRow
      className={isAdmin ? 'cursor-pointer' : undefined}
      onClick={() => onEdit?.(user)}
      onKeyDown={(e) => {
        if (!isAdmin || !onEdit) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit(user);
        }
      }}
      tabIndex={isAdmin && onEdit ? 0 : undefined}
      aria-label={isAdmin ? `Editar ${user.name}` : undefined}
    >
      <TableCell>
        <div className='flex items-center gap-2.5'>
          <div
            className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground'
            aria-hidden
          >
            {getInitials(user.name)}
          </div>
          <span className='min-w-0 truncate font-medium'>{user.name}</span>
        </div>
      </TableCell>
      <TableCell>{user.cardNumber}</TableCell>
      <TableCell>{user.unit}</TableCell>
      <TableCell>
        <RoleBadge role={user.role} />
      </TableCell>
      <TableCell>
        <ActiveBadge active={user.active} />
      </TableCell>
    </TableRow>
  );
}

function UserCard({
  user,
  isAdmin,
  onEdit,
}: {
  user: ListUser;
  isAdmin: boolean;
  onEdit?: (u: ListUser) => void;
}) {
  return (
    <div
      className={`p-4 ${isAdmin && onEdit ? 'cursor-pointer' : ''}`}
      onClick={() => onEdit?.(user)}
      onKeyDown={(e) => {
        if (!isAdmin || !onEdit) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit(user);
        }
      }}
      tabIndex={isAdmin && onEdit ? 0 : undefined}
      aria-label={isAdmin && onEdit ? `Editar ${user.name}` : undefined}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <div
            className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground'
            aria-hidden
          >
            {getInitials(user.name)}
          </div>
          <div className='min-w-0'>
            <p className='truncate text-sm font-medium'>{user.name}</p>
            <p className='text-xs text-muted-foreground'>
              Cartão {user.cardNumber}
            </p>
          </div>
        </div>
      </div>
      <div className='mt-3 flex flex-wrap items-center gap-2'>
        <RoleBadge role={user.role} />
        <ActiveBadge active={user.active} />
        <span className='text-xs text-muted-foreground'>{user.unit}</span>
      </div>
    </div>
  );
}
