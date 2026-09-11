import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { BusinessScope } from '../../common/business-scope';
import { AttendanceService } from './attendance.service';
import type { GoogleWorkspaceSyncDto } from './google-workspace.dto';

type OauthState = {
  businessId: string;
  userId: string;
  returnTo: string;
  expiresAt: number;
  nonce: string;
};

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
};

@Injectable()
export class GoogleWorkspaceService {
  constructor(
    private readonly scope: BusinessScope,
    private readonly config: ConfigService,
    private readonly attendance: AttendanceService,
  ) {}

  private credentials() {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    const clientSecret = this.config
      .get<string>('GOOGLE_CLIENT_SECRET')
      ?.trim();
    const redirectUri =
      this.config.get<string>('GOOGLE_REDIRECT_URI')?.trim() ||
      'http://localhost:3001/api/v1/google-sheets/oauth/callback';
    return { clientId, clientSecret, redirectUri };
  }

  private webOrigin() {
    return (
      this.config.get<string>('WEB_ORIGIN')?.trim() || 'http://localhost:3000'
    );
  }

  private encryptionKey() {
    const encoded =
      this.config.get<string>('GOOGLE_TOKEN_ENCRYPTION_KEY') ||
      this.config.get<string>('QR_ENCRYPTION_KEY');
    const key = encoded ? Buffer.from(encoded, 'base64') : Buffer.alloc(0);
    if (key.length !== 32)
      throw new ServiceUnavailableException(
        'Google token encryption is not configured. Add GOOGLE_TOKEN_ENCRYPTION_KEY to the server environment.',
      );
    return key;
  }

  private configured() {
    const { clientId, clientSecret } = this.credentials();
    const key =
      this.config.get<string>('GOOGLE_TOKEN_ENCRYPTION_KEY') ||
      this.config.get<string>('QR_ENCRYPTION_KEY');
    return (
      !!clientId &&
      !!clientSecret &&
      !!key &&
      Buffer.from(key, 'base64').length === 32
    );
  }

  private missingConfiguration() {
    const { clientId, clientSecret } = this.credentials();
    const key =
      this.config.get<string>('GOOGLE_TOKEN_ENCRYPTION_KEY') ||
      this.config.get<string>('QR_ENCRYPTION_KEY');
    return [
      ...(!clientId ? ['GOOGLE_CLIENT_ID'] : []),
      ...(!clientSecret ? ['GOOGLE_CLIENT_SECRET'] : []),
      ...(!key || Buffer.from(key, 'base64').length !== 32
        ? ['GOOGLE_TOKEN_ENCRYPTION_KEY']
        : []),
    ];
  }

