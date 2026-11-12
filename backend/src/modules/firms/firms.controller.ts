import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminContext } from '../../common/auth/admin-context';
import { CurrentAdmin, RequirePermission } from '../../common/decorators/auth.decorators';
import { ActionDto } from '../../common/dto/action.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { FirmsService } from './firms.service';

@ApiTags('firms')
@ApiBearerAuth()
@RequirePermission('firms', 'read')
@Controller('platform/firms')
export class FirmsController {
  constructor(private readonly firms: FirmsService) {}

  @Get()
  list(@Query() q: ListQueryDto) {
    return this.firms.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.firms.get(id);
  }

  /** actions: suspend (needs elevation), restore */
  @Post(':id/action')
  @HttpCode(200)
  @RequirePermission('firms', 'write')
  act(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActionDto, @CurrentAdmin() admin: AdminContext) {
    return this.firms.act(id, dto, admin);
  }
}
