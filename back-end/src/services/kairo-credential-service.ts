import { prisma } from '../lib/prisma.js';
import { decryptSecret, encryptSecret } from '../lib/secret-crypto.js';
import { HttpError } from '../https/errors/index.js';
import { KairoClient } from '../integrations/kairo-client.js';

function mapCredentialStatus(row: {
  keyPrefix: string;
  linkedAt: Date;
  lastValidatedAt: Date | null;
} | null) {
  if (!row) {
    return { linked: false as const };
  }

  return {
    linked: true as const,
    keyPrefix: row.keyPrefix,
    linkedAt: row.linkedAt.toISOString(),
    lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null,
  };
}

export class KairoCredentialService {
  async getStatus(userId: string) {
    const row = await prisma.userKairoCredential.findUnique({
      where: { userId },
    });
    return mapCredentialStatus(row);
  }

  async link(userId: string, apiKey: string) {
    const trimmed = apiKey.trim();
    if (!trimmed.startsWith('kairo_')) {
      throw new HttpError('Chave de API do Kairo inválida', 400);
    }

    const client = new KairoClient(trimmed);
    await client.getMe();

    const keyPrefix = trimmed.slice(0, 12);
    const apiKeyEncrypted = encryptSecret(trimmed);
    const now = new Date();

    await prisma.userKairoCredential.upsert({
      where: { userId },
      create: {
        userId,
        apiKeyEncrypted,
        keyPrefix,
        linkedAt: now,
        lastValidatedAt: now,
      },
      update: {
        apiKeyEncrypted,
        keyPrefix,
        linkedAt: now,
        lastValidatedAt: now,
      },
    });

    return this.getStatus(userId);
  }

  async unlink(userId: string) {
    await prisma.userKairoCredential.deleteMany({ where: { userId } });
    return { linked: false as const };
  }

  async getClientForUser(userId: string): Promise<KairoClient> {
    const client = await this.tryGetClientForUser(userId);

    if (!client) {
      throw new HttpError(
        'Vincule sua chave de API do Kairo em Integrações antes de continuar',
        400,
      );
    }

    return client;
  }

  async tryGetClientForUser(userId: string): Promise<KairoClient | null> {
    const row = await prisma.userKairoCredential.findUnique({
      where: { userId },
    });

    if (!row) {
      return null;
    }

    return new KairoClient(decryptSecret(row.apiKeyEncrypted));
  }

  async touchValidated(userId: string) {
    await prisma.userKairoCredential.updateMany({
      where: { userId },
      data: { lastValidatedAt: new Date() },
    });
  }
}
