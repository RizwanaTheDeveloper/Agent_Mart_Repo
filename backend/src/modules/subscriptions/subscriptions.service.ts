import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AdminContext } from '../../common/auth/admin-context';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AssignPlanDto } from './dto/assign-plan.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Ends the firm's current active subscription (if any) and starts a new one on the given plan. */
  async assign(dto: AssignPlanDto, actor: AdminContext) {
    return this.prisma.$transaction(async (tx) => {
      // Lock the firm row so concurrent assignments for the same firm serialise.
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM firms WHERE id = ${dto.firm_id}::uuid FOR UPDATE`;
      if (!locked.length) throw new NotFoundException('Firm not found');
      const plan = await tx.plan.findUnique({ where: { id: dto.plan_id } });
      if (!plan) throw new NotFoundException('Plan not found');
      if (!plan.active) throw new BadRequestException('Cannot assign an inactive plan');

      const previous = await tx.subscription.findFirst({ where: { firmId: dto.firm_id, active: true } });
      const now = new Date();
      await tx.subscription.updateMany({ where: { firmId: dto.firm_id, active: true }, data: { active: false, endsAt: now } });
      const sub = await tx.subscription.create({
        data: { firmId: dto.firm_id, planId: plan.id, assignedById: actor.id, startsAt: now },
      });
      await this.audit.record(tx, actor, {
        module: 'firms',
        action: 'subscriptions.assign',
        targetId: dto.firm_id,
        reason: dto.reason,
        metadata: { previous_plan_id: previous?.planId ?? null, plan_id: plan.id, subscription_id: sub.id },
      });
      return {
        id: sub.id,
        firm_id: sub.firmId,
        plan_id: sub.planId,
        plan_name: plan.name,
        active: sub.active,
        starts_at: sub.startsAt,
      };
    });
  }
}
