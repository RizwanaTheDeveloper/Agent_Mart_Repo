import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthedRequest } from '../auth/admin-context';
import { assertElevated } from '../auth/elevation';
import {
  AUTH_ONLY_KEY,
  ELEVATION_KEY,
  IS_PUBLIC_KEY,
  PERMISSION_KEY,
  PermissionMeta,
} from '../decorators/auth.decorators';
import { can } from '../permissions/permissions';

/** Enforces the role matrix on every route. Deny-by-default for routes without permission metadata. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const admin = context.switchToHttp().getRequest<AuthedRequest>().admin;
    if (!admin) throw new UnauthorizedException();

    const perm = this.reflector.getAllAndOverride<PermissionMeta | undefined>(PERMISSION_KEY, targets);
    const authOnly = this.reflector.getAllAndOverride<boolean>(AUTH_ONLY_KEY, targets);
    if (!perm && !authOnly) throw new ForbiddenException('Route has no permission mapping');
    if (perm && !can(admin.role, perm.module, perm.access)) {
      throw new ForbiddenException(`Role "${admin.role}" cannot ${perm.access} ${perm.module}`);
    }

    if (this.reflector.getAllAndOverride<boolean>(ELEVATION_KEY, targets)) assertElevated(admin);
    return true;
  }
}
