import { Injectable, NotFoundException } from '@nestjs/common';
import { ListingSummary, Prisma } from '@prisma/client';
import { AdminContext } from '../../common/auth/admin-context';
import { ActionDto } from '../../common/dto/action.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { contains, ensureAction, toPage, uuidOrUndefined } from '../../common/utils/query.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export const SUMMARY_ACTIONS = ['approve', 'block', 'unblock'] as const;

/** Response shape: id, property_id, source_version, language, kind, summary, approved, blocked, created */
export function mapSummary(s: ListingSummary) {
  return {
    id: s.id,
    property_id: s.propertyId,
    source_version: s.sourceVersion,
    language: s.language,
    kind: s.kind,
    summary: s.summary,
    approved: s.approved,
    blocked: s.blocked,
    created: s.createdAt,
    updated: s.updatedAt,
  };
}

@Injectable()
export class SummariesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListQueryDto) {
    const id = uuidOrUndefined(q.q);
    const where: Prisma.ListingSummaryWhereInput = q.q
      ? {
          OR: [
            { summary: contains(q.q) },
            { language: contains(q.q) },
            { kind: contains(q.q) },
            ...(id ? [{ id }, { propertyId: id }] : []),
          ],
        }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.listingSummary.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.offset, take: q.limit }),
      this.prisma.listingSummary.count({ where }),
    ]);
    return toPage(rows.map(mapSummary), total, q);
  }

  async get(id: string) {
    const row = await this.prisma.listingSummary.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Summary not found');
    return mapSummary(row);
  }

  async act(id: string, dto: ActionDto, actor: AdminContext) {
    const action = ensureAction(dto.action, SUMMARY_ACTIONS);
    const data: Prisma.ListingSummaryUpdateInput =
      action === 'approve' ? { approved: true, blocked: false } : { blocked: action === 'block' };

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.listingSummary.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Summary not found');
      const after = await tx.listingSummary.update({ where: { id }, data });
      await this.audit.record(tx, actor, {
        module: 'summaries',
        action: `summaries.${action}`,
        targetId: id,
        reason: dto.reason,
        metadata: {
          before: { approved: before.approved, blocked: before.blocked },
          after: { approved: after.approved, blocked: after.blocked },
        },
      });
      return mapSummary(after);
    });
  }
}
