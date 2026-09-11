// Local-only fake Supabase provider and real NestJS/PostgreSQL API for browser tests.
require('reflect-metadata');
const { createServer } = require('node:http');
const { randomUUID } = require('node:crypto');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { Client } = require('pg');
const { NestFactory } = require('@nestjs/core');
const { Module, ValidationPipe } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { AuthService, AuthGuard } = require('../dist/modules/auth/auth.service');
const {
  AuthController,
  BusinessLogoController,
} = require('../dist/modules/auth/auth.controller');
const {
  BranchesController,
} = require('../dist/modules/branches/branches.controller');
const {
  BranchesService,
} = require('../dist/modules/branches/branches.service');
const { StaffController } = require('../dist/modules/staff/staff.controller');
const { StaffService } = require('../dist/modules/staff/staff.service');
const {
  AttendanceController,
} = require('../dist/modules/attendance/attendance.controller');
const {
  AttendanceService,
} = require('../dist/modules/attendance/attendance.service');
const { BusinessScope } = require('../dist/common/business-scope');
const {
  PortalController,
  MemberInvitationsController,
} = require('../dist/modules/portal/portal.controller');
const { PortalService } = require('../dist/modules/portal/portal.service');
const {
  MemberInvitationsService,
} = require('../dist/modules/portal/member-invitations.service');
const {
  ReportsController,
} = require('../dist/modules/reports/reports.controller');
const { ReportsService } = require('../dist/modules/reports/reports.service');
const {
  QrController,
  PublicQrController,
} = require('../dist/modules/qr/qr.controller');
const { QrService } = require('../dist/modules/qr/qr.service');
const {
  FinanceController,
} = require('../dist/modules/finance/finance.controller');
const { FinanceService } = require('../dist/modules/finance/finance.service');
const {
  MembershipsController,
} = require('../dist/modules/memberships/memberships.controller');
const {
  MembershipsService,
} = require('../dist/modules/memberships/memberships.service');
const {
  MembersController,
} = require('../dist/modules/members/members.controller');
const { MembersService } = require('../dist/modules/members/members.service');
const {
  MembershipPlansController,
} = require('../dist/modules/membership-plans/membership-plans.controller');
const {
  MembershipPlansService,
} = require('../dist/modules/membership-plans/membership-plans.service');
const { BusinessService } = require('../dist/modules/auth/business.service');
const { DatabaseService } = require('../dist/database/database.service');
const { MailService } = require('../dist/integrations/resend/mail.service');
const {
  DashboardController,
} = require('../dist/modules/dashboard/dashboard.controller');
const {
  DashboardService,
} = require('../dist/modules/dashboard/dashboard.service');

