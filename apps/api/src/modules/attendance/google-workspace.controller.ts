import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthRequest } from '../auth/auth.service';
import {
  GoogleOauthStartDto,
  GoogleWorkspaceSyncDto,
} from './google-workspace.dto';
import { GoogleWorkspaceService } from './google-workspace.service';

@Controller('api/v1')
export class GoogleWorkspaceController {
  constructor(private readonly service: GoogleWorkspaceService) {}

  @UseGuards(AuthGuard)
  @Get('businesses/:businessId/google-sheets/status')
  status(
    @Req() request: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ) {
    return this.service.status(request.identity.userId, businessId);
  }

  @UseGuards(AuthGuard)
  @Post('businesses/:businessId/google-sheets/oauth/start')
  start(
    @Req() request: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() input: GoogleOauthStartDto,
  ) {
    return this.service.startOauth(
      request.identity.userId,
      businessId,
      input.returnTo,
    );
  }

  @Get('google-sheets/oauth/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() response: { redirect: (status: number, url: string) => void },
  ) {
    const url = await this.service.finishOauth({ code, state, error });
    response.redirect(302, url);
  }

  @UseGuards(AuthGuard)
  @Post('businesses/:businessId/google-sheets/sync')
  sync(
    @Req() request: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() input: GoogleWorkspaceSyncDto,
  ) {
    return this.service.sync(request.identity.userId, businessId, input);
  }
}
