import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessScope } from '../../common/business-scope';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { GoogleWorkspaceController } from './google-workspace.controller';
import { GoogleWorkspaceService } from './google-workspace.service';
@Module({
  imports: [AuthModule],
  controllers: [AttendanceController, GoogleWorkspaceController],
  providers: [BusinessScope, AttendanceService, GoogleWorkspaceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
