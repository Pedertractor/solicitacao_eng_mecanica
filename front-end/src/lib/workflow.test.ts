import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkflowTimeline } from '@/components/workflow/WorkflowTimeline';
import { EMPTY_COMERCIAL_FILTERS, filterComercialItems } from '@/pages/Workflow/comercial-filters';
import type { Solicitation, SolicitationWorkflow, WorkflowStageItem, WorkflowStageKind } from '@/services/solicitation';
import { workflowCanStart } from './workflow';

function stage(kind: WorkflowStageKind, status: WorkflowStageItem['status'], order = 0): WorkflowStageItem {
  return { id: kind, stage: kind, status, order, plannedStartAt: null, plannedEndAt: null,
    plannedDurationPercentage: null, actualStartAt: null, actualEndAt: null,
    kairoTeamId: null, kairoCardIds: null, kairoSyncedAt: null, kairoSyncedByUserId: null, completedByUserId: null };
}
const workflow: SolicitationWorkflow = { requiresTooling: true, stages: [
  stage('ENGENHARIA', 'IN_PROGRESS'), stage('PCP_FERRAMENTARIA', 'DONE', 1),
  stage('FERRAMENTARIA', 'READY', 2), stage('PCP_AMOSTRA', 'PENDING', 3), stage('AMOSTRA', 'PENDING', 4),
] };

