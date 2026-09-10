import { AttendanceModule } from './modules/attendance/attendance.module';
import { Module } from '@nestjs/common';
import { PortalModule } from './modules/portal/portal.module';
import { ReportsModule } from './modules/reports/reports.module';
import { QrModule } from './modules/qr/qr.module';
import { FinanceModule } from './modules/finance/finance.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { MembersModule } from './modules/members/members.module';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { BranchesModule } from './modules/branches/branches.module';
import { StaffModule } from './modules/staff/staff.module';
import { MembershipPlansModule } from './modules/membership-plans/membership-plans.module';
@Module({
  imports: [
    AttendanceModule,
    PortalModule,
    ReportsModule,
    QrModule,
    FinanceModule,
    MembershipsModule,
    AuthModule,
    DashboardModule,
    BranchesModule,
    StaffModule,
    MembershipPlansModule,
    MembersModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
