import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard, type AuthRequest } from '../auth/auth.service';
import { FinanceService } from './finance.service';
import { FinanceQuery, RecordPaymentDto, PromiseDto } from './finance.dto';
import { ReasonDto } from '../memberships/memberships.dto';
@ApiTags('Payments and dues')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/v1/businesses/:businessId')
export class FinanceController {
  constructor(private readonly service: FinanceService) {}
  @Get('dues') @Header('Cache-Control', 'private, no-store') dues(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Query() q: FinanceQuery,
  ) {
    return this.service.dues(r.identity.userId, b, q);
  }
  @Get('payments') @Header('Cache-Control', 'private, no-store') payments(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Query() q: FinanceQuery,
  ) {
    return this.service.payments(r.identity.userId, b, q);
  }
  @Post('payments') record(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Body() input: RecordPaymentDto,
  ) {
    return this.service.record(r.identity.userId, b, input);
  }
  @Post('payments/:id/void') void(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReasonDto,
  ) {
    return this.service.voidPayment(r.identity.userId, b, id, input.reason);
  }
  @Patch('dues/:id/promise') promise(
    @Req() r: AuthRequest,
    @Param('businessId', ParseUUIDPipe) b: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: PromiseDto,
  ) {
    return this.service.promise(
      r.identity.userId,
      b,
      id,
      input.promiseToPayDate,
    );
  }
}
