import { auditActionLabel } from '@/utils/status-labels';

export function safetyHistoryActionLabel(action: string): string {
  return auditActionLabel(action);
}

export function formatHistoryActor(metadata: {
  actor?: { name: string; identifier: string };
  userName?: string | null;
} | null): string {
  if (metadata?.actor?.name) {
    const identifier = metadata.actor.identifier?.trim();
    return identifier
      ? `${metadata.actor.name} (${identifier})`
      : metadata.actor.name;
  }
  if (metadata?.userName) return metadata.userName;
  return '—';
}

export function formatHistoryChangedFields(fields?: string[] | null): string {
  if (!fields || fields.length === 0) return '—';
  return fields.join(', ');
}
