import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  Header,
} from '@nestjs/common';
import { AuthGuard, type AuthRequest } from '../auth/auth.service';
import { QrService } from './qr.service';
import { QrQuery, QrGenerateDto, QrTokenDto, QrCheckInDto } from './qr.dto';
@Controller('api/v1/businesses/:businessId/qr')
@UseGuards(AuthGuard)
export class QrController {
  constructor(private readonly service: QrService) {}
  @Get() @Header('Cache-Control', 'private, no-store') list(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Query() q: QrQuery,
  ) {
    return this.service.list(r.identity.userId, b, q);
  }
  @Post() generate(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Body() q: QrGenerateDto,
  ) {
    return this.service.generate(r.identity.userId, b, q);
  }
  @Post('branches/ensure') ensure(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
  ) {
    return this.service.ensureBranches(r.identity.userId, b);
  }
  @Get(':id') @Header('Cache-Control', 'private, no-store') view(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.view(r.identity.userId, b, id);
  }
  @Post(':id/revoke') revoke(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.revoke(r.identity.userId, b, id);
  }
  @Post('resolve/member') @Header('Cache-Control', 'private, no-store') resolve(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Body() q: QrTokenDto,
  ) {
    return this.service.resolveMember(r.identity.userId, b, q.token);
  }
  @Post('check-in/member')
  @Header('Cache-Control', 'private, no-store')
  checkIn(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Body() q: QrCheckInDto,
  ) {
    return this.service.checkInMember(
      r.identity.userId,
      b,
      q.token,
      q.branchId,
    );
  }
}
@Controller('api/v1/public/qr')
export class PublicQrController {
  constructor(private readonly service: QrService) {}
  @Post('branch') @Header('Cache-Control', 'no-store') branch(
    @Body() q: QrTokenDto,
  ) {
    return this.service.publicBranch(q.token);
  }
}
