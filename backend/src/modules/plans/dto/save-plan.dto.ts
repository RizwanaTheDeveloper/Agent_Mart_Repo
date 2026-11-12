import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuditReason } from '../../../common/dto/action.dto';

/** POST /api/platform/plans/save - omit `id` to create, include it to update. */
export class SavePlanDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsInt()
  @Min(0)
  @Max(100_000)
  max_staff: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  max_listings: number;

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  price_inr: number;

  @IsBoolean()
  active: boolean;

  @AuditReason()
  reason: string;
}
