import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessScope } from '../../common/business-scope';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
@Module({
  imports: [AuthModule],
  providers: [BusinessScope, MembershipsService],
  controllers: [MembershipsController],
})
export class MembershipsModule {}
