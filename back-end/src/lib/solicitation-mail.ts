import { sendMail } from './mailer.js';
import {
  approvedMailHtml,
  approvedMailSubject,
  completedMailHtml,
  completedMailSubject,
} from './mail-templates.js';

type NotifyPayload = {
  requesterEmail: string | null | undefined;
  requesterName: string;
  trackingCode: string;
  title: string;
};

async function safeSend(
  kind: 'approved' | 'completed',
  payload: NotifyPayload,
) {
  const email = payload.requesterEmail?.trim();
  if (!email) {
    return;
  }

  try {
    if (kind === 'approved') {
      await sendMail({
        to: email,
        subject: approvedMailSubject(payload.trackingCode),
        html: approvedMailHtml(payload),
      });
    } else {
      await sendMail({
        to: email,
        subject: completedMailSubject(payload.trackingCode),
        html: completedMailHtml(payload),
      });
    }
  } catch (error) {
    console.error(
      `[mail] Falha ao enviar e-mail (${kind}) para ${email} [${payload.trackingCode}]:`,
      error,
    );
  }
}

export async function notifySolicitationApproved(payload: NotifyPayload) {
  await safeSend('approved', payload);
}

export async function notifySolicitationCompleted(payload: NotifyPayload) {
  await safeSend('completed', payload);
}
