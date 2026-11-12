import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminContext } from '../../common/auth/admin-context';
import { CurrentAdmin, RequirePermission } from '../../common/decorators/auth.decorators';
import { ActionDto } from '../../common/dto/action.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { InterestsService } from './interests.service';

@ApiTags('interests')
@ApiBearerAuth()
@RequirePermission('interests', 'read')
@Controller('platform/interests')
export class InterestsController {
  constructor(private readonly interests: InterestsService) {}

  @Get()
  list(@Query() q: ListQueryDto) {
    return this.interests.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.interests.get(id);
  }

  /** actions: close */
  @Post(':id/action')
  @HttpCode(200)
  @RequirePermission('interests', 'write')
  act(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActionDto, @CurrentAdmin() admin: AdminContext) {
    return this.interests.act(id, dto, admin);
  }
}
