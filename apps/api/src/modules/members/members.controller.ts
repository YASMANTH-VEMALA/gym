import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthRequest } from '../auth/auth.service';
import {
  CreateMemberDto,
  ListMembersDto,
  UpdateMemberDto,
} from './members.dto';
import { MembersService } from './members.service';
@ApiTags('Members')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/v1/businesses/:businessId/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'List business members by name, number, phone or email',
  })
  list(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: ListMembersDto,
  ) {
    return this.members.list(req.identity.userId, businessId, query);
  }
  @Post()
  @ApiOperation({ summary: 'Create member (Owner/Admin)' })
  create(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() input: CreateMemberDto,
  ) {
    return this.members.create(req.identity.userId, businessId, input);
  }
  @Get(':memberId')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Read member profile and recent activity',
  })
  get(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('memberId', ParseUUIDPipe) id: string,
  ) {
    return this.members.get(req.identity.userId, businessId, id);
  }
  @Patch(':memberId')
  @ApiOperation({ summary: 'Edit non-archived member (Owner/Admin)' })
  update(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('memberId', ParseUUIDPipe) id: string,
    @Body() input: UpdateMemberDto,
  ) {
    return this.members.update(req.identity.userId, businessId, id, input);
  }
  @Post(':memberId/archive')
  @ApiOperation({ summary: 'Archive member preserving history (Owner/Admin)' })
  archive(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('memberId', ParseUUIDPipe) id: string,
  ) {
    return this.members.archive(req.identity.userId, businessId, id);
  }
}
