import { Prisma, PrismaClient, type AppSetting } from '../../generated/prisma/client.js';

export const EMAIL_CC_SETTING_KEY = 'email.cc';

export class SettingsPrismaRepository {
  constructor(private prisma: PrismaClient | Prisma.TransactionClient) {}

  async findByKey(key: string): Promise<AppSetting | null> {
    return await this.prisma.appSetting.findUnique({ where: { key } });
  }

  async upsertByKey(input: {
    key: string;
    value: string;
    updatedBy?: string | null;
  }): Promise<AppSetting> {
    return await this.prisma.appSetting.upsert({
      where: { key: input.key },
      create: {
        key: input.key,
        value: input.value,
        updatedBy: input.updatedBy ?? null,
      },
      update: {
        value: input.value,
        updatedBy: input.updatedBy ?? null,
      },
    });
  }
}
