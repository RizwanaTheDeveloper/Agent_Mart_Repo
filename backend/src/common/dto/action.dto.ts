import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Every mutation must carry an audit reason of at least 5 characters (spec section 5). */
export const AuditReason = () =>
  applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    IsString(),
    MinLength(5, { message: 'reason must be at least 5 characters' }),
    MaxLength(1000),
  );

export class ReasonDto {
  @AuditReason()
  reason: string;
}

/** POST /api/platform/{module}/{id}/action */
export class ActionDto {
  /** e.g. suspend, restore, block, mark_reviewed, close ... (allowed values vary by module) */
  @IsString()
  @MaxLength(64)
  action: string;

  @AuditReason()
  reason: string;

  /** Free text used by request_info (message to seller) and add_note (internal case note). */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;

  /** Target status for set_status actions. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  /** Target role for admin set_role. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  role?: string;
}
