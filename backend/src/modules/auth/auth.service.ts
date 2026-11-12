import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Admin } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { AdminContext } from '../../common/auth/admin-context';
import { permissionsFor } from '../../common/permissions/permissions';
import { generateToken, hashToken } from '../../common/security/tokens';
import { EnvVars } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ElevateDto, LoginDto } from './dto/auth.dto';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const GENERIC_LOGIN_ERROR = 'Invalid email or password';
// Hash of a random value - compared against when the email is unknown so response timing does not leak existence.
const DUMMY_HASH = bcrypt.hashSync(randomBytes(16).toString('hex'), 12);

const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

export const publicAdmin = (a: Pick<Admin, 'id' | 'name' | 'email' | 'role'>) => ({
  id: a.id,
  name: a.name,
  email: a.email,
  role: a.role,
});

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  /** Increments the failure counter and locks the account after MAX_FAILED_ATTEMPTS. */
  private async registerFailure(admin: Admin | null, action: string, reason: string, email: string, ip: string | null) {
    if (admin) {
      const failed = admin.failedLoginCount + 1;
      const lock = failed >= MAX_FAILED_ATTEMPTS;
      await this.prisma.admin.update({
        where: { id: admin.id },
        data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? addMinutes(new Date(), LOCK_MINUTES) : undefined },
      });
    }
    await this.audit.record(this.prisma, null, {
      module: 'auth',
      action,
      actorEmail: email,
      targetId: admin?.id ?? null,
      ip,
      metadata: { reason },
    });
  }

  async login(dto: LoginDto, ip: string | null, userAgent: string | null) {
    const admin = await this.prisma.admin.findUnique({ where: { email: dto.email } });
    const now = new Date();

    if (!admin || !admin.active) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      await this.registerFailure(null, 'auth.login_failed', admin ? 'inactive' : 'unknown_email', dto.email, ip);
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }
    if (admin.lockedUntil && admin.lockedUntil > now) {
      await this.audit.record(this.prisma, null, { module: 'auth', action: 'auth.login_failed', actorEmail: dto.email, targetId: admin.id, ip, metadata: { reason: 'locked' } });
      throw new UnauthorizedException('Account temporarily locked. Try again later.');
    }
    if (!(await bcrypt.compare(dto.password, admin.passwordHash))) {
      await this.registerFailure(admin, 'auth.login_failed', 'bad_password', dto.email, ip);
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const token = generateToken();
    const expiresAt = addMinutes(now, this.config.get('SESSION_TTL_MINUTES', { infer: true }));

    await this.prisma.$transaction(async (tx) => {
      await tx.admin.update({
        where: { id: admin.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
      });
      const session = await tx.adminSession.create({
        data: { adminId: admin.id, tokenHash: hashToken(token), expiresAt, ip, userAgent },
      });
      await this.audit.record(tx, null, {
        module: 'auth',
        action: 'auth.login',
        actorEmail: admin.email,
        targetId: session.id,
        ip,
        userAgent,
      });
    });

    return {
      token,
      expiresAt,
      user: publicAdmin(admin),
      permissions: permissionsFor(admin.role),
    };
  }

  async logout(actor: AdminContext) {
    await this.prisma.$transaction(async (tx) => {
      await tx.adminSession.update({ where: { id: actor.sessionId }, data: { revokedAt: new Date() } });
      await this.audit.record(tx, actor, { module: 'auth', action: 'auth.logout', targetId: actor.sessionId });
    });
    return { ok: true };
  }

  /** Password re-authentication that unlocks sensitive mutations for ELEVATION_TTL_MINUTES. */
  async elevate(actor: AdminContext, dto: ElevateDto) {
    const admin = await this.prisma.admin.findUniqueOrThrow({ where: { id: actor.id } });
    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      throw new ForbiddenException('Account temporarily locked. Try again later.');
    }
    // 403 (not 401) so the client does not treat a typo as "session expired".
    if (!(await bcrypt.compare(dto.password, admin.passwordHash))) {
      await this.registerFailure(admin, 'auth.elevate_failed', 'bad_password', admin.email, actor.ip);
      throw new ForbiddenException('Incorrect password');
    }

    const ttl = this.config.get('ELEVATION_TTL_MINUTES', { infer: true });
    const elevatedUntil = new Date(Math.min(addMinutes(new Date(), ttl).getTime(), actor.sessionExpiresAt.getTime()));

    await this.prisma.$transaction(async (tx) => {
      await tx.admin.update({ where: { id: admin.id }, data: { failedLoginCount: 0 } });
      await tx.adminSession.update({ where: { id: actor.sessionId }, data: { elevatedUntil } });
      await this.audit.record(tx, actor, { module: 'auth', action: 'auth.elevate', targetId: actor.sessionId });
    });
    return { elevatedUntil };
  }

  me(actor: AdminContext) {
    return {
      user: publicAdmin(actor),
      permissions: permissionsFor(actor.role),
      session: { expiresAt: actor.sessionExpiresAt, elevatedUntil: actor.elevatedUntil },
    };
  }
}
