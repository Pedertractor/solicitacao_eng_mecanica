import { sendMail } from './mailer.js';
import { SettingsService } from '../services/settings-service.js';
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

  let cc: string[] = [];
  try {
    cc = await new SettingsService().getEmailCc();
  } catch (error) {
    console.error('[mail] Falha ao carregar e-mails em cópia:', error);
  }

  const ccWithoutRecipient = cc.filter(
    (item) => item.toLowerCase() !== email.toLowerCase(),
  );

  try {
    if (kind === 'approved') {
      await sendMail({
        to: email,
        cc: ccWithoutRecipient,
        subject: approvedMailSubject(payload.trackingCode),
        html: approvedMailHtml(payload),
      });
    } else {
      await sendMail({
        to: email,
        cc: ccWithoutRecipient,
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
