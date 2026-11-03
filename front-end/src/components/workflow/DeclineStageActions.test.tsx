import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { Solicitation, WorkflowStageKind, WorkflowStageStatus } from '@/services/solicitation';
import type { UserDepartment, UserRole } from '@/types/auth';
import { DeclineStageActions } from './DeclineStageActions';

const auth = vi.hoisted(() => ({ user: { role: 'ADMIN' as UserRole, department: 'QUALIDADE' as UserDepartment | null } }));
vi.mock('@/contexts/useAuth', () => ({ useAuth: () => auth }));
const kinds: WorkflowStageKind[] = ['ENGENHARIA', 'PCP_FERRAMENTARIA', 'FERRAMENTARIA', 'PCP_AMOSTRA', 'QUALIDADE', 'AMOSTRA'];
function render(status: WorkflowStageStatus = 'PENDING', closed = false, onlyStage?: WorkflowStageKind) {
  const item = { id: 'test', status: closed ? 'COMPLETED' : 'APPROVED', workflow: { requiresTooling: true,
    stages: kinds.map((stage) => ({ id: stage, stage, status })) } } as Solicitation;
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(DeclineStageActions, { item, onlyStage })));
}
describe('decline stage actions', () => {
  it.each(['PENDING', 'READY', 'IN_PROGRESS'] as const)('offers unfinished %s stages only to their owner', (status) => {
    auth.user = { role: 'ADMIN', department: 'QUALIDADE' };
    const markup = render(status);
    expect(markup).toContain('Recusar etapa');
    expect(markup).toContain('PPAP');
    expect(markup).not.toContain('Ferramentaria');
  });
  it.each(['DONE', 'REJECTED', 'CANCELLED'] as const)('hides actions for %s stages', (status) => {
    auth.user = { role: 'ADMIN', department: 'DESENVOLVIMENTO_PROCESSOS' };
    expect(render(status)).not.toContain('Recusar etapa');
  });
  it('limits the engineering queue action and hides closed solicitations', () => {
    auth.user = { role: 'ADMIN', department: 'DESENVOLVIMENTO_PROCESSOS' };
    const markup = render('READY', false, 'ENGENHARIA');
    expect(markup).toContain('Engenharia');
    expect(markup).not.toContain('PPAP');
    expect(render('READY', true)).not.toContain('Recusar etapa');
  });
  it.each([null, 'DESENVOLVIMENTO_PROCESSOS', 'FERRAMENTARIA', 'QUALIDADE', 'AMOSTRA'] as const)('hides every decline action from a super admin in %s', (department) => {
    auth.user = { role: 'SUPER_ADMIN', department };
    expect(render()).not.toContain('Recusar etapa');
  });
  it('offers both PCP steps independently and no actions to Comercial', () => {
    auth.user = { role: 'ADMIN', department: 'PCP' };
    expect(render().match(/Recusar etapa/g)).toHaveLength(2);
    auth.user = { role: 'ADMIN', department: 'COMERCIAL' };
    expect(render()).not.toContain('Recusar etapa');
  });
});
