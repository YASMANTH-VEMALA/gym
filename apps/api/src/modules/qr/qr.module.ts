import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessScope } from '../../common/business-scope';
import { QrController, PublicQrController } from './qr.controller';
import { QrService } from './qr.service';
import { AttendanceModule } from '../attendance/attendance.module';
@Module({
  imports: [AuthModule, AttendanceModule],
  controllers: [QrController, PublicQrController],
  providers: [BusinessScope, QrService],
  exports: [QrService],
})
export class QrModule {}
