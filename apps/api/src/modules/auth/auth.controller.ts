import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthRequest } from './auth.service';
import { BusinessService } from './business.service';
import {
  AcceptInviteDto,
  InviteDto,
  OnboardingDto,
  UpdateAccessDto,
  UpdateBusinessProfileDto,
} from './auth.dto';

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
  @Patch('businesses/:businessId/access/:userId') updateAccess(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: UpdateAccessDto,
  ) {
    return this.businesses.updateAccess(req.identity, businessId, userId, body);
  }
  @Patch('businesses/:businessId/profile') updateProfile(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: UpdateBusinessProfileDto,
  ) {
    return this.businesses.updateProfile(req.identity, businessId, body);
  }
  @Get('businesses/:businessId/google-sheets') getGoogleSheets(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ) {
    return this.businesses.getGoogleSheetsConfig(req.identity.userId, businessId);
  }
  @Patch('businesses/:businessId/google-sheets') updateGoogleSheets(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: { sheetId?: string | null; syncSettings?: unknown },
  ) {
    return this.businesses.updateGoogleSheetsConfig(req.identity, businessId, body);
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
    return this.businesses.invite(req.identity, businessId, body);
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
@ApiTags('Business Public Assets')
@Controller('api/v1/businesses')
export class BusinessLogoController {
  constructor(private readonly businesses: BusinessService) {}

  @Get(':businessId/logo')
  async getLogo(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Res({ passthrough: true })
    res: { setHeader: (name: string, value: string | number) => void },
  ) {
    const logo = await this.businesses.getLogo(businessId);
    if (!logo) {
      throw new NotFoundException('Logo not found');
    }
    res.setHeader('Content-Type', logo.contentType);
    res.setHeader('Content-Length', logo.data.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('ETag', `"${logo.updatedAt.getTime()}"`);
    return new StreamableFile(logo.data);
  }
}
