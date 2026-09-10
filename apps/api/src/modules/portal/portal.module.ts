import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QrModule } from '../qr/qr.module';
import { BusinessScope } from '../../common/business-scope';
import { MembersService } from '../members/members.service';
import { MailService } from '../../integrations/resend/mail.service';
import { PortalController,MemberInvitationsController } from './portal.controller';
import { PortalService } from './portal.service';
import { MemberInvitationsService } from './member-invitations.service';
@Module({imports:[AuthModule,QrModule],controllers:[PortalController,MemberInvitationsController],providers:[BusinessScope,MembersService,MailService,PortalService,MemberInvitationsService]})
export class PortalModule{}
