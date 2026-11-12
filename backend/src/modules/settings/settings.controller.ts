import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminContext } from '../../common/auth/admin-context';
import { CurrentAdmin, RequirePermission, RequiresElevation } from '../../common/decorators/auth.decorators';
import { SettingsService, UpdateSettingsDto } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@RequirePermission('settings', 'read')
@Controller('platform/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('settings', 'write')
  @RequiresElevation()
  update(@Body() dto: UpdateSettingsDto, @CurrentAdmin() admin: AdminContext) {
    return this.settings.update(dto, admin);
  }
}
