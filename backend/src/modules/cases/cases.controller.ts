import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminContext } from '../../common/auth/admin-context';
import { CurrentAdmin, RequirePermission } from '../../common/decorators/auth.decorators';
import { ActionDto } from '../../common/dto/action.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { CasesService } from './cases.service';

@ApiTags('cases')
@ApiBearerAuth()
@RequirePermission('cases', 'read')
@Controller('platform/cases')
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  list(@Query() q: ListQueryDto) {
    return this.cases.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.cases.get(id);
  }

  /** actions: set_status (requires `status`: open|investigating|resolved|dismissed), add_note (requires `note`) */
  @Post(':id/action')
  @HttpCode(200)
  @RequirePermission('cases', 'write')
  act(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActionDto, @CurrentAdmin() admin: AdminContext) {
    return this.cases.act(id, dto, admin);
  }
}
