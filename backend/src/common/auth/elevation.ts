import { HttpException, HttpStatus } from '@nestjs/common';
import { AdminContext } from './admin-context';

/**
 * HTTP 428 Precondition Required. The frontend must prompt for the password,
 * call POST /api/platform/auth/elevate, then retry the original request unchanged.
 */
export class ElevationRequiredException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.PRECONDITION_REQUIRED,
        error: 'Precondition Required',
        code: 'ELEVATION_REQUIRED',
        message: 'Re-enter your password to continue.',
      },
      HttpStatus.PRECONDITION_REQUIRED,
    );
  }
}

export function isElevated(admin: AdminContext): boolean {
  return !!admin.elevatedUntil && admin.elevatedUntil.getTime() > Date.now();
}

export function assertElevated(admin: AdminContext): void {
  if (!isElevated(admin)) throw new ElevationRequiredException();
}