async function main() {
  if (!process.env.TEST_DATABASE_URL)
    throw new Error('TEST_DATABASE_URL is required');
  const connection = new URL(process.env.TEST_DATABASE_URL);
  if (
    !['127.0.0.1', 'localhost'].includes(connection.hostname) ||
    !connection.pathname.includes('auth_test')
  )
    throw new Error('A local auth_test database is required');
  const sql = new Client({ connectionString: connection.href });
  await sql.connect();
  for (const migration of readdirSync(
    resolve(__dirname, '../prisma/migrations'),
    { withFileTypes: true },
  )
    .filter((item) => item.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await sql.query(
      readFileSync(
        resolve(
          __dirname,
          '../prisma/migrations',
          migration.name,
          'migration.sql',
        ),
        'utf8',
      ),
    );
  }
  await sql.end();
  const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
  const pair = await generateKeyPair('ES256');
  const jwk = {
    ...(await exportJWK(pair.publicKey)),
    kid: 'browser',
    alg: 'ES256',
  };
  const users = new Map();
  const sessions = new Map();
  const outbox = [];
  async function session(email) {
    let user = users.get(email);
    if (!user) {
      user = {
        id: randomUUID(),
        email,
        email_confirmed_at: new Date().toISOString(),
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: { provider: 'email' },
        user_metadata: {},
        created_at: new Date().toISOString(),
      };
      users.set(email, user);
    }
    const access_token = await new SignJWT({
      role: 'authenticated',
      email,
      session_id: randomUUID(),
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'browser' })
      .setSubject(user.id)
      .setIssuer('http://127.0.0.1:3102/auth/v1')
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(pair.privateKey);
    sessions.set(access_token, user);
    return {
      access_token,
      refresh_token: randomUUID(),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user,
    };
  }
  const provider = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3100');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') return res.end();
    const url = new URL(req.url, 'http://127.0.0.1:3102');
    if (url.pathname.endsWith('/.well-known/jwks.json'))
      return res.end(JSON.stringify({ keys: [jwk] }));
    if (url.pathname === '/outbox') return res.end(JSON.stringify(outbox));
    if (url.pathname.endsWith('/authorize')) {
      if (
        url.searchParams.get('provider') !== 'google' ||
        !url.searchParams.get('code_challenge')
      ) {
        res.statusCode = 400;
        return res.end('{}');
      }
      const callback = new URL(url.searchParams.get('redirect_to'));
      callback.searchParams.set('code', 'fixture-google');
      res.statusCode = 302;
      res.setHeader('Location', callback.href);
      return res.end();
    }
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    // Browser-test records only: this service refuses non-local test databases.
    if (url.pathname === '/fixtures/dashboard' && req.method === 'POST') {
      const { user } = await session(body.email);
      const first = await database.db.business.create({
        data: {
          name: 'Harbor Fitness',
          ownerId: user.id,
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          access: { create: { userId: user.id, role: 'OWNER' } },
          branches: { create: [{ name: 'Central' }, { name: 'Riverside' }] },
        },
        include: { branches: true },
      });
      const second = await database.db.business.create({
        data: {
          name: 'Northside Gym',
          ownerId: randomUUID(),
          currency: 'USD',
          timezone: 'UTC',
          access: { create: { userId: user.id, role: 'ADMIN' } },
          branches: { create: { name: 'North' } },
        },
        include: { branches: true },
      });
      await database.db.auditEvent.create({
        data: {
          businessId: first.id,
          actorId: user.id,
          action: 'OWNER_ONBOARDED',
          targetId: first.id,
        },
      });
      return res.end(JSON.stringify({ first, second }));
    }
    if (url.pathname.endsWith('/otp')) return res.end('{}');
    if (url.pathname.endsWith('/verify')) {
      if (body.token !== '123456') {
        res.statusCode = 403;
        return res.end(
          JSON.stringify({ msg: 'Invalid code', error_code: 'otp_expired' }),
        );
      }
      return res.end(JSON.stringify(await session(body.email)));
    }
    if (url.pathname.endsWith('/token'))
      return res.end(JSON.stringify(await session('google-owner@example.com')));
    if (url.pathname.endsWith('/user')) {
      const user = sessions.get(req.headers.authorization?.slice(7));
      res.statusCode = user ? 200 : 401;
      return res.end(JSON.stringify(user || {}));
    }
    if (url.pathname.endsWith('/logout')) return res.end('{}');
    res.end('{}');
  });
  await new Promise((resolve) => provider.listen(3102, '127.0.0.1', resolve));
  const config = new ConfigService({
    DATABASE_URL: connection.href,
    SUPABASE_URL: 'http://127.0.0.1:3102',
    SUPABASE_PUBLISHABLE_KEY: 'fixture-publishable',
    SUPABASE_JWT_ALGORITHM: 'ES256',
    QR_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    WEB_ORIGIN: 'http://127.0.0.1:3100',
  });
  class FixtureModule {}
  const database = new DatabaseService(config);
  Module({
    controllers: [
      AttendanceController,
      AuthController,
      BusinessLogoController,
      DashboardController,
      BranchesController,
      StaffController,
      MembershipsController,
      FinanceController,
      PortalController,
      MemberInvitationsController,
      ReportsController,
      QrController,
      PublicQrController,
      MembersController,
      MembershipPlansController,
    ],
    providers: [
      AttendanceService,
      AuthService,
      AuthGuard,
      BusinessService,
      DashboardService,
      BranchesService,
      StaffService,
      BusinessScope,
      MembershipsService,
      FinanceService,
      PortalService,
      MemberInvitationsService,
      ReportsService,
      QrService,
      MembersService,
      MembershipPlansService,
      { provide: ConfigService, useValue: config },
      { provide: DatabaseService, useValue: database },
      {
        provide: MailService,
        useValue: {
          memberInvitation: async (email, token) => {
            outbox.push({ email, token, kind: 'member' });
            return true;
          },
          invitation: async (email, token) => {
            outbox.push({ email, token });
            return true;
          },
        },
      },
    ],
  })(FixtureModule);
  const app = await NestFactory.create(FixtureModule, { logger: false });
  app.enableCors({ origin: 'http://127.0.0.1:3100' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(3101, '127.0.0.1');
  const close = async () => {
    await app.close();
    provider.close();
  };
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
  console.log('Local authentication fixture ready');
}
main().catch(() => {
  console.error(
    'Unable to start authentication fixture; use a fresh local test database.',
  );
  process.exitCode = 1;
});
