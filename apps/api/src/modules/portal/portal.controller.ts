import { Controller,Get,Post,Param,Body,Query,Req,UseGuards,ParseUUIDPipe,Header } from '@nestjs/common';
import { AuthGuard,type AuthRequest } from '../auth/auth.service';
import { QrTokenDto } from '../qr/qr.dto';
import { PortalService } from './portal.service';
import { MemberInvitationsService } from './member-invitations.service';
import { RegisterMemberDto,MemberPageQuery,MemberInviteDto } from './portal.dto';
@Controller('api/v1/member')
@UseGuards(AuthGuard)
export class PortalController {
 constructor(private readonly service:PortalService,private readonly invitations:MemberInvitationsService){}
 @Get('links') @Header('Cache-Control','private, no-store') links(@Req()r:AuthRequest){return this.service.links(r.identity.userId);}
 @Post('register') register(@Req()r:AuthRequest,@Body()input:RegisterMemberDto){return this.service.register(r.identity,input);}
 @Post('invitations/accept') @Header('Cache-Control','private, no-store') accept(@Req()r:AuthRequest,@Body()input:QrTokenDto){return this.invitations.accept(r.identity,input.token);}
 @Get('profiles/:memberId') @Header('Cache-Control','private, no-store') profile(@Req()r:AuthRequest,@Param('memberId',ParseUUIDPipe)id:string){return this.service.profile(r.identity.userId,id);}
 @Get('profiles/:memberId/memberships') @Header('Cache-Control','private, no-store') memberships(@Req()r:AuthRequest,@Param('memberId',ParseUUIDPipe)id:string,@Query()q:MemberPageQuery){return this.service.memberships(r.identity.userId,id,q);}
 @Get('profiles/:memberId/dues') @Header('Cache-Control','private, no-store') dues(@Req()r:AuthRequest,@Param('memberId',ParseUUIDPipe)id:string,@Query()q:MemberPageQuery){return this.service.dues(r.identity.userId,id,q);}
 @Get('profiles/:memberId/payments') @Header('Cache-Control','private, no-store') payments(@Req()r:AuthRequest,@Param('memberId',ParseUUIDPipe)id:string,@Query()q:MemberPageQuery){return this.service.payments(r.identity.userId,id,q);}
 @Get('profiles/:memberId/qr') @Header('Cache-Control','private, no-store') qr(@Req()r:AuthRequest,@Param('memberId',ParseUUIDPipe)id:string){return this.service.card(r.identity.userId,id);}
}
@Controller('api/v1/businesses/:businessId/members/:memberId/account-invitation')
@UseGuards(AuthGuard)
export class MemberInvitationsController {
 constructor(private readonly service:MemberInvitationsService){}
 @Get() @Header('Cache-Control','private, no-store') info(@Req()r:AuthRequest,@Param('businessId',ParseUUIDPipe)b:string,@Param('memberId',ParseUUIDPipe)m:string){return this.service.info(r.identity.userId,b,m);}
 @Post() invite(@Req()r:AuthRequest,@Param('businessId',ParseUUIDPipe)b:string,@Param('memberId',ParseUUIDPipe)m:string,@Body()input:MemberInviteDto){return this.service.invite(r.identity.userId,b,m,input.email);}
 @Post('resend') resend(@Req()r:AuthRequest,@Param('businessId',ParseUUIDPipe)b:string,@Param('memberId',ParseUUIDPipe)m:string){return this.service.invite(r.identity.userId,b,m);}
 @Post('revoke') revoke(@Req()r:AuthRequest,@Param('businessId',ParseUUIDPipe)b:string,@Param('memberId',ParseUUIDPipe)m:string){return this.service.revoke(r.identity.userId,b,m);}
}
