import { Injectable, NotFoundException } from '@nestjs/common';
import { Account, Prisma } from '@prisma/client';
import { AdminContext } from '../../common/auth/admin-context';
import { assertElevated } from '../../common/auth/elevation';
import { ActionDto } from '../../common/dto/action.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { contains, ensureAction, toPage, uuidOrUndefined } from '../../common/utils/query.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export const ACCOUNT_ACTIONS = ['enable', 'disable', 'revoke_sessions'] as const;

/** Response shape: id, name, email, role, firm_id, active, created */
export function mapAccount(a: Account) {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    firm_id: a.firmId,
    active: a.active,
    sessions_revoked_at: a.sessionsRevokedAt,
    last_login: a.lastLoginAt,
    created: a.createdAt,
  };
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListQueryDto) {
    const id = uuidOrUndefined(q.q);
    const where: Prisma.AccountWhereInput = q.q
      ? { OR: [{ name: contains(q.q) }, { email: contains(q.q) }, ...(id ? [{ id }, { firmId: id }] : [])] }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.account.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.offset, take: q.limit }),
      this.prisma.account.count({ where }),
    ]);
    return toPage(rows.map(mapAccount), total, q);
  }

  async get(id: string) {
    const row = await this.prisma.account.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Account not found');
    return mapAccount(row);
  }

  async act(id: string, dto: ActionDto, actor: AdminContext) {
    const action = ensureAction(dto.action, ACCOUNT_ACTIONS);
    if (action !== 'enable') assertElevated(actor);
    const now = new Date();
    const data: Prisma.AccountUpdateInput =
      action === 'enable'
        ? { active: true }
        : action === 'disable'
          ? { active: false, sessionsRevokedAt: now }
          : { sessionsRevokedAt: now };

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.account.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Account not found');
      const after = await tx.account.update({ where: { id }, data });
      await this.audit.record(tx, actor, {
        module: 'accounts',
        action: `accounts.${action}`,
        targetId: id,
        reason: dto.reason,
        metadata: { before: { active: before.active }, after: { active: after.active } },
      });
      return mapAccount(after);
    });
  }
}
