import { createParamDecorator, ExecutionContext, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { AdminContext, AuthedRequest } from '../auth/admin-context';
import { Access, ModuleKey } from '../permissions/permissions';

export const IS_PUBLIC_KEY = 'auth:public';
export const AUTH_ONLY_KEY = 'auth:authenticated-only';
export const PERMISSION_KEY = 'auth:permission';
export const ELEVATION_KEY = 'auth:elevation';

export interface PermissionMeta {
  module: ModuleKey;
  access: Access;
}

/** No session required (login, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Any signed-in admin, no module permission (logout, elevate, me). */
export const AuthenticatedOnly = () => SetMetadata(AUTH_ONLY_KEY, true);

/** Required module permission. Method-level overrides class-level. Routes without one are denied. */
export const RequirePermission = (module: ModuleKey, access: Access) =>
  SetMetadata(PERMISSION_KEY, { module, access } satisfies PermissionMeta);

/** Route always needs a recent password re-authentication (else HTTP 428). */
export const RequiresElevation = () => SetMetadata(ELEVATION_KEY, true);

export const CurrentAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext): AdminContext => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.admin) throw new UnauthorizedException();
  return req.admin;
});
