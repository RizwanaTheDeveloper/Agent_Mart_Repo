import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { AuditService } from './audit.service';

/** Read-only administrator action history. There is intentionally no write/delete endpoint. */
@ApiTags('audit')
@ApiBearerAuth()
@RequirePermission('audit', 'read')
@Controller('platform/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() q: ListQueryDto) {
    return this.audit.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.audit.get(id);
  }
}
