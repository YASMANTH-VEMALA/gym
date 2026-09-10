import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessScope } from '../../common/business-scope';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
@Module({
  imports: [AuthModule],
  providers: [BusinessScope, FinanceService],
  controllers: [FinanceController],
})
export class FinanceModule {}
