import { env } from '../env/index.js';

export type SolicitationMailPayload = {
  requesterName: string;
  trackingCode: string;
  title: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function trackUrl(trackingCode: string) {
  const base = env.PUBLIC_FRONTEND_URL.replace(/\/$/, '');
  return `${base}/solicitacao/acompanhar/${encodeURIComponent(trackingCode)}`;
}

function baseLayout(input: {
  badgeLabel: string;
  badgeBg: string;
  badgeColor: string;
  headline: string;
  bodyHtml: string;
  trackingCode: string;
  title: string;
  requesterName: string;
  showTrackButton?: boolean;
}) {
  const name = escapeHtml(input.requesterName);
  const code = escapeHtml(input.trackingCode);
  const title = escapeHtml(input.title);
  const url = trackUrl(input.trackingCode);

  const trackSection = input.showTrackButton
    ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
                <tr>
                  <td align="center" bgcolor="#0f172a" style="padding:14px 28px;background-color:#0f172a;border-radius:8px;">
                    <a href="${url}" target="_blank" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;line-height:1.25;color:#f8fafc;text-decoration:none;white-space:nowrap;">
                      Acompanhar solicita&ccedil;&atilde;o
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">
                Se o bot&atilde;o n&atilde;o funcionar, copie e cole este link no navegador:<br />
                <a href="${url}" style="color:#64748b;word-break:break-all;">${url}</a>
              </p>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.headline)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#020817;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:#0f172a;padding:24px 28px;">
              <p style="margin:0;font-size:16px;font-weight:600;color:#f8fafc;letter-spacing:-0.01em;">
                Solicitação Engenharia Mecânica
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <span style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:${input.badgeBg};color:${input.badgeColor};font-size:12px;font-weight:600;">
                ${escapeHtml(input.badgeLabel)}
              </span>
              <h1 style="margin:16px 0 8px;font-size:20px;font-weight:600;line-height:1.3;color:#020817;">
                ${escapeHtml(input.headline)}
              </h1>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#64748b;">
                Olá, <strong style="color:#020817;">${name}</strong>.
              </p>
              ${input.bodyHtml}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;">Protocolo</p>
                    <p style="margin:0 0 12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:16px;font-weight:600;color:#020817;">${code}</p>
                    <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;">Título</p>
                    <p style="margin:0;font-size:14px;color:#020817;">${title}</p>
                  </td>
                </tr>
              </table>
              ${trackSection}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                Pedertractor &amp; Tractor — Programação e Automação Pedertractor
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function approvedMailSubject(trackingCode: string) {
  return `Solicitação aprovada — ${trackingCode}`;
}

export function completedMailSubject(trackingCode: string) {
  return `Solicitação concluída — ${trackingCode}`;
}

export function approvedMailHtml(payload: SolicitationMailPayload) {
  return baseLayout({
    badgeLabel: 'Aprovada',
    badgeBg: '#f5f3ff',
    badgeColor: '#5b21b6',
    headline: 'Sua solicitação foi aprovada',
    bodyHtml: `<p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">
      A equipe de engenharia mecânica aprovou sua solicitação. O trabalho seguirá conforme o fluxo interno.
    </p>`,
    trackingCode: payload.trackingCode,
    title: payload.title,
    requesterName: payload.requesterName,
    showTrackButton: true,
  });
}

export function completedMailHtml(payload: SolicitationMailPayload) {
  return baseLayout({
    badgeLabel: 'Concluída',
    badgeBg: '#ecfdf5',
    badgeColor: '#059669',
    headline: 'Sua solicitação foi concluída',
    bodyHtml: `<p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">
      A solicitação foi finalizada pela engenharia mecânica.
    </p>`,
    trackingCode: payload.trackingCode,
    title: payload.title,
    requesterName: payload.requesterName,
    showTrackButton: false,
  });
}
