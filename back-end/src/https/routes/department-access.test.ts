import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SolicitationPrismaRepository } from '../../repositories/prisma/solicitation-repository.js';
import { prisma } from '../../lib/prisma.js';
import { app } from '../../app.js';
import { UserService } from '../../services/user-service.js';
import type { UserDepartment, UserRole } from '../../generated/prisma/enums.js';

const userReader = vi.spyOn(prisma.user, 'findUnique');
const principal = vi.spyOn(UserService.prototype, 'resolveSessionPrincipal');
beforeAll(async () => { await app.ready(); });
afterAll(async () => { principal.mockRestore(); userReader.mockRestore(); await app.close(); });
function headers(role: UserRole, department: UserDepartment | null, active = true) {
  const user = { id: 'actor', role, department, cardNumber: 'test', unit: 'TRACTOR', active,
    approvalStatus: 'APPROVED', mustChangePassword: false } as Awaited<ReturnType<UserService['resolveSessionPrincipal']>>;
  principal.mockResolvedValue(user);
  userReader.mockResolvedValue(user as never);
  // Deliberately stale / elevated claims: middleware must use the database principal.
  return { authorization: 'Bearer ' + app.jwt.sign({ sub: 'actor', role: 'SUPER_ADMIN' }) };
}
describe('department authorization through HTTP routes', () => {
  it.each(['PCP', 'COMERCIAL'] as const)('blocks user management and cross-area mutations for ADMIN / %s', async (department) => {
    const auth = headers('ADMIN', department);
    const register = await app.inject({ method: 'POST', url: '/api/users/register', headers: auth,
      payload: { role: 'ADMIN', department: 'ENG_MECANICA', unit: 'TRACTOR', cardNumber: 'other' } });
    expect(register.statusCode).toBe(403);
    const users = await app.inject({ method: 'GET', url: '/api/users', headers: auth });
    expect(users.statusCode).toBe(403);
    const settings = await app.inject({ method: 'GET', url: '/api/settings/email-cc', headers: auth });
    expect(settings.statusCode).toBe(403);
  });
  it.each([['USER', 'PCP'], ['USER', 'COMERCIAL'], ['ADMIN', 'COMERCIAL'], ['ADMIN', 'FERRAMENTARIA']] as const)('blocks PCP actions for %s / %s despite super admin token claims', async (role, department) => {
    const response = await app.inject({ method: 'POST', url: '/api/solicitations/00000000-0000-4000-8000-000000000001/workflow/pcp/PCP_AMOSTRA/start', headers: headers(role, department) });
    expect(response.statusCode).toBe(403);
  });
  it.each(['PCP', 'COMERCIAL'])('rejects legacy role %s at the API boundary', async (role) => {
    const response = await app.inject({ method: 'POST', url: '/api/users/register', headers: headers('SUPER_ADMIN', null),
      payload: { role, department: 'DESENVOLVIMENTO_PROCESSOS', unit: 'TRACTOR', cardNumber: 'other' } });
    expect(response.statusCode).toBe(400);
  });
  it('rejects deactivated accounts even when their token says super admin', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/users/me', headers: headers('ADMIN', 'PCP', false) });
    expect(response.statusCode).toBe(401);
  });
});


describe('Commercial indicators HTTP access', () => {
  it.each([['ADMIN', 'COMERCIAL', 200], ['USER', 'COMERCIAL', 403], ['ADMIN', 'PCP', 403]] as const)('returns %s / %s indicators with status %s', async (role, department, status) => {
    const rows = vi.spyOn(SolicitationPrismaRepository.prototype, 'findProcessChartRows').mockResolvedValue([]);
    try {
      const response = await app.inject({ method: 'GET', url: '/api/solicitations/process-charts?teamId=test&period=month', headers: headers(role, department) });
      expect(response.statusCode).toBe(status);
      if (status === 200) {
        expect(response.json()).toMatchObject({ teamId: 'test', period: 'month', byClient: [] });
        expect(rows).toHaveBeenCalledOnce();
      } else expect(rows).not.toHaveBeenCalled();
    } finally { rows.mockRestore(); }
  });
});
