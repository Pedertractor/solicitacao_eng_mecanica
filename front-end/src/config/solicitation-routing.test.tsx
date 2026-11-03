import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SolicitationWorkflowPreview } from '@/components/SolicitationWorkflowPreview';
import { emptyProcessInstructionDraft } from './process-instruction-draft';
import { buildSolicitationPreview, changeSolicitationRequester, changeSolicitationDestination, validateSolicitationRouting, type SolicitationRoute } from './solicitation-routing';
import { SolicitationRoutingStep } from '@/components/SolicitationRoutingStep';

const commercial: SolicitationRoute = { destination: 'DESENVOLVIMENTO_PROCESSOS', requester: 'Comercial', type: 'Desenvolvimento Amostra', requiresTooling: false, directTooling: false };

describe('solicitation routing preview', () => {
  it('offers tooling alongside engineering with Commercial fixed and no workflow options', () => {
    const draft = changeSolicitationDestination(emptyProcessInstructionDraft(), '', 'FERRAMENTARIA');
    const markup = renderToStaticMarkup(createElement(SolicitationRoutingStep, {
      destination: 'FERRAMENTARIA', value: draft, errors: {}, onChange: () => {}, onDestinationChange: () => {},
    }));
    for (const label of ['Engenharia Mecânica', 'Engenharia de Processos', 'Ferramentaria', 'Comercial']) expect(markup).toContain(label);
    for (const label of ['Produção', 'Qualidade', 'Requer ferramentaria', 'Ajuste o caminho']) expect(markup).not.toContain(label);
    const route = { ...draft, destination: 'FERRAMENTARIA' as const };
    expect(validateSolicitationRouting(route)).toEqual({});
    expect(validateSolicitationRouting({ ...route, requester: 'Produção' })).toHaveProperty('requester');
    expect(buildSolicitationPreview(route).lanes.flat().map((node) => node.kind)).toEqual(['tooling']);
  });

  it('clears incompatible choices when entering and leaving tooling while preserving details', () => {
    const original = { ...emptyProcessInstructionDraft(), requester: 'Produção', process: 'Dobra',
      type: 'Atualização de Blank', deliveryDate: '2026-12-01', directTooling: true, requiresTooling: true,
      client: 'PEDERTRACTOR' as const, comments: 'Preservar', executionUnit: 'TRACTOR' as const };
    const tooling = changeSolicitationDestination(original, 'DESENVOLVIMENTO_PROCESSOS', 'FERRAMENTARIA');
    expect(tooling).toMatchObject({ requester: 'Comercial', type: 'Simulação Comercial', process: '', deliveryDate: '',
      directTooling: false, requiresTooling: false, client: 'PEDERTRACTOR', comments: 'Preservar' });
    expect(changeSolicitationDestination(tooling, 'FERRAMENTARIA', 'DESENVOLVIMENTO_PROCESSOS')).toMatchObject({ type: '', process: '' });
    expect(changeSolicitationDestination(tooling, 'FERRAMENTARIA', 'ENG_MECANICA')).toMatchObject({ type: '', process: '', executionUnit: '' });
  });
  it('shows the parallel workflow before a type is selected', () => {
    expect(buildSolicitationPreview({ ...commercial, type: '' }).mode).toBe('sample');
  });

  it('shows Engineering only for simulations even with stale routing flags', () => {
    const route = { ...commercial, type: 'Simulação Comercial', directTooling: true, requiresTooling: true };
    expect(buildSolicitationPreview(route).lanes.flat().map((node) => node.kind)).toEqual(['engineering']);
    const markup = renderToStaticMarkup(createElement(SolicitationWorkflowPreview, { route }));
    expect(markup).toContain('A Engenharia avaliará');
    for (const omitted of ['PCP', 'Amostra', 'Qualidade']) expect(markup).not.toContain(omitted);
  });

  it('requires both routing choices before entering the details step', () => {
    expect(validateSolicitationRouting({ ...commercial, destination: '', requester: '' })).toEqual({
      destination: 'Selecione o destino da solicitação.', requester: 'Selecione o departamento solicitante.',
    });
    expect(validateSolicitationRouting(commercial)).toEqual({});
    const route = { ...commercial, destination: '' as const, requester: '' };
    const preview = buildSolicitationPreview(route);
    expect(preview.mode).toBe('sample');
    expect(preview.lanes.map((lane) => lane.map((node) => node.kind))).toEqual([['engineering'], ['pcp', 'tooling', 'pcp'], ['quality']]);
    const markup = renderToStaticMarkup(createElement(SolicitationWorkflowPreview, { route }));
    for (const label of ['Engenharia', 'PCP', 'Ferramentaria', 'Qualidade', 'Amostra', 'Exemplo do fluxo de Processos']) expect(markup).toContain(label);
  });

  it.each(['ENG_MECANICA', 'DESENVOLVIMENTO_PROCESSOS'] as const)('uses a single destination team for a non-Comercial %s request', (destination) => {
    const preview = buildSolicitationPreview({ ...commercial, destination, requester: 'Produção' });
    expect(preview.mode).toBe('single');
    expect(preview.lanes.flat().map((node) => node.label)).toEqual([destination === 'ENG_MECANICA' ? 'Engenharia Mecânica' : 'Engenharia de Processos']);
  });

  it('does not show the Comercial production workflow for mechanical requests', () => {
    expect(buildSolicitationPreview({ ...commercial, destination: 'ENG_MECANICA', directTooling: true }).mode).toBe('single');
  });

  it('shows Quality in parallel and puts sample planning after Engineering without tooling', () => {
    const preview = buildSolicitationPreview(commercial);
    expect(preview.mode).toBe('sample');
    expect(preview.lanes.map((lane) => lane.map((node) => node.kind))).toEqual([['engineering', 'pcp'], ['quality']]);
  });

  it('shows independent Engineering, tooling planning and Quality branches when tooling is required', () => {
    const preview = buildSolicitationPreview({ ...commercial, requiresTooling: true });
    expect(preview.lanes.map((lane) => lane.map((node) => node.kind))).toEqual([['engineering'], ['pcp', 'tooling', 'pcp'], ['quality']]);
    const markup = renderToStaticMarkup(createElement(SolicitationWorkflowPreview, { route: { ...commercial, requiresTooling: true } }));
    expect(markup).toContain('Frentes em paralelo');
    expect(markup).toContain('Todas as frentes se encontram aqui');
    expect(markup).toContain('Amostra');
  });

  it('shows only PCP and tooling on the direct route, finishing there', () => {
    const route = { ...commercial, requiresTooling: true, directTooling: true };
    expect(buildSolicitationPreview(route).lanes.flat().map((node) => node.kind)).toEqual(['pcp', 'tooling']);
    const markup = renderToStaticMarkup(createElement(SolicitationWorkflowPreview, { route }));
    expect(markup).toContain('Solicitação concluída');
    for (const omitted of ['Engenharia', 'Amostra', 'Qualidade', 'Frentes em paralelo']) expect(markup).not.toContain(omitted);
  });

  it('clears stale route and process choices when changing the requester but keeps entered details', () => {
    const draft = { ...emptyProcessInstructionDraft(), requester: 'Comercial', directTooling: true, requiresTooling: true,
      executionUnit: 'TRACTOR' as const, process: 'Engenharia', type: 'Desenvolvimento Amostra', deliveryDate: '2026-12-01', comments: 'Preservar os detalhes', allocatedPartNumbers: ['123'] };
    expect(changeSolicitationRequester(draft, 'Produção')).toMatchObject({
      requester: 'Produção', directTooling: false, requiresTooling: false, executionUnit: '',
      process: '', type: '', deliveryDate: '', comments: 'Preservar os detalhes', allocatedPartNumbers: ['123'],
    });
    expect(changeSolicitationRequester(draft, 'Comercial')).toBe(draft);
  });
});
