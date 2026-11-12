import { Injectable } from '@nestjs/common';
import { InterestStage } from '@prisma/client';
import { AdminContext } from '../../common/auth/admin-context';
import { can } from '../../common/permissions/permissions';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(actor: AdminContext) {
    const p = this.prisma;
    const [firms, suspendedFirms, activeAccounts, listings, pendingReview, openCases, openInterests, blockedSummaries] =
      await p.$transaction([
        p.firm.count(),
        p.firm.count({ where: { suspended: true } }),
        p.account.count({ where: { active: true } }),
        p.listing.count(),
        p.listing.count({ where: { moderation: { in: ['pending', 'info_requested'] } } }),
        p.reportCase.count({ where: { status: { in: ['open', 'investigating'] } } }),
        p.interest.count({ where: { status: 'open' } }),
        p.listingSummary.count({ where: { blocked: true } }),
      ]);

    const grouped = await p.interest.groupBy({ by: ['stage'], where: { status: 'open' }, _count: { _all: true } });
    const pipeline = Object.values(InterestStage)
      .filter((s) => s !== 'closed')
      .map((stage) => ({ stage, count: grouped.find((g) => g.stage === stage)?._count._all ?? 0 }));

    return {
      kpis: [
        { key: 'firms', label: 'Firms', value: firms },
        { key: 'suspended_firms', label: 'Suspended firms', value: suspendedFirms },
        { key: 'active_accounts', label: 'Active accounts', value: activeAccounts },
        { key: 'listings', label: 'Listings', value: listings },
        { key: 'listings_pending_review', label: 'Listings awaiting review', value: pendingReview },
        { key: 'open_cases', label: 'Open cases', value: openCases },
        { key: 'open_interests', label: 'Open interests', value: openInterests },
        { key: 'blocked_summaries', label: 'Blocked summaries', value: blockedSummaries },
      ],
      pipeline,
      // Roles that cannot read the audit module (support) get an empty list instead of leaked entries.
      recent_audit: can(actor.role, 'audit', 'read') ? await this.audit.recent(10) : [],
    };
  }
}
