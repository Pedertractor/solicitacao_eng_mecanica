import { prisma } from '../lib/prisma.js';
import {
  EMAIL_CC_SETTING_KEY,
  SettingsPrismaRepository,
} from '../repositories/prisma/settings-repository.js';

function normalizeEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    result.push(email);
  }

  return result;
}

function parseEmailCcValue(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return normalizeEmails(
      parsed.filter((item): item is string => typeof item === 'string'),
    );
  } catch {
    return [];
  }
}

export class SettingsService {
  async getEmailCc(): Promise<string[]> {
    const repo = new SettingsPrismaRepository(prisma);
    const row = await repo.findByKey(EMAIL_CC_SETTING_KEY);
    return parseEmailCcValue(row?.value);
  }

  async setEmailCc(emails: string[], updatedBy?: string): Promise<string[]> {
    const normalized = normalizeEmails(emails);
    const repo = new SettingsPrismaRepository(prisma);
    await repo.upsertByKey({
      key: EMAIL_CC_SETTING_KEY,
      value: JSON.stringify(normalized),
      updatedBy: updatedBy ?? null,
    });
    return normalized;
  }
}
