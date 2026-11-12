import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminContext } from '../../common/auth/admin-context';
import { CurrentAdmin, RequirePermission } from '../../common/decorators/auth.decorators';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { AnnouncementsService, SaveAnnouncementDto } from './announcements.service';

@ApiTags('announcements')
@ApiBearerAuth()
@RequirePermission('announcements', 'read')
@Controller('platform/announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  list(@Query() q: ListQueryDto) {
    return this.announcements.list(q);
  }

  @Post('save')
  @HttpCode(200)
  @RequirePermission('announcements', 'write')
  save(@Body() dto: SaveAnnouncementDto, @CurrentAdmin() admin: AdminContext) {
    return this.announcements.save(dto, admin);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.get(id);
  }
}
