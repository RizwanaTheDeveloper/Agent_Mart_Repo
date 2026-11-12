import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminContext } from '../../common/auth/admin-context';
import { CurrentAdmin, RequirePermission, RequiresElevation } from '../../common/decorators/auth.decorators';
import { ReasonDto } from '../../common/dto/action.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { ImportPreviewDto } from './dto/import.dto';
import { ImportsService } from './imports.service';

@ApiTags('imports')
@ApiBearerAuth()
@RequirePermission('imports', 'read')
@Controller('platform/imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get()
  list(@Query() q: ListQueryDto) {
    return this.imports.list(q);
  }

  /** Stage & validate 1-100 features. Returns { id, status, rows, errors, ... } */
  @Post('preview')
  @HttpCode(200)
  @RequirePermission('imports', 'write')
  preview(@Body() dto: ImportPreviewDto, @CurrentAdmin() admin: AdminContext) {
    return this.imports.preview(dto, admin);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.imports.get(id);
  }

  /** Creates/updates curated parcel references (NOT sale listings). Repeat commit -> 409. */
  @Post(':id/commit')
  @HttpCode(200)
  @RequirePermission('imports', 'write')
  @RequiresElevation()
  commit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto, @CurrentAdmin() admin: AdminContext) {
    return this.imports.commit(id, dto.reason, admin);
  }
}
