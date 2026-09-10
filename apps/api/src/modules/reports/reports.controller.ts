import { Controller,Get,Param,Query,Req,UseGuards,ParseUUIDPipe,Header } from '@nestjs/common';
import { AuthGuard,type AuthRequest } from '../auth/auth.service';
import { ReportsService } from './reports.service';
import { ReportQuery } from './reports.dto';
@Controller('api/v1/businesses/:businessId/reports')
@UseGuards(AuthGuard)
export class ReportsController {
 constructor(private readonly service:ReportsService){}
 @Get(':type') @Header('Cache-Control','private, no-store') get(@Req()r:AuthRequest,@Param('businessId',ParseUUIDPipe)b:string,@Param('type')type:string,@Query()q:ReportQuery){return this.service.run(r.identity.userId,b,type,q);}
 @Get(':type/export') @Header('Cache-Control','private, no-store') export(@Req()r:AuthRequest,@Param('businessId',ParseUUIDPipe)b:string,@Param('type')type:string,@Query()q:ReportQuery){return this.service.run(r.identity.userId,b,type,q,true);}
}
