import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { AdminContext } from '../../common/auth/admin-context';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { contains, toPage, uuidOrUndefined } from '../../common/utils/query.utils';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  module: string;
  action: string;
  targetId?: string | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
  /** Used when there is no authenticated actor (e.g. failed login). */
  actorEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export function mapAudit(a: AuditLog) {
  return {
    id: a.id,
    admin_id: a.adminId,
    admin: a.adminEmail,
    role: a.adminRole,
    module: a.module,
    action: a.action,
    target_id: a.targetId,
    reason: a.reason,
    metadata: a.metadata,
    ip: a.ip,
    created: a.createdAt,
  };
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an audit event. Pass the transaction client so the event commits atomically with the mutation.
   */
  record(db: Prisma.TransactionClient, actor: AdminContext | null, e: AuditEntry) {
    return db.auditLog.create({
      data: {
        adminId: actor?.id ?? null,
        adminEmail: actor?.email ?? e.actorEmail ?? null,
        adminRole: actor?.role ?? null,
        module: e.module,
        action: e.action,
        targetId: e.targetId ?? null,
        reason: e.reason ?? null,
        metadata: e.metadata,
        ip: actor?.ip ?? e.ip ?? null,
        userAgent: actor?.userAgent ?? e.userAgent ?? null,
      },
    });
  }

  async list(q: ListQueryDto) {
    const where: Prisma.AuditLogWhereInput = q.q
      ? {
          OR: [
            { action: contains(q.q) },
            { module: contains(q.q) },
            { adminEmail: contains(q.q) },
            { targetId: contains(q.q) },
            { reason: contains(q.q) },
            ...(uuidOrUndefined(q.q) ? [{ id: q.q }] : []),
          ],
        }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.offset, take: q.limit }),
      this.prisma.auditLog.count({ where }),
    ]);
    return toPage(rows.map(mapAudit), total, q);
  }

  async recent(take = 10) {
    const rows = await this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take });
    return rows.map(mapAudit);
  }

  async get(id: string) {
    const row = await this.prisma.auditLog.findUniqueOrThrow({ where: { id } });
    return mapAudit(row);
  }
}
