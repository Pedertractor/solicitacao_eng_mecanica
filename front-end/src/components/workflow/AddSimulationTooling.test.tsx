import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { Solicitation } from '@/services/solicitation';
import type { UserDepartment, UserRole } from '@/types/auth';
import { AddSimulationTooling } from './AddSimulationTooling';
import { WorkflowTimeline } from './WorkflowTimeline';
import { workflowCanStart } from '@/lib/workflow';

const auth = vi.hoisted(() => ({ user: { role: 'ADMIN' as UserRole, department: 'DESENVOLVIMENTO_PROCESSOS' as UserDepartment | null } }));
vi.mock('@/contexts/useAuth', () => ({ useAuth: () => auth }));
const item = { id: 'test', status: 'APPROVED', workflow: { kind: 'COMMERCIAL_SIMULATION', requiresTooling: false,
  stages: [{ id: 'engineering', stage: 'ENGENHARIA', status: 'IN_PROGRESS', order: 0 }] } } as Solicitation;
function render(value = item) {
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(AddSimulationTooling, { item: value })));
}

describe('simulation tooling actions', () => {
  it.each(['ADMIN', 'SUPER_ADMIN'] as const)('offers inclusion to %s', (role) => {
    auth.user = { role, department: 'DESENVOLVIMENTO_PROCESSOS' };
    expect(render()).toContain('Adicionar Ferramentaria');
  });
  it.each([['USER', 'DESENVOLVIMENTO_PROCESSOS'], ['ADMIN', 'COMERCIAL'], ['ADMIN', 'PCP']] as const)('denies inclusion to %s in %s', (role, department) => {
    auth.user = { role, department };
    expect(render()).not.toContain('Adicionar Ferramentaria');
  });
  it('hides inclusion in other areas, closed stages, legacy modes and after inclusion', () => {
    auth.user = { role: 'ADMIN', department: 'FERRAMENTARIA' };
    expect(render()).toBe('');
    auth.user = { role: 'ADMIN', department: 'DESENVOLVIMENTO_PROCESSOS' };
    expect(render({ ...item, status: 'COMPLETED' })).toBe('');
    expect(render({ ...item, workflow: { ...item.workflow!, kind: 'STANDARD' } })).toBe('');
    expect(render({ ...item, workflow: { ...item.workflow!, stages: [{ ...item.workflow!.stages[0]!, status: 'DONE' }] } })).toBe('');
    expect(render(withTooling())).toBe('');
  });
  function withTooling(): Solicitation {
    return { ...item, workflow: { ...item.workflow!, requiresTooling: true, stages: [...item.workflow!.stages,
      { ...item.workflow!.stages[0]!, id: 'tooling', stage: 'FERRAMENTARIA', status: 'READY', order: 1 }] } };
  }
  it('shows parallel engineering and tooling with no sample or PCP and permits immediate start', () => {
    const workflow = withTooling().workflow!;
    const markup = renderToStaticMarkup(createElement(WorkflowTimeline, { workflow }));
    expect(markup).toContain('Em paralelo');
    expect(markup).toContain('Ferramentaria');
    for (const omitted of ['Amostra', 'PCP', 'Qualidade']) expect(markup).not.toContain(omitted);
    expect(workflowCanStart(workflow, 'FERRAMENTARIA')).toBe(true);
    expect(workflowCanStart({ ...workflow, kind: 'STANDARD' }, 'FERRAMENTARIA')).toBe(false);
  });
});
