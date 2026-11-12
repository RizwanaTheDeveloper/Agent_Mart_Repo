import { AdminRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AuditReason } from '../../../common/dto/action.dto';

/**
 * POST /api/platform/admins/save
 * Create: omit id, provide email + password (>= 12 chars).
 * Update: provide id; name/role can change, email and password cannot.
 */
export class SaveAdminDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @IsEnum(AdminRole)
  role: AdminRole;

  @IsOptional()
  @IsString()
  @MinLength(12, { message: 'password must be at least 12 characters' })
  @MaxLength(256)
  password?: string;

  @AuditReason()
  reason: string;
}
