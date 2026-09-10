import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { AuthGuard, type AuthRequest } from '../auth/auth.service';
import { DashboardService } from './dashboard.service';

export class DashboardQuery {
  @ApiPropertyOptional({ format: 'uuid', description: 'Omit for all branches' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/v1/businesses/:businessId/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Business dashboard, optionally filtered by an authorized branch',
  })
  get(
    @Req() request: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: DashboardQuery,
  ) {
    return this.dashboard.get(
      request.identity.userId,
      businessId,
      query.branchId,
    );
  }
}
