import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Users } from 'lucide-react';
import {
  FilterPanel,
  ListErrorState,
  ListLoadingState,
  PageSectionHeader,
} from '@/components/layout';
import { userApi } from '@/services/user';
import { ROUTES } from '@/routes/constants';
import type { ListUser } from '@/types/auth';
import { useAuth } from '@/contexts/useAuth';
import { canCreateUser, canEditUserAsAdmin } from '@/config/permissions';
import { DEPARTMENT_LABELS, roleLabel } from '@/utils/roles';
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
import { surfaceStyles } from '@/lib/surface-styles';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;

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
  const showNewUser =
    authUser?.role != null &&
    canCreateUser(authUser.role, authUser.department);
  const allowAdminEdit =
    authUser?.role != null &&
    canEditUserAsAdmin(authUser.role, authUser.department);
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
    <div className='space-y-4'>
      <EditUserModal
        user={editUser}
        open={editUser !== null}
        onClose={() => setEditUser(null)}
      />

      <PageSectionHeader
        icon={Users}
        title='Todos os usuários'
        description='Contas ativas e inativas do painel'
        badge={
          !isLoading && !isError
            ? `${filtered.length} ${filtered.length === 1 ? 'usuário' : 'usuários'}`
            : undefined
        }
        actions={
          showNewUser ? (
            <Button
              type='button'
              onClick={() => navigate(ROUTES.USUARIOS_NOVO)}
              className='shrink-0'
            >
              <Plus />
              Novo usuário
            </Button>
          ) : null
        }
      />

      <FilterPanel
        description='Busque contas pelo nome'
        activeCount={search.trim() ? 1 : 0}
        onClear={() => {
          setSearch('');
          setPage(1);
        }}
      >
        <div className='relative max-w-md'>
          <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            type='search'
            placeholder='Procurar por nome...'
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={cn(surfaceStyles.field, 'pl-9')}
            aria-label='Procurar por nome'
          />
        </div>
      </FilterPanel>

      {isLoading ? (
        <ListLoadingState count={5} heightClass='h-14' />
      ) : isError ? (
        <ListErrorState>
          {error instanceof Error
            ? error.message
            : 'Erro ao carregar usuários.'}
        </ListErrorState>
      ) : (
        <Card className={cn('gap-0 overflow-hidden py-0', surfaceStyles.card)}>
          <div className='hidden sm:block'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cartão</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Área</TableHead>
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
        </Card>
      )}
    </div>
  );
}

function RoleBadge({
  role,
  department,
}: {
  role: ListUser['role'];
  department: ListUser['department'];
}) {
  return (
    <Badge variant={role === 'USER' ? 'outline' : 'secondary'}>
      {roleLabel(role, department)}
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
        {user.department ? DEPARTMENT_LABELS[user.department] : '—'}
      </TableCell>
      <TableCell>
        <RoleBadge role={user.role} department={user.department} />
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
        <RoleBadge role={user.role} department={user.department} />
        <ActiveBadge active={user.active} />
        <span className='text-xs text-muted-foreground'>{user.unit}</span>
        <span className='text-xs text-muted-foreground'>
          {user.department ? DEPARTMENT_LABELS[user.department] : '—'}
        </span>
      </div>
    </div>
  );
}
