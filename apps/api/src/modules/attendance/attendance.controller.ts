import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthRequest } from '../auth/auth.service';
import { AttendanceService } from './attendance.service';
import { AttendanceQuery, CheckInDto } from './attendance.dto';
@UseGuards(AuthGuard)
@Controller('api/v1')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}
  @Get('businesses/:businessId/attendance') list(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Query() q: AttendanceQuery,
  ) {
    return this.service.list(r.identity.userId, b, q);
  }
  @Post('businesses/:businessId/attendance') checkIn(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Body() input: CheckInDto,
  ) {
    return this.service.checkIn(r.identity.userId, b, input);
  }
  @Post('businesses/:businessId/attendance/:id/check-out') checkOut(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.checkOut(r.identity.userId, b, id);
  }
  @Get('member/profiles/:memberId/attendance') history(
    @Req() r: AuthRequest,
    @Param('memberId', ParseUUIDPipe) id: string,
    @Query() q: AttendanceQuery,
  ) {
    return this.service.memberHistory(r.identity.userId, id, q);
  }
}
