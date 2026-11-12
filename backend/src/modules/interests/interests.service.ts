import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InterestStage, Prisma } from '@prisma/client';
import { AdminContext } from '../../common/auth/admin-context';
import { ActionDto } from '../../common/dto/action.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { contains, ensureAction, toPage, uuidOrUndefined } from '../../common/utils/query.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export const INTEREST_ACTIONS = ['close'] as const;

const interestInclude = { property: { select: { title: true } } } satisfies Prisma.InterestInclude;
type InterestRow = Prisma.InterestGetPayload<{ include: typeof interestInclude }>;

/**
 * Response shape: id, property_id, status, stage, messages, created.
 * `messages` is a COUNT only - private message content is never exposed to admins.
 */
export function mapInterest(i: InterestRow) {
  return {
    id: i.id,
    property_id: i.propertyId,
    property_title: i.property.title,
    buyer_id: i.buyerId,
    status: i.status,
    stage: i.stage,
    messages: i.messageCount,
    site_visit_at: i.siteVisitAt,
    closed_at: i.closedAt,
    created: i.createdAt,
  };
}

@Injectable()
export class InterestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListQueryDto) {
    const id = uuidOrUndefined(q.q);
    const stage = Object.values(InterestStage).find((s) => s === q.q);
    const where: Prisma.InterestWhereInput = q.q
      ? {
          OR: [
            { property: { title: contains(q.q) } },
            ...(stage ? [{ stage }] : []),
            ...(id ? [{ id }, { propertyId: id }] : []),
          ],
        }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.interest.findMany({ where, include: interestInclude, orderBy: { createdAt: 'desc' }, skip: q.offset, take: q.limit }),
      this.prisma.interest.count({ where }),
    ]);
    return toPage(rows.map(mapInterest), total, q);
  }

  async get(id: string) {
    const row = await this.prisma.interest.findUnique({ where: { id }, include: interestInclude });
    if (!row) throw new NotFoundException('Interest not found');
    return mapInterest(row);
  }

  async act(id: string, dto: ActionDto, actor: AdminContext) {
    const action = ensureAction(dto.action, INTEREST_ACTIONS);
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.interest.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Interest not found');
      if (before.status === 'closed') throw new ConflictException('Interest is already closed');
      const after = await tx.interest.update({
        where: { id },
        data: { status: 'closed', stage: 'closed', closedAt: new Date() },
        include: interestInclude,
      });
      await this.audit.record(tx, actor, {
        module: 'interests',
        action: `interests.${action}`,
        targetId: id,
        reason: dto.reason,
        metadata: { before: { status: before.status, stage: before.stage } },
      });
      return mapInterest(after);
    });
  }
}
