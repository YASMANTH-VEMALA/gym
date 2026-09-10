import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  constructor(private readonly config: ConfigService) {}
  async memberInvitation(email:string,token:string):Promise<boolean> {
    const key=this.config.get<string>('RESEND_API_KEY'),from=this.config.get<string>('RESEND_FROM'),origin=this.config.get<string>('WEB_ORIGIN');
    if(!key || !from || !origin)return false;
    try {const url=new URL('/member/link',origin);url.hash=`token=${token}`;const result=await new Resend(key).emails.send({from,to:email,subject:'Access your gym member profile',text:`Your gym has invited you to access your member profile. Sign in with this email address to link your account:\n\n${url.href}\n\nThis link expires in seven days. It grants member access only. If unexpected, ignore this email.`});return !result.error;}catch{return false;}
  }
  async invitation(email: string, token: string): Promise<boolean> {
    const key = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM');
    const origin = this.config.get<string>('WEB_ORIGIN');
    if (!key || !from || !origin) return false;
    try {
      const url = new URL('/invite', origin);
      url.hash = `token=${token}`;
      const result = await new Resend(key).emails.send({
        from,
        to: email,
        subject: 'Your gym administrator invitation',
        text: `You have been invited to administer a gym. Sign in with this email address and accept your invitation:\n\n${url.href}\n\nThis invitation expires in seven days. If unexpected, ignore this email.`,
      });
      return !result.error;
    } catch {
      return false;
    }
  }
}
