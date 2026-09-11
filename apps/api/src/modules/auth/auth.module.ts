import { Module } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { MailService } from '../../integrations/resend/mail.service';
import { AuthController, BusinessLogoController } from './auth.controller';
import { AuthGuard, AuthService } from './auth.service';
import { BusinessService } from './business.service';
@Module({
  controllers: [AuthController, BusinessLogoController],
  exports: [AuthGuard, AuthService, DatabaseService],
  providers: [
    DatabaseService,
    MailService,
    AuthService,
    AuthGuard,
    BusinessService,
  ],
})
export class AuthModule {}
