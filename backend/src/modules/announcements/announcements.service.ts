import { Injectable, NotFoundException } from '@nestjs/common';
import { Announcement, AnnouncementAudience, Prisma } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AdminContext } from '../../common/auth/admin-context';
import { AuditReason } from '../../common/dto/action.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { contains, toPage } from '../../common/utils/query.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/** POST /api/platform/announcements/save - omit `id` to create. */
export class SaveAnnouncementDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  @IsEnum(AnnouncementAudience)
  audience: AnnouncementAudience;

  @IsBoolean()
  active: boolean;

  @AuditReason()
  reason: string;
}

/** Response shape: id, title, body, audience, active, updated */
export function mapAnnouncement(a: Announcement) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    audience: a.audience,
    active: a.active,
    created: a.createdAt,
    updated: a.updatedAt,
  };
}

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListQueryDto) {
    const where: Prisma.AnnouncementWhereInput = q.q ? { OR: [{ title: contains(q.q) }, { body: contains(q.q) }] } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: q.offset, take: q.limit }),
      this.prisma.announcement.count({ where }),
    ]);
    return toPage(rows.map(mapAnnouncement), total, q);
  }

  async get(id: string) {
    const row = await this.prisma.announcement.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Announcement not found');
    return mapAnnouncement(row);
  }

  async save(dto: SaveAnnouncementDto, actor: AdminContext) {
    const data = { title: dto.title.trim(), body: dto.body, audience: dto.audience, active: dto.active };
    return this.prisma.$transaction(async (tx) => {
      let before: Announcement | null = null;
      let after: Announcement;
      if (dto.id) {
        before = await tx.announcement.findUnique({ where: { id: dto.id } });
        if (!before) throw new NotFoundException('Announcement not found');
        after = await tx.announcement.update({ where: { id: dto.id }, data });
      } else {
        after = await tx.announcement.create({ data: { ...data, createdById: actor.id } });
      }
      await this.audit.record(tx, actor, {
        module: 'announcements',
        action: dto.id ? 'announcements.update' : 'announcements.create',
        targetId: after.id,
        reason: dto.reason,
        metadata: { before: before ? { active: before.active, audience: before.audience } : null, after: { active: after.active, audience: after.audience } },
      });
      return mapAnnouncement(after);
    });
  }
}
