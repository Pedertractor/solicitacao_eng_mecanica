import type { Solicitation } from '@/services/solicitation';
import { workflowPrerequisitesDone } from '@/lib/workflow';

export function productionType(item: Pick<Solicitation, 'processInstructionType' | 'productType'>) {
  if (item.processInstructionType === 'Desenvolvimento Amostra') return 'AMOSTRA';
  if (item.processInstructionType === 'Desenvolvimento Protótipo') return 'PROTOTIPO';
  return item.productType;
}

export function currentProductionStages(item: Pick<Solicitation, 'workflow'>) {
  const workflow = item.workflow;
  if (!workflow) return [];
  const open = [...workflow.stages].sort((a, b) => a.order - b.order)
    .filter((stage) => ['PENDING', 'READY', 'IN_PROGRESS'].includes(stage.status));
  const actionable = open.filter((stage) => stage.status === 'IN_PROGRESS'
    || stage.status === 'READY' || workflowPrerequisitesDone(workflow, stage.stage));
  return actionable.length ? actionable : open.slice(0, 1);
}

export function deliveryDeadline(value: string | null, now = new Date()) {
  if (!value) return { days: null, label: 'Sem prazo definido', tone: 'none' as const };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const days = Math.round((Date.parse(value.slice(0, 10)) - Date.parse(today)) / 86_400_000);
  if (!Number.isFinite(days)) return { days: null, label: 'Sem prazo definido', tone: 'none' as const };
  if (days < 0) return { days, label: `${Math.abs(days)} ${days === -1 ? 'dia de atraso' : 'dias de atraso'}`, tone: 'late' as const };
  if (days === 0) return { days, label: 'Vence hoje', tone: 'today' as const };
  return { days, label: `${days} ${days === 1 ? 'dia para entrega' : 'dias para entrega'}`, tone: 'normal' as const };
}

export function displayDate(value: string | null) {
  if (!value) return '—';
  return value.slice(0, 10).split('-').reverse().join('/');
}
