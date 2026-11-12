import { Injectable, NotFoundException } from '@nestjs/common';
import { Plan, Prisma } from '@prisma/client';
import { AdminContext } from '../../common/auth/admin-context';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { contains, toPage } from '../../common/utils/query.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SavePlanDto } from './dto/save-plan.dto';

/** Response shape: id, name, max_staff, max_listings, price_inr, active */
export function mapPlan(p: Plan) {
  return {
    id: p.id,
    name: p.name,
    max_staff: p.maxStaff,
    max_listings: p.maxListings,
    price_inr: p.priceInr,
    active: p.active,
    created: p.createdAt,
    updated: p.updatedAt,
  };
}

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListQueryDto) {
    const where: Prisma.PlanWhereInput = q.q ? { name: contains(q.q) } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.plan.findMany({ where, orderBy: [{ active: 'desc' }, { priceInr: 'asc' }], skip: q.offset, take: q.limit }),
      this.prisma.plan.count({ where }),
    ]);
    return toPage(rows.map(mapPlan), total, q);
  }

  async get(id: string) {
    const row = await this.prisma.plan.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Plan not found');
    return mapPlan(row);
  }

  async save(dto: SavePlanDto, actor: AdminContext) {
    const data = {
      name: dto.name.trim(),
      maxStaff: dto.max_staff,
      maxListings: dto.max_listings,
      priceInr: dto.price_inr,
      active: dto.active,
    };
    return this.prisma.$transaction(async (tx) => {
      let before: Plan | null = null;
      let after: Plan;
      if (dto.id) {
        before = await tx.plan.findUnique({ where: { id: dto.id } });
        if (!before) throw new NotFoundException('Plan not found');
        after = await tx.plan.update({ where: { id: dto.id }, data });
      } else {
        after = await tx.plan.create({ data });
      }
      await this.audit.record(tx, actor, {
        module: 'plans',
        action: dto.id ? 'plans.update' : 'plans.create',
        targetId: after.id,
        reason: dto.reason,
        metadata: { before: before ? mapPlan(before) : null, after: mapPlan(after) } as unknown as Prisma.InputJsonValue,
      });
      return mapPlan(after);
    });
  }
}
