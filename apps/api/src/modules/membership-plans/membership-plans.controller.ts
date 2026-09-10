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
  CreateMembershipPlanDto,
  ListMembershipPlansDto,
  UpdateMembershipPlanDto,
} from './membership-plans.dto';
import { MembershipPlansService } from './membership-plans.service';
@ApiTags('Membership plans')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/v1/businesses/:businessId/membership-plans')
export class MembershipPlansController {
  constructor(private readonly plans: MembershipPlansService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'List plans, including all-branch plans when filtering by branch',
  })
  list(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: ListMembershipPlansDto,
  ) {
    return this.plans.list(req.identity.userId, businessId, query);
  }
  @Post()
  @ApiOperation({ summary: 'Create membership plan (Owner/Admin)' })
  create(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() input: CreateMembershipPlanDto,
  ) {
    return this.plans.create(req.identity.userId, businessId, input);
  }
  @Get(':planId')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Read plan, applicability, and active eligible branches',
  })
  get(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('planId', ParseUUIDPipe) id: string,
  ) {
    return this.plans.get(req.identity.userId, businessId, id);
  }
  @Patch(':planId')
  @ApiOperation({ summary: 'Edit non-archived plan (Owner/Admin)' })
  update(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('planId', ParseUUIDPipe) id: string,
    @Body() input: UpdateMembershipPlanDto,
  ) {
    return this.plans.update(req.identity.userId, businessId, id, input);
  }
  @Post(':planId/archive')
  @ApiOperation({ summary: 'Archive plan preserving history (Owner/Admin)' })
  archive(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('planId', ParseUUIDPipe) id: string,
  ) {
    return this.plans.archive(req.identity.userId, businessId, id);
  }
}