describe('workflow interface', () => {
  it('enables tooling alone and includes it in Commercial board filters for the new flow', () => {
    const direct: SolicitationWorkflow = { kind: 'COMMERCIAL_DIRECT_TOOLING', requiresTooling: true,
      stages: [stage('FERRAMENTARIA', 'READY')] };
    expect(workflowCanStart(direct, 'FERRAMENTARIA')).toBe(true);
    const markup = renderToStaticMarkup(createElement(WorkflowTimeline, { workflow: direct }));
    expect(markup).toContain('Ferramentaria');
    for (const label of ['PCP', 'Engenharia', 'Amostra', 'Qualidade', 'Em paralelo']) expect(markup).not.toContain(label);
    const item = { workflow: direct, title: 'Simulação Comercial', trackingCode: 'TEST', requesterName: 'Test', client: null } as Solicitation;
    expect(filterComercialItems([item], { ...EMPTY_COMERCIAL_FILTERS, stage: 'FERRAMENTARIA' }, 'board')).toEqual([item]);
    expect(filterComercialItems([item], { ...EMPTY_COMERCIAL_FILTERS, stage: 'PCP_FERRAMENTARIA' }, 'board')).toEqual([]);
  });
  it('shows the direct route in sequence and gates tooling on PCP alone', () => {
    const direct: SolicitationWorkflow = { requiresTooling: true, stages: [
      stage('PCP_FERRAMENTARIA', 'READY'), stage('FERRAMENTARIA', 'PENDING', 1),
    ] };
    expect(workflowCanStart(direct, 'PCP_FERRAMENTARIA')).toBe(true);
    expect(workflowCanStart(direct, 'FERRAMENTARIA')).toBe(false);
    const markup = renderToStaticMarkup(createElement(WorkflowTimeline, { workflow: direct }));
    expect(markup).toContain('PCP · Ferramentaria');
    expect(markup).not.toContain('Em paralelo');
    expect(markup).not.toContain('Engenharia');
    expect(markup).not.toContain('Amostra');
    expect(markup).not.toContain('Qualidade');
    direct.stages[0].status = 'DONE';
    expect(workflowCanStart(direct, 'FERRAMENTARIA')).toBe(true);
    direct.stages[0].status = 'REJECTED';
    expect(workflowCanStart(direct, 'FERRAMENTARIA')).toBe(true);
  });
  it('offers tooling while engineering is still open but keeps the sample blocked', () => {
    expect(workflowCanStart(workflow, 'FERRAMENTARIA')).toBe(true);
    expect(workflowCanStart(workflow, 'PCP_AMOSTRA')).toBe(false);
    expect(workflowCanStart(workflow, 'AMOSTRA')).toBe(false);
  });
  it('shows parallel branches with tooling and a sequential flow without tooling', () => {
    const parallel = renderToStaticMarkup(createElement(WorkflowTimeline, { workflow }));
    expect(parallel).toContain('Em paralelo');
    expect(parallel).toContain('Após concluir as duas frentes');
    expect(parallel).toContain('PCP · Ferramentaria');
    expect(parallel).toContain('PCP · Amostra');
    const sequential = renderToStaticMarkup(createElement(WorkflowTimeline, { workflow: {
      requiresTooling: false, stages: [stage('ENGENHARIA', 'DONE'), stage('PCP_AMOSTRA', 'READY', 1), stage('AMOSTRA', 'PENDING', 2)],
    } }));
    expect(sequential).not.toContain('Em paralelo');
    expect(sequential).toContain('Aguardando PCP · Amostra');
  });
  it.each([false, true])('shows Quality as an independent branch and blocks Amostra (tooling=%s)', (requiresTooling) => {
    const flow: SolicitationWorkflow = { requiresTooling, stages: [
      stage('ENGENHARIA', 'DONE'),
      ...(requiresTooling ? [stage('PCP_FERRAMENTARIA', 'DONE', 1), stage('FERRAMENTARIA', 'DONE', 2)] : []),
      stage('PCP_AMOSTRA', 'DONE', 3), stage('QUALIDADE', 'READY', 4), stage('AMOSTRA', 'PENDING', 5),
    ] };
    expect(workflowCanStart(flow, 'QUALIDADE')).toBe(true);
    expect(workflowCanStart(flow, 'AMOSTRA')).toBe(false);
    const markup = renderToStaticMarkup(createElement(WorkflowTimeline, { workflow: flow }));
    expect(markup).toContain('Disponível desde a criação');
    expect(markup).toContain('Aguardando Qualidade · PPAP');
    const item = { id: 'quality', workflow: flow } as Solicitation;
    expect(filterComercialItems([item], { ...EMPTY_COMERCIAL_FILTERS, stage: 'QUALIDADE' }, 'board')).toHaveLength(1);
    flow.stages.find((item) => item.stage === 'QUALIDADE')!.status = 'DONE';
    expect(workflowCanStart(flow, 'AMOSTRA')).toBe(true);
  });
  it('finds active parallel stages when filtering the board', () => {
    const item = { id: 'test', workflow } as Solicitation;
    expect(filterComercialItems([item], { ...EMPTY_COMERCIAL_FILTERS, stage: 'FERRAMENTARIA' }, 'board')).toHaveLength(1);
    expect(filterComercialItems([item], { ...EMPTY_COMERCIAL_FILTERS, stage: 'ENGENHARIA' }, 'board')).toHaveLength(1);
    expect(filterComercialItems([item], { ...EMPTY_COMERCIAL_FILTERS, stage: 'PCP_FERRAMENTARIA' }, 'board')).toHaveLength(0);
  });
});

it('shows rejection history and never offers a declined stage for work', () => {
  const rejected = { ...stage('ENGENHARIA', 'REJECTED'), rejectionReason: 'Sem necessidade', rejectedByName: 'Maria', rejectedAt: '2026-10-26T12:00:00Z', plannedEndAt: '2020-01-01T00:00:00Z' };
  const flow: SolicitationWorkflow = { requiresTooling: false, stages: [rejected, stage('PCP_AMOSTRA', 'PENDING', 1), stage('AMOSTRA', 'PENDING', 2)] };
  expect(workflowCanStart(flow, 'ENGENHARIA')).toBe(false);
  expect(workflowCanStart(flow, 'PCP_AMOSTRA')).toBe(true);
  expect(workflowCanStart(flow, 'AMOSTRA')).toBe(false);
  const markup = renderToStaticMarkup(createElement(WorkflowTimeline, { workflow: flow }));
  expect(markup).toContain('Recusada');
  expect(markup).toContain('Sem necessidade');
  expect(markup).toContain('Maria');
  expect(markup).not.toContain('Atrasada');
  expect(markup).not.toContain('Aguardando Engenharia');
});
