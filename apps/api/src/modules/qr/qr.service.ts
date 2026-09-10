import {
  Injectable,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calendarToday } from '@gym/validation';
import {
  createHash,
  randomBytes,
  randomUUID,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import { toDataURL } from 'qrcode';
import { BusinessScope, wire } from '../../common/business-scope';
import { type QrCredential, type Prisma } from '../../generated/prisma/client';
import { QrGenerateDto, QrQuery } from './qr.dto';
import { AttendanceService } from '../attendance/attendance.service';
export const hashQr = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export function resolveQrWebOrigin(
  configuredOrigin?: string,
  requestOrigin?: string,
): string {
  const parse = (candidate?: string) => {
    if (!candidate?.trim()) return undefined;
    let url: URL;
    try {
      url = new URL(candidate.trim());
    } catch {
      throw new ServiceUnavailableException(
        'A valid public web origin is required',
      );
    }
    if (
      url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      )
    )
      throw new ServiceUnavailableException(
        'A secure public web origin is required',
      );
    return url;
  };
  const configured = parse(configuredOrigin);
  const requested = parse(requestOrigin);
  if (configured?.protocol === 'https:') return configured.origin;
  return requested?.origin || configured?.origin || 'http://localhost:3000';
}

@Injectable()
export class QrService {
  constructor(
    readonly scope: BusinessScope,
    private readonly config: ConfigService,
    private readonly attendance: AttendanceService,
  ) {}
  private key() {
    const text = this.config.get<string>('QR_ENCRYPTION_KEY');
    if (
      !text ||
      !/^[A-Za-z0-9+/]{43}=$/.test(text) ||
      Buffer.from(text, 'base64').length !== 32
    )
      throw new ServiceUnavailableException(
        'QR encryption is not configured. Contact the workspace operator.',
      );
    return Buffer.from(text, 'base64');
  }
  private encrypt(token: string, id: string, businessId: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    cipher.setAAD(Buffer.from(`${businessId}:${id}`));
    const encrypted = Buffer.concat([
      cipher.update(token, 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      'base64',
    );
  }
  private decrypt(qr: QrCredential) {
    try {
      const blob = Buffer.from(qr.encryptedToken!, 'base64');
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key(),
        blob.subarray(0, 12),
      );
      decipher.setAAD(Buffer.from(`${qr.businessId}:${qr.id}`));
      decipher.setAuthTag(blob.subarray(12, 28));
      return Buffer.concat([
        decipher.update(blob.subarray(28)),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException(
        'Unable to open this QR credential. Check QR encryption configuration or rotate the credential.',
      );
    }
  }
  private metadata(qr: QrCredential) {
    const { tokenHash, encryptedToken, ...safe } = qr;
    void tokenHash;
    void encryptedToken;
    return wire(safe);
  }
  async list(userId: string, businessId: string, q: QrQuery) {
    await this.scope.access(userId, businessId);
    await this.scope.branch(businessId, q.branchId);
    const where: Prisma.QrCredentialWhereInput = {
      businessId,
      kind: q.kind,
      ...(q.branchId
        ? {
            OR: [
              { branchId: q.branchId },
              { member: { branchId: q.branchId } },
            ],
          }
        : {}),
      ...(q.search
        ? {
            AND: [
              {
                OR: [
                  {
                    member: {
                      fullName: { contains: q.search, mode: 'insensitive' },
                    },
                  },
                  {
                    member: {
                      memberNumber: { contains: q.search, mode: 'insensitive' },
                    },
                  },
                  {
                    branch: {
                      name: { contains: q.search, mode: 'insensitive' },
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    };
    const [total, items] = await this.scope.database.db.$transaction([
      this.scope.database.db.qrCredential.count({ where }),
      this.scope.database.db.qrCredential.findMany({
        where,
        include: {
          member: { select: { fullName: true, status: true } },
          branch: { select: { name: true, status: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
      }),
    ]);
    return {
      total,
      page: q.page,
      pageSize: q.pageSize,
      items: items.map((item) => ({
        ...this.metadata(item),
        targetName: item.member?.fullName || item.branch?.name,
        targetStatus: item.member?.status || item.branch?.status,
      })),
    };
  }
  async generateInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    businessId: string,
    input: QrGenerateDto,
  ) {
    if (input.kind === 'MEMBER') {
      if (
        !(await tx.member.findFirst({
          where: { id: input.targetId, businessId, status: 'ACTIVE' },
        }))
      )
        throw new NotFoundException('Active member not found in this business');
    } else if (
      !(await tx.branch.findFirst({
        where: { id: input.targetId, businessId, status: 'ACTIVE' },
      }))
    )
      throw new NotFoundException('Active branch not found in this business');
    const where =
      input.kind === 'MEMBER'
        ? { memberId: input.targetId }
        : { branchId: input.targetId };
    const existing = await tx.qrCredential.findFirst({
      where: { businessId, ...where },
    });
    if (existing?.status === 'ACTIVE' && !input.rotate) return existing;
    const id = existing?.id || randomUUID(),
      token = randomBytes(32).toString('base64url');
    const data = {
      tokenHash: hashQr(token),
      encryptedToken: this.encrypt(token, id, businessId),
      status: 'ACTIVE' as const,
      revokedAt: null,
    };
    const qr = existing
      ? await tx.qrCredential.update({
          where: { id },
          data: { ...data, rotatedAt: new Date() },
        })
      : await tx.qrCredential.create({
          data: { id, businessId, kind: input.kind, ...where, ...data },
        });
    await this.scope.audit(
      tx,
      businessId,
      userId,
      id,
      existing ? 'QR_ROTATED' : 'QR_GENERATED',
    );
    return qr;
  }
  async generate(userId: string, businessId: string, input: QrGenerateDto) {
    const qr = await this.scope.write(userId, businessId, (tx) =>
      this.generateInTransaction(tx, userId, businessId, input),
    );
    return this.metadata(qr);
  }
  async ensureBranches(userId: string, businessId: string) {
    return this.scope.write(userId, businessId, async (tx) => {
      const missing = await tx.branch.findMany({
        where: { businessId, status: 'ACTIVE', qrCredentials: { none: {} } },
        select: { id: true },
      });
      for (const branch of missing)
        await this.generateInTransaction(tx, userId, businessId, {
          kind: 'BRANCH',
          targetId: branch.id,
        });
      return { created: missing.length };
    });
  }
  async image(qr: QrCredential, requestOrigin?: string) {
    if (qr.status !== 'ACTIVE')
      throw new ConflictException('This QR credential is revoked');
    const origin = resolveQrWebOrigin(
      this.config.get<string>('WEB_ORIGIN'),
      requestOrigin,
    );
    const url = new URL(qr.kind === 'BRANCH' ? '/join' : '/q/member', origin);
    url.hash = `token=${this.decrypt(qr)}`;
    const dataUrl = await toDataURL(url.href, {
      errorCorrectionLevel: 'M',
      margin: 4,
      width: 512,
    });
    return { ...this.metadata(qr), dataUrl, url: url.href };
  }
  async view(
    userId: string,
    businessId: string,
    id: string,
    requestOrigin?: string,
  ) {
    await this.scope.access(userId, businessId);
    const qr = await this.scope.database.db.qrCredential.findFirst({
      where: { id, businessId },
      include: {
        member: { select: { status: true } },
        branch: { select: { status: true } },
      },
    });
    if (!qr)
      throw new NotFoundException('QR credential not found in this business');
    if ((qr.member?.status || qr.branch?.status) !== 'ACTIVE')
      throw new ConflictException('The QR target is not active');
    return this.image(qr, requestOrigin);
  }
  revoke(userId: string, businessId: string, id: string) {
    return this.scope.write(userId, businessId, async (tx) => {
      const qr = await tx.qrCredential.findFirst({ where: { id, businessId } });
      if (!qr)
        throw new NotFoundException('QR credential not found in this business');
      if (qr.status === 'REVOKED') return this.metadata(qr);
      const changed = await tx.qrCredential.update({
        where: { id },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          encryptedToken: null,
        },
      });
      await this.scope.audit(tx, businessId, userId, id, 'QR_REVOKED');
      return this.metadata(changed);
    });
  }
  async branchToken(
    token: string,
    tx: Prisma.TransactionClient = this.scope.database.db,
  ) {
    const qr = await tx.qrCredential.findFirst({
      where: {
        tokenHash: hashQr(token),
        kind: 'BRANCH',
        status: 'ACTIVE',
        branch: { status: 'ACTIVE' },
      },
      include: {
        branch: { select: { id: true, name: true, timezone: true } },
        business: { select: { id: true, name: true, timezone: true } },
      },
    });
    if (!qr)
      throw new NotFoundException(
        'This registration QR is invalid or no longer active',
      );
    return qr;
  }
  async publicBranch(token: string) {
    const qr = await this.branchToken(token);
    return {
      businessName: qr.business.name,
      branchName: qr.branch!.name,
      joiningDate: calendarToday(qr.branch!.timezone || qr.business.timezone),
    };
  }
  async resolveMember(userId: string, businessId: string, token: string) {
    await this.scope.access(userId, businessId);
    const qr = await this.scope.database.db.qrCredential.findFirst({
      where: {
        businessId,
        tokenHash: hashQr(token),
        kind: 'MEMBER',
        status: 'ACTIVE',
        member: { status: 'ACTIVE' },
      },
      select: {
        member: {
          select: {
            id: true,
            fullName: true,
            memberNumber: true,
            status: true,
          },
        },
      },
    });
    if (!qr)
      throw new NotFoundException(
        'This member QR is invalid or no longer active',
      );
    return { member: qr.member, attendanceAvailable: true };
  }
  async checkInMember(
    userId: string,
    businessId: string,
    token: string,
    branchId: string,
  ) {
    const resolved = await this.resolveMember(userId, businessId, token);
    const attendance = await this.attendance.checkIn(userId, businessId, {
      memberId: resolved.member!.id,
      branchId,
    });
    return { member: resolved.member, attendance };
  }
}
