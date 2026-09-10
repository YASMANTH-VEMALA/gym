import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessScope } from '../../common/business-scope';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
@Module({imports:[AuthModule],controllers:[ReportsController],providers:[BusinessScope,ReportsService]})
export class ReportsModule{}
