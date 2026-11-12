import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminContext } from '../../common/auth/admin-context';
import { CurrentAdmin, RequirePermission, RequiresElevation } from '../../common/decorators/auth.decorators';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { SavePlanDto } from './dto/save-plan.dto';
import { PlansService } from './plans.service';

@ApiTags('plans')
@ApiBearerAuth()
@RequirePermission('plans', 'read')
@Controller('platform/plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list(@Query() q: ListQueryDto) {
    return this.plans.list(q);
  }

  /** Create (no id) or update (with id). Pricing changes require elevation. */
  @Post('save')
  @HttpCode(200)
  @RequirePermission('plans', 'write')
  @RequiresElevation()
  save(@Body() dto: SavePlanDto, @CurrentAdmin() admin: AdminContext) {
    return this.plans.save(dto, admin);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.get(id);
  }
}