  private encrypt(value: string, businessId: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    cipher.setAAD(Buffer.from(`google-workspace:${businessId}`));
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      'base64',
    );
  }

  private decrypt(value: string, businessId: string) {
    try {
      const data = Buffer.from(value, 'base64');
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey(),
        data.subarray(0, 12),
      );
      decipher.setAAD(Buffer.from(`google-workspace:${businessId}`));
      decipher.setAuthTag(data.subarray(12, 28));
      return Buffer.concat([
        decipher.update(data.subarray(28)),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException(
        'The saved Google connection could not be opened. Reconnect Google Sheets.',
      );
    }
  }

  private stateSecret() {
    const secret = this.credentials().clientSecret;
    if (!secret)
      throw new ServiceUnavailableException('Google OAuth is not configured.');
    return secret;
  }

  private signState(payload: OauthState) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.stateSecret())
      .update(body)
      .digest('base64url');
    return `${body}.${signature}`;
  }

  private verifyState(value?: string): OauthState {
    if (!value) throw new BadRequestException('Missing Google OAuth state.');
    const [body, provided] = value.split('.');
    if (!body || !provided)
      throw new BadRequestException('Invalid Google OAuth state.');
    const expected = createHmac('sha256', this.stateSecret())
      .update(body)
      .digest();
    const actual = Buffer.from(provided, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new BadRequestException('Invalid Google OAuth state.');
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as OauthState;
    if (payload.expiresAt < Date.now())
      throw new BadRequestException('Google OAuth request expired.');
    return payload;
  }

  private safeReturnTo(value?: string) {
    return value?.startsWith('/admin/') ? value : '/admin/attendance';
  }

  private async requireAdmin(userId: string, businessId: string) {
    const access = await this.scope.getAccessRecord(userId, businessId);
    if (!['OWNER', 'ADMIN'].includes(access.role))
      throw new ForbiddenException(
        'Only an owner or admin can manage the Google Sheets connection.',
      );
    return access;
  }

  async status(userId: string, businessId: string) {
    await this.requireAdmin(userId, businessId);
    const connection =
      await this.scope.database.db.googleWorkspaceConnection.findUnique({
        where: { businessId },
        select: { spreadsheetId: true, updatedAt: true },
      });
    return {
      configured: this.configured(),
      missingConfiguration: this.missingConfiguration(),
      connected: !!connection,
      spreadsheetId: connection?.spreadsheetId || null,
      spreadsheetUrl: connection?.spreadsheetId
        ? `https://docs.google.com/spreadsheets/d/${connection.spreadsheetId}/edit`
        : null,
      lastSyncedAt: connection?.updatedAt.toISOString() || null,
    };
  }

  async startOauth(userId: string, businessId: string, returnTo?: string) {
    await this.requireAdmin(userId, businessId);
    const { clientId, redirectUri } = this.credentials();
    if (!this.configured() || !clientId)
      throw new ServiceUnavailableException(
        'Google Sheets is not configured on this server yet. Add the Google client credentials and token encryption key.',
      );
    const state = this.signState({
      businessId,
      userId,
      returnTo: this.safeReturnTo(returnTo),
      expiresAt: Date.now() + 10 * 60 * 1000,
      nonce: randomBytes(16).toString('base64url'),
    });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      state,
    }).toString();
    return { authorizationUrl: url.href };
  }

  async finishOauth(input: { code?: string; state?: string; error?: string }) {
    const fallback = new URL('/admin/attendance', this.webOrigin());
    let state: OauthState;
    try {
      state = this.verifyState(input.state);
    } catch {
      fallback.searchParams.set('google', 'invalid_state');
      return fallback.href;
    }
    const redirect = new URL(
      this.safeReturnTo(state.returnTo),
      this.webOrigin(),
    );
    if (input.error || !input.code) {
      redirect.searchParams.set(
        'google',
        input.error === 'access_denied' ? 'cancelled' : 'failed',
      );
      return redirect.href;
    }
    try {
      await this.requireAdmin(state.userId, state.businessId);
      const { clientId, clientSecret, redirectUri } = this.credentials();
      const tokens = await this.fetchJson<TokenResponse>(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: input.code,
            client_id: clientId!,
            client_secret: clientSecret!,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        },
      );
      const existing =
        await this.scope.database.db.googleWorkspaceConnection.findUnique({
          where: { businessId: state.businessId },
        });
      const refreshTokenEncrypted = tokens.refresh_token
        ? this.encrypt(tokens.refresh_token, state.businessId)
        : existing?.refreshTokenEncrypted;
      if (!refreshTokenEncrypted)
        throw new Error('Google did not return a refresh token.');
      await this.scope.database.db.googleWorkspaceConnection.upsert({
        where: { businessId: state.businessId },
        create: {
          businessId: state.businessId,
          connectedByUserId: state.userId,
          refreshTokenEncrypted,
          accessTokenEncrypted: this.encrypt(
            tokens.access_token,
            state.businessId,
          ),
          accessTokenExpiresAt: new Date(
            Date.now() + (tokens.expires_in || 3600) * 1000,
          ),
        },
        update: {
          connectedByUserId: state.userId,
          refreshTokenEncrypted,
          accessTokenEncrypted: this.encrypt(
            tokens.access_token,
            state.businessId,
          ),
          accessTokenExpiresAt: new Date(
            Date.now() + (tokens.expires_in || 3600) * 1000,
          ),
        },
      });
      redirect.searchParams.set('google', 'connected');
    } catch {
      redirect.searchParams.set('google', 'failed');
    }
    return redirect.href;
  }

  private async accessToken(businessId: string) {
    const connection =
      await this.scope.database.db.googleWorkspaceConnection.findUnique({
        where: { businessId },
      });
    if (!connection)
      throw new BadRequestException('Connect Google Sheets first.');
    if (
      connection.accessTokenEncrypted &&
      connection.accessTokenExpiresAt &&
      connection.accessTokenExpiresAt.getTime() > Date.now() + 60_000
    )
      return {
        token: this.decrypt(connection.accessTokenEncrypted, businessId),
        connection,
      };

    const { clientId, clientSecret } = this.credentials();
    const tokens = await this.fetchJson<TokenResponse>(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          refresh_token: this.decrypt(
            connection.refreshTokenEncrypted,
            businessId,
          ),
          grant_type: 'refresh_token',
        }),
      },
    );
    const changed =
      await this.scope.database.db.googleWorkspaceConnection.update({
        where: { businessId },
        data: {
          accessTokenEncrypted: this.encrypt(tokens.access_token, businessId),
          accessTokenExpiresAt: new Date(
            Date.now() + (tokens.expires_in || 3600) * 1000,
          ),
        },
      });
    return { token: tokens.access_token, connection: changed };
  }

  private async fetchJson<T>(
    url: string,
    init: RequestInit,
    token?: string,
  ): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...init.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new BadGatewayException(
        `Google Sheets request failed (${response.status}). ${detail.slice(0, 200)}`,
      );
    }
    return response.json() as Promise<T>;
  }

  private sheetTitle(year: number, month: number, branchName: string) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return `${prefix} ${branchName}`.replace(/[\\/?*[\]:]/g, '-').slice(0, 90);
  }

  private quoted(title: string) {
    return `'${title.replaceAll("'", "''")}'`;
  }

  private async ensureSpreadsheet(
    businessId: string,
    token: string,
    requestedId?: string,
  ) {
    const connection =
      await this.scope.database.db.googleWorkspaceConnection.findUniqueOrThrow({
        where: { businessId },
      });
    const supplied =
      requestedId?.match(/\/spreadsheets\/d\/([^/]+)/)?.[1] || requestedId;
    if (supplied) {
      await this.scope.database.db.googleWorkspaceConnection.update({
        where: { businessId },
        data: { spreadsheetId: supplied },
      });
      return supplied;
    }
    if (connection.spreadsheetId) return connection.spreadsheetId;
    const created = await this.fetchJson<{ spreadsheetId: string }>(
      'https://sheets.googleapis.com/v4/spreadsheets',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { title: 'Gym attendance' } }),
      },
      token,
    );
    await this.scope.database.db.googleWorkspaceConnection.update({
      where: { businessId },
      data: { spreadsheetId: created.spreadsheetId },
    });
    return created.spreadsheetId;
  }

  private async ensureTab(spreadsheetId: string, title: string, token: string) {
    const metadata = await this.fetchJson<{
      sheets?: { properties: { title: string } }[];
    }>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
      { method: 'GET' },
      token,
    );
    if (metadata.sheets?.some((sheet) => sheet.properties.title === title))
      return;
    await this.fetchJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title } } }],
        }),
      },
      token,
    );
  }

  async sync(
    userId: string,
    businessId: string,
    input: GoogleWorkspaceSyncDto,
  ) {
    await this.requireAdmin(userId, businessId);
    await this.scope.checkAccess(
      userId,
      businessId,
      'monthly_sheet',
      input.branchId,
    );
    if (!this.configured())
      throw new ServiceUnavailableException(
        'Google Sheets is not configured on this server.',
      );
    const matrix = await this.attendance.getMonthlyMatrix(
      userId,
      businessId,
      input,
    );
    const { token } = await this.accessToken(businessId);
    const spreadsheetId = await this.ensureSpreadsheet(
      businessId,
      token,
      input.sheetId,
    );
    const title = this.sheetTitle(input.year, input.month, matrix.branch.name);
    await this.ensureTab(spreadsheetId, title, token);
    const range = `${this.quoted(title)}!A1`;

    let imported = 0;
    if (input.direction === 'PUSH') {
      const values = [
        [
          'Member ID',
          'Member name',
          'Phone',
          ...matrix.days.map((day: { date: string }) => day.date),
          'Present',
          'Absent',
          'Rate',
          'Fee status',
        ],
        ...matrix.members.map(
          (member: {
            memberNumber: string;
            fullName: string;
            phone: string;
            attendance: Record<string, string>;
            totalPresent: number;
            totalAbsent: number;
            attendanceRate: number;
            feeStatus: { status: string };
          }) => [
            member.memberNumber,
            member.fullName,
            member.phone,
            ...matrix.days.map(
              (day: { date: string }) => member.attendance[day.date] || '',
            ),
            member.totalPresent,
            member.totalAbsent,
            `${member.attendanceRate}%`,
            member.feeStatus.status,
          ],
        ),
      ];
      await this.fetchJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(this.quoted(title))}:clear`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        },
        token,
      );
      await this.fetchJson(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values }),
        },
        token,
      );
    } else {
      const result = await this.fetchJson<{ values?: unknown[][] }>(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(this.quoted(title))}`,
        { method: 'GET' },
        token,
      );
      const [headers = [], ...rows] = result.values || [];
      const dateColumns = headers
        .map((header, index) => ({ date: String(header), index }))
        .filter(({ date }) => /^\d{4}-\d{2}-\d{2}$/.test(date));
      const members = await this.scope.database.db.member.findMany({
        where: { businessId, branchId: input.branchId },
        select: { id: true, memberNumber: true },
      });
      const memberByNumber = new Map(
        members.map((member) => [member.memberNumber, member.id]),
      );
      await this.scope.write(userId, businessId, async (tx) => {
        for (const row of rows) {
          const memberId = memberByNumber.get(String(row[0] || '').trim());
          if (!memberId) continue;
          const membership = await tx.membership.findFirst({
            where: {
              businessId,
              branchId: input.branchId,
              memberId,
              cancelledAt: null,
            },
            orderBy: { endDate: 'desc' },
            select: { id: true },
          });
          for (const column of dateColumns) {
            const raw = String(row[column.index] || '')
              .trim()
              .toUpperCase();
            const status =
              raw === 'P'
                ? 'PRESENT'
                : raw === 'A'
                  ? 'ABSENT'
                  : raw === 'R'
                    ? 'REST'
                    : raw;
            if (!status) {
              await tx.attendance.deleteMany({
                where: {
                  businessId,
                  branchId: input.branchId,
                  memberId,
                  attendanceDate: new Date(`${column.date}T00:00:00.000Z`),
                },
              });
              continue;
            }
            if (!['PRESENT', 'ABSENT', 'REST'].includes(status)) continue;
            await tx.attendance.upsert({
              where: {
                businessId_branchId_memberId_attendanceDate: {
                  businessId,
                  branchId: input.branchId,
                  memberId,
                  attendanceDate: new Date(`${column.date}T00:00:00.000Z`),
                },
              },
              create: {
                businessId,
                branchId: input.branchId,
                memberId,
                membershipId: membership?.id,
                attendanceDate: new Date(`${column.date}T00:00:00.000Z`),
                status,
                recordedByUserId: userId,
              },
              update: { status },
            });
            imported += 1;
          }
        }
        await this.scope.audit(
          tx,
          businessId,
          userId,
          businessId,
          'GOOGLE_SHEETS_IMPORTED',
        );
      });
    }

    await this.scope.database.db.business.update({
      where: { id: businessId },
      data: {
        googleSheetId: spreadsheetId,
        googleSyncSettings: {
          lastSyncedAt: new Date().toISOString(),
          direction: input.direction,
          branchId: input.branchId,
          year: input.year,
          month: input.month,
        },
      },
    });
    return {
      synced: true,
      direction: input.direction,
      imported,
      rowCount: matrix.members.length,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      sheetTitle: title,
      lastSyncedAt: new Date().toISOString(),
    };
  }
}
