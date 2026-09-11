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
import { AttendanceService } from './attendance.service';
import {
  AttendanceQuery,
  CheckInDto,
  GoogleSheetsSyncDto,
  MarkAllTodayDto,
  MonthlyMatrixQuery,
  UpdateMatrixCellDto,
} from './attendance.dto';

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

  @Get('businesses/:businessId/attendance/monthly-matrix') getMonthlyMatrix(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Query() q: MonthlyMatrixQuery,
  ) {
    return this.service.getMonthlyMatrix(r.identity.userId, b, q);
  }

  @Post('businesses/:businessId/attendance/matrix-cell') updateMatrixCell(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Body() input: UpdateMatrixCellDto,
  ) {
    return this.service.updateMatrixCell(r.identity.userId, b, input);
  }

  @Post('businesses/:businessId/attendance/mark-all-today') markAllToday(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Body() input: MarkAllTodayDto,
  ) {
    return this.service.markAllToday(r.identity.userId, b, input);
  }

  @Post('businesses/:businessId/attendance/google-sheets/sync') syncGoogleSheets(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Body() input: GoogleSheetsSyncDto,
  ) {
    return this.service.syncGoogleSheets(r.identity.userId, b, input);
  }

  @Get('businesses/:businessId/attendance/monthly-matrix/export')
  async exportCsv(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Query() q: MonthlyMatrixQuery,
    @Res() res: { setHeader: (k: string, v: string) => void; send: (c: string) => void },
  ) {
    const data = await this.service.getMonthlyMatrix(r.identity.userId, b, q);
    const headers = [
      'Member ID',
      'Name',
      'Phone',
      'Plan',
      'Status',
      ...data.days.map((d: { date: string }) => d.date),
      'Total Present',
      'Total Absent',
      'Attendance %',
      'Fee Status',
    ];

    const rows = data.members.map((m: {
      memberNumber: string;
      fullName: string;
      phone: string;
      planName: string | null;
      status: string;
      attendance: Record<string, string>;
      totalPresent: number;
      totalAbsent: number;
      attendanceRate: number;
      feeStatus: { status: string; outstandingMinor: number };
    }) => {
      const dayValues = data.days.map((d: { date: string }) => m.attendance[d.date] || '-');
      return [
        `"${m.memberNumber}"`,
        `"${m.fullName.replace(/"/g, '""')}"`,
        `"${m.phone}"`,
        `"${(m.planName || 'No Plan').replace(/"/g, '""')}"`,
        `"${m.status}"`,
        ...dayValues.map((v: string) => `"${v}"`),
        m.totalPresent,
        m.totalAbsent,
        `"${m.attendanceRate}%"`,
        `"${m.feeStatus.status}${m.feeStatus.outstandingMinor > 0 ? ` (Due: ${m.feeStatus.outstandingMinor / 100})` : ''}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance-${data.branch.name}-${data.year}-${data.month}.csv"`,
    );
    res.send(csvContent);
  }
}
