import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessScope } from '../../common/business-scope';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
@Module({
  imports: [AuthModule],
  controllers: [AttendanceController],
  providers: [BusinessScope, AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
