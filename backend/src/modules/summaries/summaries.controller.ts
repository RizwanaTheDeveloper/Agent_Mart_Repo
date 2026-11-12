import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminContext } from '../../common/auth/admin-context';
import { CurrentAdmin, RequirePermission } from '../../common/decorators/auth.decorators';
import { ActionDto } from '../../common/dto/action.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { SummariesService } from './summaries.service';

@ApiTags('summaries')
@ApiBearerAuth()
@RequirePermission('summaries', 'read')
@Controller('platform/summaries')
export class SummariesController {
  constructor(private readonly summaries: SummariesService) {}

  @Get()
  list(@Query() q: ListQueryDto) {
    return this.summaries.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.summaries.get(id);
  }

  /** actions: approve, block, unblock */
  @Post(':id/action')
  @HttpCode(200)
  @RequirePermission('summaries', 'write')
  act(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActionDto, @CurrentAdmin() admin: AdminContext) {
    return this.summaries.act(id, dto, admin);
  }
}
