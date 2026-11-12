import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminContext } from '../../common/auth/admin-context';
import { CurrentAdmin, RequirePermission } from '../../common/decorators/auth.decorators';
import { OverviewService } from './overview.service';

@ApiTags('overview')
@ApiBearerAuth()
@RequirePermission('overview', 'read')
@Controller('platform/overview')
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  /** { kpis: [8 x {key,label,value}], pipeline: [{stage,count}], recent_audit: [...] } */
  @Get()
  get(@CurrentAdmin() admin: AdminContext) {
    return this.overview.get(admin);
  }
}
