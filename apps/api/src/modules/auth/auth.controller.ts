import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthRequest } from './auth.service';
import { BusinessService } from './business.service';
import { AcceptInviteDto, InviteDto, OnboardingDto } from './auth.dto';

@ApiTags('Account and business access')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/v1')
export class AuthController {
  constructor(private readonly businesses: BusinessService) {}
  @Get('me/businesses') access(@Req() req: AuthRequest) {
    return this.businesses.access(req.identity);
  }
  @Get('businesses/:businessId/access') team(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ) {
    return this.businesses.team(req.identity, businessId);
  }
  @Post('businesses/:businessId/access/:userId/revoke') removeAdmin(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.businesses.removeAdmin(req.identity, businessId, userId);
  }
  @Post('onboarding') onboard(
    @Req() req: AuthRequest,
    @Body() body: OnboardingDto,
  ) {
    return this.businesses.onboard(req.identity, body);
  }
  @Get('businesses/:businessId/invitations') list(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ) {
    return this.businesses.invitations(req.identity, businessId);
  }
  @Post('businesses/:businessId/invitations') invite(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: InviteDto,
  ) {
    return this.businesses.invite(req.identity, businessId, body.email);
  }
  @Post('businesses/:businessId/invitations/:id/resend') resend(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.businesses.resend(req.identity, businessId, id);
  }
  @Post('businesses/:businessId/invitations/:id/revoke') revoke(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.businesses.revoke(req.identity, businessId, id);
  }
  // Never enable request-body logging on this endpoint.
  @Post('invitations/accept') accept(
    @Req() req: AuthRequest,
    @Body() body: AcceptInviteDto,
  ) {
    return this.businesses.accept(req.identity, body.token);
  }
}
