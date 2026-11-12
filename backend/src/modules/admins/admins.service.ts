import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Admin, AdminRole, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AdminContext } from '../../common/auth/admin-context';
import { ActionDto } from '../../common/dto/action.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { contains, ensureAction, requireField, toPage, uuidOrUndefined } from '../../common/utils/query.utils';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SaveAdminDto } from './dto/save-admin.dto';

export const ADMIN_ACTIONS = ['activate', 'deactivate', 'set_role', 'revoke_sessions', 'unlock'] as const;

/** Response shape: id, name, email, role, active, created. Secrets/hashes are never returned. */
export function mapAdmin(a: Admin) {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    active: a.active,
    locked: !!a.lockedUntil && a.lockedUntil > new Date(),
    last_login: a.lastLoginAt,
    created: a.createdAt,
  };
}

@Injectable()
export class AdminsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Prevents locking the platform out: at least one active super_admin must always remain. */
  private async assertNotLastSuperAdmin(tx: Prisma.TransactionClient, target: Admin) {
    if (target.role !== 'super_admin' || !target.active) return;
    const others = await tx.admin.count({ where: { role: 'super_admin', active: true, id: { not: target.id } } });
    if (others === 0) throw new ConflictException('At least one active super_admin must remain');
  }

  async list(q: ListQueryDto) {
    const id = uuidOrUndefined(q.q);
    const where: Prisma.AdminWhereInput = q.q
      ? { OR: [{ name: contains(q.q) }, { email: contains(q.q) }, ...(id ? [{ id }] : [])] }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.admin.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.offset, take: q.limit }),
      this.prisma.admin.count({ where }),
    ]);
    return toPage(rows.map(mapAdmin), total, q);
  }

  async get(id: string) {
    const row = await this.prisma.admin.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Administrator not found');
    return mapAdmin(row);
  }

  async save(dto: SaveAdminDto, actor: AdminContext) {
    if (!dto.id) {
      const email = requireField(dto.email, 'email');
      const password = requireField(dto.password, 'password');
      const passwordHash = await bcrypt.hash(password, 12);
      return this.prisma.$transaction(async (tx) => {
        const admin = await tx.admin.create({
          data: { name: dto.name.trim(), email, role: dto.role, passwordHash },
        });
        await this.audit.record(tx, actor, {
          module: 'admins',
          action: 'admins.create',
          targetId: admin.id,
          reason: dto.reason,
          metadata: { email, role: dto.role },
        });
        return { admin: mapAdmin(admin) };
      });
    }

    if (dto.password) throw new BadRequestException('Password cannot be changed via update');
    const id = dto.id;
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.admin.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Administrator not found');
      if (dto.email && dto.email !== before.email) throw new BadRequestException('Email cannot be changed');
      if (dto.role !== before.role) {
        if (id === actor.id) throw new BadRequestException('You cannot change your own role');
        await this.assertNotLastSuperAdmin(tx, before);
      }
      const after = await tx.admin.update({ where: { id }, data: { name: dto.name.trim(), role: dto.role } });
      if (dto.role !== before.role) {
        // Role change takes effect immediately: kill existing sessions.
        await tx.adminSession.updateMany({ where: { adminId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await this.audit.record(tx, actor, {
        module: 'admins',
        action: 'admins.update',
        targetId: id,
        reason: dto.reason,
        metadata: { before: { name: before.name, role: before.role }, after: { name: after.name, role: after.role } },
      });
      return { admin: mapAdmin(after) };
    });
  }

  async act(id: string, dto: ActionDto, actor: AdminContext) {
    const action = ensureAction(dto.action, ADMIN_ACTIONS);
    if (id === actor.id && ['deactivate', 'set_role'].includes(action)) {
      throw new BadRequestException(`You cannot ${action.replace('_', ' ')} your own account`);
    }
    let role: AdminRole | undefined;
    if (action === 'set_role') {
      const r = requireField(dto.role, 'role');
      if (!Object.values(AdminRole).includes(r as AdminRole)) {
        throw new BadRequestException(`role must be one of: ${Object.values(AdminRole).join(', ')}`);
      }
      role = r as AdminRole;
    }

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.admin.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Administrator not found');
      const now = new Date();
      const revokeSessions = () =>
        tx.adminSession.updateMany({ where: { adminId: id, revokedAt: null }, data: { revokedAt: now } });

      let after = before;

      switch (action) {
        case 'activate':
          after = await tx.admin.update({ where: { id }, data: { active: true } });
          break;
        case 'deactivate':
          await this.assertNotLastSuperAdmin(tx, before);
          after = await tx.admin.update({ where: { id }, data: { active: false } });
          await revokeSessions();
          break;
        case 'set_role':
          if (role !== 'super_admin') await this.assertNotLastSuperAdmin(tx, before);
          after = await tx.admin.update({ where: { id }, data: { role } });
          await revokeSessions();
          break;
        case 'revoke_sessions':
          await revokeSessions();
          break;
        case 'unlock':
          after = await tx.admin.update({ where: { id }, data: { lockedUntil: null, failedLoginCount: 0 } });
          break;
      }

      await this.audit.record(tx, actor, {
        module: 'admins',
        action: `admins.${action}`,
        targetId: id,
        reason: dto.reason,
        metadata: { before: { active: before.active, role: before.role }, after: { active: after.active, role: after.role } },
      });
      return { admin: mapAdmin(after) };
    });
  }
}
