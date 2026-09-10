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
import { CreateStaffDto, ListStaffDto, UpdateStaffDto } from './staff.dto';
import { StaffService } from './staff.service';

@ApiTags('Staff')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/v1/businesses/:businessId/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'List staff; defaults to active' })
  list(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: ListStaffDto,
  ) {
    return this.staff.list(req.identity.userId, businessId, query);
  }
  @Post()
  @ApiOperation({ summary: 'Create staff with active branch assignments' })
  create(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: CreateStaffDto,
  ) {
    return this.staff.create(req.identity.userId, businessId, body);
  }
  @Get(':staffId')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Get active, inactive, or archived staff' })
  get(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('staffId', ParseUUIDPipe) id: string,
  ) {
    return this.staff.get(req.identity.userId, businessId, id);
  }
  @Patch(':staffId')
  @ApiOperation({ summary: 'Update non-archived staff and assignments' })
  update(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('staffId', ParseUUIDPipe) id: string,
    @Body() body: UpdateStaffDto,
  ) {
    return this.staff.update(req.identity.userId, businessId, id, body);
  }
  @Post(':staffId/archive')
  @ApiOperation({ summary: 'Archive staff while preserving history' })
  archive(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('staffId', ParseUUIDPipe) id: string,
  ) {
    return this.staff.archive(req.identity.userId, businessId, id);
  }
}
