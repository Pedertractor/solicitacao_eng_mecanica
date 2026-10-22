import { formatIsoDateLabel } from '@/config/process-instruction';
import {
  SOLICITATION_CLIENT_LABELS,
  type Solicitation,
} from '@/services/solicitation';

const UNIT_LABEL: Record<Solicitation['unit'], string> = {
  PEDERTRACTOR: 'P',
  TRACTOR: 'T',
};

/** Normalize names for exact match: case, accents, and whitespace. */
export function normalizeKairoMatchName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function findMatchingKairoOptionId<T extends { id: string; name: string }>(
  options: T[],
  candidateName: string | null | undefined,
): string {
  const target = candidateName?.trim();
  if (!target) return '';
  const normalizedTarget = normalizeKairoMatchName(target);
  const match = options.find(
    (option) => normalizeKairoMatchName(option.name) === normalizedTarget,
  );
  return match?.id ?? '';
}

function pushIfPresent(
  lines: string[],
  label: string,
  value: string | null | undefined,
) {
  const trimmed = value?.trim();
  if (!trimmed) return;
  lines.push(`${label}: ${trimmed}`);
}

export function buildDefaultKairoDescription(
  solicitation: Solicitation,
): string {
  const lines = [
    solicitation.description.trim(),
    '',
    'Protocolo: ' + solicitation.trackingCode,
    'Solicitante: ' + solicitation.requesterName,
    `Centro de custo: ${solicitation.costCenter} (${solicitation.sectorName})`,
    'Pilar/local: ' + solicitation.pillarOrLocation,
  ];

  pushIfPresent(lines, 'E-mail', solicitation.requesterEmail);
  pushIfPresent(lines, 'Cartão', solicitation.cardNumber);
  pushIfPresent(lines, 'Unidade', UNIT_LABEL[solicitation.unit]);

  if (solicitation.client) {
    pushIfPresent(
      lines,
      'Cliente',
      SOLICITATION_CLIENT_LABELS[solicitation.client],
    );
  }

  pushIfPresent(
    lines,
    'Solicitante do processo',
    solicitation.processInstructionRequester,
  );
  pushIfPresent(lines, 'Processo', solicitation.processInstructionProcess);
  pushIfPresent(
    lines,
    'Tipo da instrução',
    solicitation.processInstructionType,
  );

  if (solicitation.deliveryDate) {
    const formatted = formatIsoDateLabel(solicitation.deliveryDate);
    if (formatted !== '—') {
      lines.push(`Data de entrega: ${formatted}`);
    }
  }

  pushIfPresent(lines, 'Part numbers', solicitation.partNumbers);
  pushIfPresent(lines, 'Link de arquivos', solicitation.fileLink);

  if (solicitation.requiresTooling) {
    lines.push('Requer ferramentaria: sim');
  }

  return lines.join('\n');
}
