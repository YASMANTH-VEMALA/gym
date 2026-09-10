import { Injectable,NotFoundException,ConflictException,ForbiddenException,BadRequestException } from '@nestjs/common';
import { BusinessScope } from '../../common/business-scope';
import { MailService } from '../../integrations/resend/mail.service';
import { AuthService,type Identity } from '../auth/auth.service';
import { hashToken,newInvitationToken } from '../auth/invitation-token';
import { PortalService } from './portal.service';
const invitationView={id:true,email:true,expiresAt:true,acceptedAt:true,revokedAt:true,deliveryStatus:true,createdAt:true} as const;
@Injectable()
export class MemberInvitationsService {
 constructor(private readonly scope:BusinessScope,private readonly mail:MailService,private readonly auth:AuthService,private readonly portal:PortalService){}
 async info(userId:string,businessId:string,memberId:string){
  await this.scope.access(userId,businessId);
  if(!await this.scope.database.db.member.findFirst({where:{id:memberId,businessId}}))throw new NotFoundException('Member not found in this business');
  const [invitation,link]=await Promise.all([this.scope.database.db.memberLinkInvitation.findFirst({where:{businessId,memberId},select:invitationView}),this.scope.database.db.memberAccountLink.findFirst({where:{businessId,memberId},select:{createdAt:true}})]);return {invitation,linked:!!link};
 }
 async invite(userId:string,businessId:string,memberId:string,email?:string){
  const {token,tokenHash}=newInvitationToken();
  const item=await this.scope.write(userId,businessId,async tx=>{
   const member=await tx.member.findFirst({where:{id:memberId,businessId,status:{not:'ARCHIVED'}}});if(!member)throw new NotFoundException('Current member not found in this business');
   if(await tx.memberAccountLink.findUnique({where:{memberId}}))throw new ConflictException('This member already has a linked account');
   const previous=await tx.memberLinkInvitation.findUnique({where:{memberId}});
   if(!email && (!previous || previous.acceptedAt || previous.revokedAt))throw new ConflictException('There is no pending invitation to resend');
   const recipient=email || previous!.email;
   const data={businessId,memberId,email:recipient,tokenHash,invitedBy:userId,expiresAt:new Date(Date.now()+7*86400000),acceptedAt:null,acceptedBy:null,revokedAt:null,deliveryStatus:'PENDING'};
   const invitation=await tx.memberLinkInvitation.upsert({where:{memberId},create:data,update:data});await this.scope.audit(tx,businessId,userId,invitation.id,previous?'MEMBER_INVITATION_RESENT':'MEMBER_INVITED');return invitation;
  });
  // Token is transient only: not in records, audit metadata, durable queues or delivery IDs.
  let sent=false;try{sent=await this.mail.memberInvitation(item.email,token);}catch{sent=false;}
  await this.scope.database.db.memberLinkInvitation.updateMany({where:{id:item.id,tokenHash},data:{deliveryStatus:sent?'SENT':'FAILED'}});
  return this.info(userId,businessId,memberId);
 }
 revoke(userId:string,businessId:string,memberId:string){return this.scope.write(userId,businessId,async tx=>{
  const item=await tx.memberLinkInvitation.findFirst({where:{businessId,memberId}});if(!item)throw new NotFoundException('Invitation not found in this business');if(item.acceptedAt)throw new ConflictException('An accepted invitation cannot be revoked');if(item.revokedAt)return {revoked:true};
  await tx.memberLinkInvitation.update({where:{id:item.id},data:{revokedAt:new Date()}});await this.scope.audit(tx,businessId,userId,item.id,'MEMBER_INVITATION_REVOKED');return {revoked:true};
 });}
 async accept(identity:Identity,token:string){
  const email=await this.auth.verifiedEmail(identity),tokenHash=hashToken(token);
  const candidate=await this.scope.database.db.memberLinkInvitation.findUnique({where:{tokenHash}});if(!candidate)throw new BadRequestException('This invitation is invalid. Ask your gym for a new link.');
  return this.scope.database.db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${identity.userId}))`;await this.portal.onlyMemberAccount(tx,identity.userId);
   await tx.$queryRaw`SELECT id FROM "Business" WHERE id=${candidate.businessId}::uuid FOR UPDATE`;
   const item=await tx.memberLinkInvitation.findUnique({where:{tokenHash},include:{member:{select:{status:true}}}});
   if(!item || item.revokedAt)throw new BadRequestException('This invitation is invalid or revoked');
   if(email!==item.email)throw new ForbiddenException('Account mismatch: sign out and use the verified email address that received this invitation.');
   if(item.acceptedAt){if(item.acceptedBy!==identity.userId)throw new ConflictException('This invitation was already accepted');return {memberId:item.memberId};}
   if(item.expiresAt.getTime()<=Date.now())throw new BadRequestException('This invitation has expired. Ask your gym to resend it.');
   if(item.member.status==='ARCHIVED')throw new ConflictException('This member profile is archived. Contact your gym.');
   const linked=await tx.memberAccountLink.findFirst({where:{OR:[{memberId:item.memberId},{businessId:item.businessId,userId:identity.userId}]}});
   if(linked && (linked.userId!==identity.userId || linked.memberId!==item.memberId))throw new ConflictException('This account or profile is already linked. Contact your gym.');
   const link=linked || await tx.memberAccountLink.create({data:{businessId:item.businessId,memberId:item.memberId,userId:identity.userId}});
   await tx.memberLinkInvitation.update({where:{id:item.id},data:{acceptedAt:new Date(),acceptedBy:identity.userId}});
   await this.scope.audit(tx,item.businessId,identity.userId,item.id,'MEMBER_INVITATION_ACCEPTED');if(!linked)await this.scope.audit(tx,item.businessId,identity.userId,link.id,'MEMBER_ACCOUNT_LINKED');return {memberId:item.memberId};
  },{timeout:15000});
 }
}
