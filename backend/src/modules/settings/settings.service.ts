import { Injectable } from '@nestjs/common';
import { PlatformSettings, Prisma } from '@prisma/client';
import { IsBoolean, IsOptional } from 'class-validator';
import { AdminContext } from '../../common/auth/admin-context';
import { AuditReason } from '../../common/dto/action.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/** POST /api/platform/settings - send only the flags you want to change. */
export class UpdateSettingsDto {
  @IsOptional() @IsBoolean() publication_enabled?: boolean;
  @IsOptional() @IsBoolean() registration_enabled?: boolean;
  @IsOptional() @IsBoolean() ai_generation_enabled?: boolean;
  @AuditReason() reason: string;
}

/** Provider "status" is only whether a provider is configured via env. It does NOT test connectivity. */
const PROVIDERS = [
  { key: 'ai', label: 'AI summary generation', env: 'AI_PROVIDER' },
  { key: 'storage', label: 'Encrypted document storage', env: 'STORAGE_PROVIDER' },
  { key: 'email', label: 'Email delivery', env: 'EMAIL_PROVIDER' },
  { key: 'sms', label: 'SMS / OTP delivery', env: 'SMS_PROVIDER' },
  { key: 'push', label: 'Push notifications', env: 'PUSH_PROVIDER' },
  { key: 'payments', label: 'Payment settlement', env: 'PAYMENT_PROVIDER' },
  { key: 'title', label: 'Live title procurement', env: 'TITLE_PROVIDER' },
] as const;

const mapSettings = (s: PlatformSettings) => ({
  publication_enabled: s.publicationEnabled,
  registration_enabled: s.registrationEnabled,
  ai_generation_enabled: s.aiGenerationEnabled,
  updated: s.updatedAt,
  updated_by: s.updatedById,
});

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private providers() {
    return PROVIDERS.map((p) => {
      const name = process.env[p.env]?.trim() || null;
      return { key: p.key, label: p.label, provider: name, configured: !!name, connectivity: 'not_verified' as const };
    });
  }

  private ensureRow(db: Prisma.TransactionClient) {
    return db.platformSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  }

  async get() {
    const s = await this.ensureRow(this.prisma);
    return { settings: mapSettings(s), providers: this.providers() };
  }

  async update(dto: UpdateSettingsDto, actor: AdminContext) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.ensureRow(tx);
      const after = await tx.platformSettings.update({
        where: { id: 1 },
        data: {
          publicationEnabled: dto.publication_enabled,
          registrationEnabled: dto.registration_enabled,
          aiGenerationEnabled: dto.ai_generation_enabled,
          updatedById: actor.id,
        },
      });
      await this.audit.record(tx, actor, {
        module: 'settings',
        action: 'settings.update',
        targetId: '1',
        reason: dto.reason,
        metadata: { before: mapSettings(before), after: mapSettings(after) } as unknown as Prisma.InputJsonValue,
      });
      return { settings: mapSettings(after), providers: this.providers() };
    });
  }
}
