import { IsUUID } from 'class-validator';
import { AuditReason } from '../../../common/dto/action.dto';

/** POST /api/platform/subscriptions/assign */
export class AssignPlanDto {
  @IsUUID()
  firm_id: string;

  @IsUUID()
  plan_id: string;

  @AuditReason()
  reason: string;
}
