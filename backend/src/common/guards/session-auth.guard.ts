import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthedRequest } from '../auth/admin-context';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { hashToken } from '../security/tokens';

/** Validates `Authorization: Bearer <token>` against admin_sessions (absolute 2h expiry). */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token || token.length > 200) throw new UnauthorizedException('Missing or malformed bearer token');

    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { admin: true },
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now || !session.admin.active) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    if (now.getTime() - session.lastSeenAt.getTime() > 60_000) {
      void this.prisma.adminSession
        .update({ where: { id: session.id }, data: { lastSeenAt: now } })
        .catch(() => undefined);
    }

    req.admin = {
      id: session.admin.id,
      name: session.admin.name,
      email: session.admin.email,
      role: session.admin.role,
      sessionId: session.id,
      sessionExpiresAt: session.expiresAt,
      elevatedUntil: session.elevatedUntil,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent']?.slice(0, 400) ?? null,
    };
    return true;
  }
}
