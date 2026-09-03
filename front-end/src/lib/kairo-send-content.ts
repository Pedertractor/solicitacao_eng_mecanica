import type { Solicitation } from '@/services/solicitation';

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

  return lines.join('\n');
}
