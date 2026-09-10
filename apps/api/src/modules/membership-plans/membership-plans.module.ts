import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MembershipPlansController } from './membership-plans.controller';
import { MembershipPlansService } from './membership-plans.service';
@Module({
  imports: [AuthModule],
  controllers: [MembershipPlansController],
  providers: [MembershipPlansService],
})
export class MembershipPlansModule {}
