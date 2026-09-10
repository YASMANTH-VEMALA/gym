import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { MailService } from '../../integrations/resend/mail.service';
import { AuthService, type Identity } from './auth.service';
import { OnboardingDto } from './auth.dto';
import { hashToken, newInvitationToken } from './invitation-token';
import type { Prisma } from '../../generated/prisma/client';

const invitationView = {
  id: true,
  businessId: true,
  email: true,
  role: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  deliveryStatus: true,
  createdAt: true,
} as const;

@Injectable()
export class BusinessService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
  ) {}
  access(identity: Identity) {
    return this.database.db.businessAccess.findMany({
      where: { userId: identity.userId },
      include: {
        business: {
          include: {
            branches: {
              select: { id: true, name: true, status: true },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });
  }
  async onboard(identity: Identity, input: OnboardingDto) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: input.timezone });
    } catch {
      throw new BadRequestException('Choose a valid timezone');
    }
    await this.auth.verifiedEmail(identity);
    return this.database.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${identity.userId}))`;
      const existing = await tx.businessAccess.findFirst({
        where: { userId: identity.userId },
        include: { business: true },
      });
      if (existing) return existing.business;
      if (
        await tx.memberAccountLink.findFirst({
          where: { userId: identity.userId },
        })
      )
        throw new ForbiddenException(
          'Member accounts cannot create an Owner workspace. Use a separate business account.',
        );
      const business = await tx.business.create({
        data: {
          name: input.name,
          currency: input.currency,
          timezone: input.timezone,
          ownerId: identity.userId,
          branches: { create: { name: input.branchName } },
          access: { create: { userId: identity.userId, role: 'OWNER' } },
        },
      });
      await this.audit(
        tx,
        business.id,
        identity.userId,
        'OWNER_ONBOARDED',
        business.id,
      );
      return business;
    });
  }
  private async owner(
    tx: Prisma.TransactionClient,
    businessId: string,
    userId: string,
  ) {
    const access = await tx.businessAccess.findUnique({
      where: { businessId_userId: { businessId, userId } },
    });
    if (access?.role !== 'OWNER')
      throw new ForbiddenException('Owner access required');
  }
  private audit(
    tx: Prisma.TransactionClient,
    businessId: string,
    actorId: string,
    action: string,
    targetId: string,
  ) {
    return tx.auditEvent.create({
      data: { businessId, actorId, action, targetId },
    });
  }
  async team(identity: Identity, businessId: string) {
    await this.owner(this.database.db, businessId, identity.userId);
    const access = await this.database.db.businessAccess.findMany({
      where: { businessId },
      orderBy: [{ role: 'desc' }, { userId: 'asc' }],
    });
    const invitations = await this.database.db.invitation.findMany({
      where: { businessId, acceptedAt: { not: null } },
      orderBy: { acceptedAt: 'desc' },
      select: { acceptedBy: true, email: true },
    });
    return access.map((a) => ({
      ...a,
      email: invitations.find((i) => i.acceptedBy === a.userId)?.email || null,
    }));
  }
  async removeAdmin(identity: Identity, businessId: string, userId: string) {
    return this.database.db.$transaction(async (tx) => {
      await this.owner(tx, businessId, identity.userId);
      await tx.$queryRaw`SELECT id FROM "Business" WHERE id=${businessId}::uuid FOR UPDATE`;
      const target = await tx.businessAccess.findUnique({
        where: { businessId_userId: { businessId, userId } },
      });
      if (target?.role === 'OWNER')
        throw new ForbiddenException('The Owner cannot be removed.');
      if (!target) return { removed: true };
      await tx.businessAccess.delete({
        where: { businessId_userId: { businessId, userId } },
      });
      await this.audit(
        tx,
        businessId,
        identity.userId,
        'ADMIN_ACCESS_REVOKED',
        userId,
      );
      return { removed: true };
    });
  }
  async invitations(identity: Identity, businessId: string) {
    await this.owner(this.database.db, businessId, identity.userId);
    return this.database.db.invitation.findMany({
      where: { businessId },
      select: invitationView,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async invite(identity: Identity, businessId: string, email: string) {
    const { token, tokenHash } = newInvitationToken();
    const invitation = await this.database.db.$transaction(async (tx) => {
      await this.owner(tx, businessId, identity.userId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${businessId + email}))`;
      const pending = await tx.invitation.findFirst({
        where: { businessId, email, acceptedAt: null, revokedAt: null },
      });
      if (pending)
        throw new ConflictException(
          'An invitation already exists. Resend or revoke it.',
        );
      const invitation = await tx.invitation.create({
        data: {
          businessId,
          email,
          tokenHash,
          invitedBy: identity.userId,
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });
      await this.audit(
        tx,
        businessId,
        identity.userId,
        'ADMIN_INVITED',
        invitation.id,
      );
      return invitation;
    });
    await this.deliver(invitation.id, tokenHash, email, token);
    return this.database.db.invitation.findUnique({
      where: { id: invitation.id },
      select: invitationView,
    });
  }
  private async deliver(
    id: string,
    tokenHash: string,
    email: string,
    token: string,
  ) {
    const delivered = await this.mail.invitation(email, token);
    await this.database.db.invitation.updateMany({
      where: { id, tokenHash, revokedAt: null, acceptedAt: null },
      data: { deliveryStatus: delivered ? 'SENT' : 'FAILED' },
    });
  }
  async resend(identity: Identity, businessId: string, id: string) {
    const { token, tokenHash } = newInvitationToken();
    const invitation = await this.database.db.$transaction(async (tx) => {
      await this.owner(tx, businessId, identity.userId);
      await tx.$queryRaw`SELECT id FROM "Invitation" WHERE id = ${id}::uuid FOR UPDATE`;
      const current = await tx.invitation.findFirst({
        where: { id, businessId },
      });
      if (!current) throw new NotFoundException('Invitation not found');
      if (current.acceptedAt || current.revokedAt)
        throw new ConflictException('Invitation is no longer pending');
      if (current.expiresAt.getTime() - 7 * 86400000 > Date.now() - 60_000)
        throw new ConflictException('Wait one minute before resending');
      const updated = await tx.invitation.update({
        where: { id },
        data: {
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 86400000),
          deliveryStatus: 'PENDING',
        },
      });
      await this.audit(
        tx,
        businessId,
        identity.userId,
        'INVITATION_RESENT',
        id,
      );
      return updated;
    });
    await this.deliver(id, tokenHash, invitation.email, token);
    return this.database.db.invitation.findUnique({
      where: { id },
      select: invitationView,
    });
  }
  async revoke(identity: Identity, businessId: string, id: string) {
    return this.database.db.$transaction(async (tx) => {
      await this.owner(tx, businessId, identity.userId);
      const updated = await tx.invitation.updateMany({
        where: { id, businessId, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (!updated.count)
        throw new ConflictException('Invitation is not pending');
      await this.audit(
        tx,
        businessId,
        identity.userId,
        'INVITATION_REVOKED',
        id,
      );
      return { revoked: true };
    });
  }
  async accept(identity: Identity, token: string) {
    const email = await this.auth.verifiedEmail(identity);
    const tokenHash = hashToken(token);
    return this.database.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${identity.userId}))`;
      if (
        await tx.memberAccountLink.findFirst({
          where: { userId: identity.userId },
        })
      )
        throw new ForbiddenException(
          'Member accounts cannot accept Admin access. Use a separate business account.',
        );
      await tx.$queryRaw`SELECT id FROM "Invitation" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
      const invitation = await tx.invitation.findUnique({
        where: { tokenHash },
      });
      if (!invitation || invitation.revokedAt)
        throw new BadRequestException('Invitation is invalid or revoked');
      if (invitation.email !== email)
        throw new ForbiddenException(
          'Sign in with the verified email address that received this invitation',
        );
      if (invitation.acceptedAt) {
        if (invitation.acceptedBy !== identity.userId)
          throw new ConflictException('Invitation has already been accepted');
        return { businessId: invitation.businessId };
      }
      if (invitation.expiresAt.getTime() <= Date.now())
        throw new BadRequestException(
          'Invitation has expired. Ask the Owner to resend it.',
        );
      await tx.businessAccess.upsert({
        where: {
          businessId_userId: {
            businessId: invitation.businessId,
            userId: identity.userId,
          },
        },
        create: {
          businessId: invitation.businessId,
          userId: identity.userId,
          role: 'ADMIN',
        },
        update: {},
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date(), acceptedBy: identity.userId },
      });
      await this.audit(
        tx,
        invitation.businessId,
        identity.userId,
        'INVITATION_ACCEPTED',
        invitation.id,
      );
      return { businessId: invitation.businessId };
    });
  }
}
