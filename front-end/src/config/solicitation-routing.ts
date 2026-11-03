import { PROCESS_REQUESTERS } from '@/config/process-instruction';
import type { ProcessInstructionDraft } from '@/config/process-instruction-draft';

export type SolicitationDestination = 'ENG_MECANICA' | 'DESENVOLVIMENTO_PROCESSOS' | 'FERRAMENTARIA';
export type SolicitationRoutingErrors = { destination?: string; requester?: string };
export type SolicitationRoute = Pick<ProcessInstructionDraft, 'requester' | 'requiresTooling' | 'directTooling'> & {
  destination: SolicitationDestination | '';
  type?: string;
};
export type PreviewNode = {
  kind: 'engineering' | 'pcp' | 'tooling' | 'quality' | 'sample';
  label: string;
  description: string;
};

export const SOLICITATION_DESTINATIONS = [
  { value: 'ENG_MECANICA', label: 'Engenharia Mecânica', description: 'Projetos, melhorias e serviços de engenharia.' },
  { value: 'DESENVOLVIMENTO_PROCESSOS', label: 'Engenharia de Processos', description: 'Instruções, desenvolvimento e fluxos de produção.' },
  { value: 'FERRAMENTARIA', label: 'Ferramentaria', description: 'Simulação Comercial diretamente com a Ferramentaria.' },
] as const;

export function validateSolicitationRouting(route: SolicitationRoute): SolicitationRoutingErrors {
  const errors: SolicitationRoutingErrors = {};
  if (!SOLICITATION_DESTINATIONS.some((item) => item.value === route.destination)) errors.destination = 'Selecione o destino da solicitação.';
  if (!PROCESS_REQUESTERS.some((item) => item === route.requester)) errors.requester = 'Selecione o departamento solicitante.';
  if (route.destination === 'FERRAMENTARIA' && route.requester !== 'Comercial') errors.requester = 'Ferramentaria disponível para Comercial.';
  return errors;
}

export function changeSolicitationRequester(draft: ProcessInstructionDraft, requester: string): ProcessInstructionDraft {
  if (draft.requester === requester) return draft;
  return { ...draft, requester, process: '', type: '', deliveryDate: '',
    executionUnit: requester === 'Comercial' ? draft.executionUnit : '',
    directTooling: requester === 'Comercial' ? draft.directTooling : false,
    requiresTooling: requester === 'Comercial' ? draft.requiresTooling : false };
}

export function changeSolicitationDestination(draft: ProcessInstructionDraft, previous: SolicitationDestination | '', destination: SolicitationDestination): ProcessInstructionDraft {
  if (previous === destination) return draft;
  const next = previous === 'FERRAMENTARIA' || destination === 'FERRAMENTARIA'
    ? { ...draft, process: '', type: '', deliveryDate: '', directTooling: false, requiresTooling: false }
    : draft;
  if (destination === 'FERRAMENTARIA') return { ...next, requester: 'Comercial', type: 'Simulação Comercial' };
  if (destination === 'ENG_MECANICA') return { ...next, directTooling: false, requiresTooling: false, executionUnit: '' };
  return next;
}

export function buildSolicitationPreview(route: SolicitationRoute): {
  mode: 'simulation' | 'single' | 'direct' | 'sample';
  title: string;
  description: string;
  lanes: PreviewNode[][];
} {
  if (!route.destination || !route.requester) return buildSolicitationPreview({
    destination: 'DESENVOLVIMENTO_PROCESSOS', requester: 'Comercial',
    type: 'Desenvolvimento Amostra', requiresTooling: true, directTooling: false,
  });
  if (route.destination === 'FERRAMENTARIA') return {
    mode: 'direct', title: 'Comercial → Ferramentaria',
    description: 'A Ferramentaria recebe a Simulação Comercial, executa e encerra o chamado.',
    lanes: [[{ kind: 'tooling', label: 'Ferramentaria', description: 'Simulação Comercial' }]],
  };
  if (route.destination === 'ENG_MECANICA' || route.requester !== 'Comercial') return {
    mode: 'single', title: 'Um caminho direto até a solução.',
    description: 'A equipe de destino recebe, analisa e executa a solicitação.',
    lanes: [[{ kind: 'engineering', label: route.destination === 'ENG_MECANICA' ? 'Engenharia Mecânica' : 'Engenharia de Processos', description: 'Análise e execução' }]],
  };
  if (route.type === 'Simulação Comercial') return { mode: 'simulation', title: 'Simulação com a Engenharia.',
    description: 'A Engenharia avaliará a necessidade de envolver a Ferramentaria. As equipes poderão trabalhar em paralelo.',
    lanes: [[{ kind: 'engineering', label: 'Engenharia', description: 'Simulação Comercial' }]],
  };
  if (route.directTooling) return { mode: 'direct', title: 'Do planejamento à Ferramentaria.',
    description: 'PCP planeja o trabalho. Ferramentaria executa e encerra o chamado.',
    lanes: [[{ kind: 'pcp', label: 'PCP', description: 'Planejamento' }, { kind: 'tooling', label: 'Ferramentaria', description: 'Execução' }]],
  };
  const engineering: PreviewNode = { kind: 'engineering', label: 'Engenharia', description: 'Desenvolvimento' };
  const quality: PreviewNode = { kind: 'quality', label: 'Qualidade', description: 'PPAP' };
  const samplePcp: PreviewNode = { kind: 'pcp', label: 'PCP', description: 'Amostra' };
  return { mode: 'sample', title: 'Frentes conectadas. Uma entrega.',
    description: 'As frentes avançam em paralelo. A Amostra começa quando todas as etapas anteriores forem concluídas ou recusadas.',
    lanes: route.requiresTooling
      ? [[engineering], [{ kind: 'pcp', label: 'PCP', description: 'Ferramental' },
        { kind: 'tooling', label: 'Ferramentaria', description: 'Execução' }, samplePcp], [quality]]
      : [[engineering, samplePcp], [quality]],
  };
}
