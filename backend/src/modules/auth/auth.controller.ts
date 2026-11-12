import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AdminContext } from '../../common/auth/admin-context';
import { AuthenticatedOnly, CurrentAdmin, Public } from '../../common/decorators/auth.decorators';
import { AuthService } from './auth.service';
import { ElevateDto, LoginDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('platform/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Email + password -> { token, expiresAt, user, permissions } */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, req.ip ?? null, req.headers['user-agent']?.slice(0, 400) ?? null);
  }

  @ApiBearerAuth()
  @AuthenticatedOnly()
  @Post('logout')
  @HttpCode(200)
  logout(@CurrentAdmin() admin: AdminContext) {
    return this.auth.logout(admin);
  }

  /** Call after an HTTP 428 response, then retry the original request. */
  @ApiBearerAuth()
  @AuthenticatedOnly()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('elevate')
  @HttpCode(200)
  elevate(@CurrentAdmin() admin: AdminContext, @Body() dto: ElevateDto) {
    return this.auth.elevate(admin, dto);
  }

  /** Current admin, role permissions (use to build the sidebar) and session timing. */
  @ApiBearerAuth()
  @AuthenticatedOnly()
  @Get('me')
  me(@CurrentAdmin() admin: AdminContext) {
    return this.auth.me(admin);
  }
}
