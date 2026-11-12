import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminContext } from '../../common/auth/admin-context';
import { CurrentAdmin, RequirePermission, RequiresElevation } from '../../common/decorators/auth.decorators';
import { ActionDto } from '../../common/dto/action.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { AdminsService } from './admins.service';
import { SaveAdminDto } from './dto/save-admin.dto';

/** Super-admin only (enforced by the role matrix: no other role can read `admins`). */
@ApiTags('admins')
@ApiBearerAuth()
@RequirePermission('admins', 'read')
@Controller('platform/admins')
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  list(@Query() q: ListQueryDto) {
    return this.admins.list(q);
  }

  @Post('save')
  @HttpCode(200)
  @RequirePermission('admins', 'write')
  @RequiresElevation()
  save(@Body() dto: SaveAdminDto, @CurrentAdmin() admin: AdminContext) {
    return this.admins.save(dto, admin);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.admins.get(id);
  }

  /** actions: activate, deactivate, set_role (requires `role`), revoke_sessions, unlock */
  @Post(':id/action')
  @HttpCode(200)
  @RequirePermission('admins', 'write')
  @RequiresElevation()
  act(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActionDto, @CurrentAdmin() admin: AdminContext) {
    return this.admins.act(id, dto, admin);
  }
}
