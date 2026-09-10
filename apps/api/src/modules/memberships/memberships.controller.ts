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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard, type AuthRequest } from '../auth/auth.service';
import { MembershipsService } from './memberships.service';
import {
  MembershipQuery,
  CreateMembershipDto,
  ReasonDto,
} from './memberships.dto';
@ApiTags('Memberships')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/v1/businesses/:businessId/memberships')
export class MembershipsController {
  constructor(private readonly service: MembershipsService) {}
  @Get() @Header('Cache-Control', 'private, no-store') list(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Query() q: MembershipQuery,
  ) {
    return this.service.list(r.identity.userId, b, q);
  }
  @Get(':id') @Header('Cache-Control', 'private, no-store') get(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(r.identity.userId, b, id);
  }
  @Post() create(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Body() input: CreateMembershipDto,
  ) {
    return this.service.create(r.identity.userId, b, input);
  }
  @Post(':id/cancel') cancel(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReasonDto,
  ) {
    return this.service.cancel(r.identity.userId, b, id, input.reason);
  }
}
