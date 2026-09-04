import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../env/index.js';

let transporter: Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.CORREIO,
      port: Number(env.PORT_CORREIO),
      secure: false,
      auth: {
        user: env.EMAIL_AUTOMACAO,
        pass: env.PASSWORD_AUTOMACAO,
      },
    });
  }
  return transporter;
}

export async function sendMail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  await getTransporter().sendMail({
    from: `"Solicitação Engenharia Mecânica" <${env.EMAIL_AUTOMACAO}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
