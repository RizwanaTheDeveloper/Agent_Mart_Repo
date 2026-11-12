import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminContext } from '../../common/auth/admin-context';
import { CurrentAdmin, RequirePermission } from '../../common/decorators/auth.decorators';
import { ActionDto } from '../../common/dto/action.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { AccountsService } from './accounts.service';

@ApiTags('accounts')
@ApiBearerAuth()
@RequirePermission('accounts', 'read')
@Controller('platform/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(@Query() q: ListQueryDto) {
    return this.accounts.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.get(id);
  }

  /** actions: enable, disable (elevation), revoke_sessions (elevation) */
  @Post(':id/action')
  @HttpCode(200)
  @RequirePermission('accounts', 'write')
  act(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActionDto, @CurrentAdmin() admin: AdminContext) {
    return this.accounts.act(id, dto, admin);
  }
}
