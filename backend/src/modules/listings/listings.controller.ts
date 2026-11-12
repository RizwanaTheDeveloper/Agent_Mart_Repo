import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminContext } from '../../common/auth/admin-context';
import { CurrentAdmin, RequirePermission } from '../../common/decorators/auth.decorators';
import { ActionDto } from '../../common/dto/action.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { ListingsService } from './listings.service';

@ApiTags('listings')
@ApiBearerAuth()
@RequirePermission('listings', 'read')
@Controller('platform/listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  list(@Query() q: ListQueryDto) {
    return this.listings.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.listings.get(id);
  }

  /** actions: block, mark_reviewed, request_info (requires `note`) */
  @Post(':id/action')
  @HttpCode(200)
  @RequirePermission('listings', 'write')
  act(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActionDto, @CurrentAdmin() admin: AdminContext) {
    return this.listings.act(id, dto, admin);
  }
}
