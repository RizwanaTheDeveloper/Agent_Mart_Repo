import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminContext } from '../../common/auth/admin-context';
import { CurrentAdmin, RequirePermission, RequiresElevation } from '../../common/decorators/auth.decorators';
import { AssignPlanDto } from './dto/assign-plan.dto';
import { SubscriptionsService } from './subscriptions.service';

/** Manual plan assignment from the Firms screen. */
@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('platform/subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Post('assign')
  @HttpCode(200)
  @RequirePermission('firms', 'write')
  @RequiresElevation()
  assign(@Body() dto: AssignPlanDto, @CurrentAdmin() admin: AdminContext) {
    return this.subscriptions.assign(dto, admin);
  }
}
