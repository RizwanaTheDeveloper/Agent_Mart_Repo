import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminContext } from '../../common/auth/admin-context';
import { assertElevated } from '../../common/auth/elevation';
import { ActionDto } from '../../common/dto/action.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { contains, ensureAction, toPage, uuidOrUndefined } from '../../common/utils/query.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export const FIRM_ACTIONS = ['suspend', 'restore'] as const;

const firmInclude = {
  _count: { select: { listings: true, users: { where: { active: true } } } },
  subscriptions: {
    where: { active: true },
    orderBy: { startsAt: 'desc' },
    take: 1,
    include: { plan: { select: { id: true, name: true } } },
  },
} satisfies Prisma.FirmInclude;

type FirmRow = Prisma.FirmGetPayload<{ include: typeof firmInclude }>;

/** Response shape: id, name, activeUsers, listings, suspended, created (+ plan) */
export function mapFirm(f: FirmRow) {
  return {
    id: f.id,
    name: f.name,
    activeUsers: f._count.users,
    listings: f._count.listings,
    suspended: f.suspended,
    suspended_at: f.suspendedAt,
    plan: f.subscriptions[0]?.plan ?? null,
    created: f.createdAt,
  };
}

@Injectable()
export class FirmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListQueryDto) {
    const id = uuidOrUndefined(q.q);
    const where: Prisma.FirmWhereInput = q.q ? { OR: [{ name: contains(q.q) }, ...(id ? [{ id }] : [])] } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.firm.findMany({ where, include: firmInclude, orderBy: { createdAt: 'desc' }, skip: q.offset, take: q.limit }),
      this.prisma.firm.count({ where }),
    ]);
    return toPage(rows.map(mapFirm), total, q);
  }

  async get(id: string) {
    const firm = await this.prisma.firm.findUnique({ where: { id }, include: firmInclude });
    if (!firm) throw new NotFoundException('Firm not found');
    return mapFirm(firm);
  }

  async act(id: string, dto: ActionDto, actor: AdminContext) {
    const action = ensureAction(dto.action, FIRM_ACTIONS);
    if (action === 'suspend') assertElevated(actor);
    const suspended = action === 'suspend';

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.firm.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Firm not found');
      const after = await tx.firm.update({
        where: { id },
        data: { suspended, suspendedAt: suspended ? new Date() : null },
        include: firmInclude,
      });
      await this.audit.record(tx, actor, {
        module: 'firms',
        action: `firms.${action}`,
        targetId: id,
        reason: dto.reason,
        metadata: { before: { suspended: before.suspended }, after: { suspended } },
      });
      return mapFirm(after);
    });
  }
}
