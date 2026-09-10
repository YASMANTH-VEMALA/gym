require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { randomUUID } = require('node:crypto');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { Client } = require('pg');
const { NestFactory } = require('@nestjs/core');
const { Module, ValidationPipe } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { AuthService, AuthGuard } = require('../dist/modules/auth/auth.service');
const { AuthController } = require('../dist/modules/auth/auth.controller');
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

test(
  'branch migration preserves legacy branches and assigns codes per business',
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const connection = new URL(process.env.TEST_DATABASE_URL);
    if (
      !['127.0.0.1', 'localhost'].includes(connection.hostname) ||
      !connection.pathname.includes('auth_test')
    )
      throw new Error('Local auth_test database required');
    const sql = new Client({ connectionString: connection.href });
    await sql.connect();
    const schema = `migration_test_${randomUUID().replaceAll('-', '')}`;
    try {
      await sql.query(`CREATE SCHEMA "${schema}"`);
      await sql.query(`SET search_path TO "${schema}"`);
      await sql.query(
        readFileSync(
          resolve(
            __dirname,
            '../prisma/migrations/202609070001_auth_foundation/migration.sql',
          ),
          'utf8',
        ),
      );
      const businessId = randomUUID(),
        otherBusinessId = randomUUID(),
        branchId = randomUUID();
      await sql.query(
        'INSERT INTO "Business" (id, name, "ownerId") VALUES ($1, $2, $3), ($4, $5, $6)',
        [
          businessId,
          'Legacy Gym',
          randomUUID(),
          otherBusinessId,
          'Other Gym',
          randomUUID(),
        ],
      );
      await sql.query(
        'INSERT INTO "Branch" (id, "businessId", name) VALUES ($1,$2,$3), ($4,$5,$6)',
        [
          branchId,
          businessId,
          'Legacy Branch',
          randomUUID(),
          otherBusinessId,
          'Other Branch',
        ],
      );
      await sql.query(
        readFileSync(
          resolve(
            __dirname,
            '../prisma/migrations/202609070002_branch_management/migration.sql',
          ),
          'utf8',
        ),
      );
      const rows = (await sql.query('SELECT * FROM "Branch"')).rows;
      assert.equal(rows.length, 2);
      assert.ok(
        rows.every(
          (row) =>
            row.code === 'BR0001' &&
            row.status === 'ACTIVE' &&
            row.addressLine1 === null &&
            row.archivedAt === null,
        ),
      );
      assert.equal(
        rows.find((row) => row.id === branchId).name,
        'Legacy Branch',
      );
      assert.equal(
        rows.find((row) => row.id === branchId).businessId,
        businessId,
      );
      await sql.query(
        readFileSync(
          resolve(
            __dirname,
            '../prisma/migrations/202609070003_staff_management/migration.sql',
          ),
          'utf8',
        ),
      );
      await sql.query(
        readFileSync(
          resolve(
            __dirname,
            '../prisma/migrations/202609080004_staff_api_access/migration.sql',
          ),
          'utf8',
        ),
      );
      assert.deepEqual((await sql.query('SELECT * FROM "Branch"')).rows, rows);
      assert.equal(
        (await sql.query('SELECT count(*)::int AS count FROM "Staff"')).rows[0]
          .count,
        0,
      );
      const security = (
        await sql.query(
          "SELECT relrowsecurity FROM pg_class WHERE relnamespace = $1::regnamespace AND relname IN ('Staff', 'StaffBranchAssignment')",
          [schema],
        )
      ).rows;
      assert.equal(security.length, 2);
      assert.ok(security.every((item) => item.relrowsecurity));
      const staffId = randomUUID(),
        accessId = randomUUID();
      await sql.query(
        'INSERT INTO "Staff" (id, "businessId", "fullName", phone, "jobTitle", "joiningDate") VALUES ($1, $2, $3, $4, $5, $6)',
        [
          staffId,
          businessId,
          'Existing Trainer',
          '+919000000000',
          'Trainer',
          '2026-09-01',
        ],
      );
      await sql.query(
        'INSERT INTO "StaffBranchAssignment" ("staffId", "branchId") VALUES ($1,$2)',
        [staffId, branchId],
      );
      await sql.query(
        'INSERT INTO "BusinessAccess" ("businessId", "userId", role) VALUES ($1,$2,$3)',
        [businessId, accessId, 'ADMIN'],
      );
      await sql.query(
        'INSERT INTO "Invitation" (id, "businessId", email, "tokenHash", "invitedBy", "expiresAt") VALUES ($1,$2,$3,$4,$5,$6)',
        [
          randomUUID(),
          businessId,
          'existing@example.com',
          'a'.repeat(64),
          accessId,
          '2026-09-15',
        ],
      );
      await sql.query(
        'INSERT INTO "AuditEvent" (id, "businessId", "actorId", action, "targetId", metadata) VALUES ($1,$2,$3,$4,$5,$6)',
        [
          randomUUID(),
          businessId,
          accessId,
          'STAFF_CREATED',
          staffId,
          JSON.stringify({ staffName: 'Existing Trainer' }),
        ],
      );
      const preserved = {};
      for (const table of [
        'Business',
        'Branch',
        'Staff',
        'StaffBranchAssignment',
        'BusinessAccess',
        'Invitation',
        'AuditEvent',
      ])
        preserved[table] = (
          await sql.query(`SELECT * FROM "${table}" ORDER BY 1, 2`)
        ).rows;
      await sql.query(
        readFileSync(
          resolve(
            __dirname,
            '../prisma/migrations/202609080005_membership_plans/migration.sql',
          ),
          'utf8',
        ),
      );
      for (const [table, before] of Object.entries(preserved))
        assert.deepEqual(
          (await sql.query(`SELECT * FROM "${table}" ORDER BY 1, 2`)).rows,
          before,
        );
      assert.equal(
        (await sql.query('SELECT count(*)::int AS count FROM "MembershipPlan"'))
          .rows[0].count,
        0,
      );
      const planSecurity = (
        await sql.query(
          "SELECT relrowsecurity FROM pg_class WHERE relnamespace = $1::regnamespace AND relname IN ('MembershipPlan', 'PlanBranchAssignment')",
          [schema],
        )
      ).rows;
      assert.equal(planSecurity.length, 2);
      assert.ok(planSecurity.every((item) => item.relrowsecurity));
      const planId = randomUUID();
      await sql.query(
        'INSERT INTO "MembershipPlan" (id, "businessId", name, "priceMinor", "durationDays", "appliesToAllBranches") VALUES ($1,$2,$3,$4,$5,false)',
        [planId, businessId, 'Existing Plan', 120000, 30],
      );
      await sql.query(
        'INSERT INTO "PlanBranchAssignment" ("planId", "branchId") VALUES ($1,$2)',
        [planId, branchId],
      );
      const beforeMembers = {};
      for (const table of [
        ...Object.keys(preserved),
        'MembershipPlan',
        'PlanBranchAssignment',
      ])
        beforeMembers[table] = (
          await sql.query(`SELECT * FROM "${table}" ORDER BY 1,2`)
        ).rows;
      await sql.query(
        readFileSync(
          resolve(
            __dirname,
            '../prisma/migrations/202609080006_member_management/migration.sql',
          ),
          'utf8',
        ),
      );
      for (const [table, before] of Object.entries(beforeMembers))
        assert.deepEqual(
          (await sql.query(`SELECT * FROM "${table}" ORDER BY 1,2`)).rows,
          before,
        );
      assert.equal(
        (await sql.query('SELECT count(*)::int AS count FROM "Member"')).rows[0]
          .count,
        0,
      );
      const memberSecurity = (
        await sql.query(
          "SELECT relrowsecurity FROM pg_class WHERE relnamespace = $1::regnamespace AND relname IN ('Member', 'MemberCounter')",
          [schema],
        )
      ).rows;
      assert.equal(memberSecurity.length, 2);
      assert.ok(memberSecurity.every((item) => item.relrowsecurity));
      await sql.query(
        readFileSync(
          resolve(
            __dirname,
            '../prisma/migrations/202609080007_memberships/migration.sql',
          ),
          'utf8',
        ),
      );
      const legacyMemberId = randomUUID(),
        legacyMembershipId = randomUUID();
      await sql.query(
        'INSERT INTO "Member" (id,"businessId","memberNumber","fullName",phone,"currentPhone","joiningDate","updatedAt") VALUES ($1,$2,\'MEM000001\',\'Legacy Member\',\'1234567890\',\'1234567890\',\'2026-09-01\',now())',
        [legacyMemberId, businessId],
      );
      await sql.query(
        'INSERT INTO "Membership" (id,"businessId","memberId","branchId","planId","planNameSnapshot","priceMinorSnapshot","durationDaysSnapshot","startDate","endDate","idempotencyKey") VALUES ($1,$2,$3,$4,$5,\'Existing Plan\',120000,30,\'2026-09-01\',\'2026-09-30\',$6)',
        [
          legacyMembershipId,
          businessId,
          legacyMemberId,
          branchId,
          planId,
          randomUUID(),
        ],
      );
      const legacyMembership = (await sql.query('SELECT * FROM "Membership"'))
        .rows;
      await sql.query(
        readFileSync(
          resolve(
            __dirname,
            '../prisma/migrations/202609080008_payments_dues/migration.sql',
          ),
          'utf8',
        ),
      );
      assert.deepEqual(
        (await sql.query('SELECT * FROM "Membership"')).rows,
        legacyMembership,
      );
      const backfilled = (
        await sql.query(
          'SELECT "membershipId","originalAmountMinor",to_char("dueDate",\'YYYY-MM-DD\') AS date FROM "Receivable"',
        )
      ).rows;
      assert.deepEqual(backfilled, [
        {
          membershipId: legacyMembershipId,
          originalAmountMinor: 120000,
          date: '2026-09-01',
        },
      ]);
      for (const [table, before] of Object.entries(beforeMembers))
        assert.deepEqual(
          (await sql.query(`SELECT * FROM "${table}" ORDER BY 1,2`)).rows,
          before,
        );
    } finally {
      await sql.query('ROLLBACK');
      await sql.query(`DROP SCHEMA "${schema}" CASCADE`);
      await sql.end();
    }
  },
);

test(
  'authenticated REST workflows against isolated PostgreSQL',
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    const connection = new URL(process.env.TEST_DATABASE_URL);
    if (
      !['127.0.0.1', 'localhost'].includes(connection.hostname) ||
      !connection.pathname.includes('auth_test')
    )
      throw new Error('Use a local database whose name includes auth_test');
    const sql = new Client({ connectionString: connection.href });
    await sql.connect();
    // This test requires a fresh disposable database, and never drops existing data.
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
    const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
    const pair = await generateKeyPair('ES256');
    const jwk = {
      ...(await exportJWK(pair.publicKey)),
      kid: 'integration',
      alg: 'ES256',
    };
    const users = new Map();
    let providerUnavailable = false;
    const provider = createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url.endsWith('/.well-known/jwks.json'))
        return res.end(JSON.stringify({ keys: [jwk] }));
      if (providerUnavailable) {
        res.statusCode = 503;
        return res.end('{}');
      }
      const user = users.get(req.headers.authorization?.slice(7));
      if (!user) {
        res.statusCode = 401;
        return res.end('{}');
      }
      res.end(JSON.stringify(user));
    });
    await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${provider.address().port}`;
    const config = new ConfigService({
      DATABASE_URL: connection.href,
      SUPABASE_URL: url,
      SUPABASE_PUBLISHABLE_KEY: 'test-public-key',
      SUPABASE_JWT_ALGORITHM: 'ES256',
      QR_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      WEB_ORIGIN: 'http://localhost:3000',
    });
    const database = new DatabaseService(config);
    let deliveryOk = true;
    const sent = [];
    const mail = {
      memberInvitation: async (email, token) => {
        sent.push({ email, token, kind: 'member' });
        return deliveryOk;
      },
      invitation: async (email, token) => {
        sent.push({ email, token });
        return deliveryOk;
      },
    };
    class TestModule {}
    Module({
      controllers: [
        AttendanceController,
        AuthController,
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
        { provide: MailService, useValue: mail },
      ],
    })(TestModule);
    const app = await NestFactory.create(TestModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    async function user(email, confirmed = true, role = 'authenticated') {
      const id = randomUUID();
      const token = await new SignJWT({ role })
        .setProtectedHeader({ alg: 'ES256', kid: 'integration' })
        .setSubject(id)
        .setIssuer(`${url}/auth/v1`)
        .setAudience('authenticated')
        .setIssuedAt()
        .setExpirationTime('10m')
        .sign(pair.privateKey);
      users.set(token, {
        id,
        email,
        email_confirmed_at: confirmed ? new Date().toISOString() : null,
        aud: 'authenticated',
        role,
      });
      return { id, token };
    }
    async function request(actor, path, body, method) {
      const result = await fetch(`${base}/api/v1${path}`, {
        method: method || (body === undefined ? 'GET' : 'POST'),
        headers: {
          ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}),
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: result.status, body: await result.json() };
    }
    const owner = await user('owner@example.com');
    const admin = await user('Admin+team@Example.com');
    const outsider = await user('other@example.com');
    const onboarding = {
      name: 'Gym One',
      branchName: 'Central',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
    };
    let businessId;
    try {
      await t.test('JWT guard and retry-safe owner onboarding', async () => {
        assert.equal((await request(null, '/me/businesses')).status, 401);
        assert.equal(
          (
            await request(
              await user('service@example.com', true, 'service_role'),
              '/me/businesses',
            )
          ).status,
          401,
        );
        const results = await Promise.all([
          request(owner, '/onboarding', onboarding),
          request(owner, '/onboarding', onboarding),
        ]);
        assert.equal(results[0].status, 201);
        assert.equal(results[1].status, 201);
        businessId = results[0].body.id;
        assert.equal(results[1].body.id, businessId);
        assert.equal(await database.db.business.count(), 1);
        assert.equal(await database.db.branch.count(), 1);
        assert.equal(
          (
            await request(owner, '/onboarding', {
              ...onboarding,
              timezone: 'invalid',
            })
          ).status,
          400,
        );
      });
      const path = () => `/businesses/${businessId}/invitations`;
      await t.test(
        'owner-only, tenant isolation, hash-only persistence and matching verified email',
        async () => {
          assert.equal((await request(outsider, path())).status, 403);
          assert.equal(
            (await request(outsider, path(), { email: 'victim@example.com' }))
              .status,
            403,
          );
          const invite = await request(owner, path(), {
            email: ' Admin+team@Example.com ',
          });
          assert.equal(invite.status, 201);
          assert.equal(invite.body.deliveryStatus, 'SENT');
          const token = sent.at(-1).token;
          const record = await database.db.invitation.findUnique({
            where: { id: invite.body.id },
          });
          assert.equal(record.email, 'admin+team@example.com');
          assert.match(record.tokenHash, /^[a-f0-9]{64}$/);
          assert.ok(!JSON.stringify(record).includes(token));
          assert.ok(!JSON.stringify(invite.body).includes('tokenHash'));
          assert.equal(
            (await request(outsider, '/invitations/accept', { token })).status,
            403,
          );
          assert.equal(
            (
              await request(
                await user('admin+team@example.com', false),
                '/invitations/accept',
                { token },
              )
            ).status,
            401,
          );
          const results = await Promise.all([
            request(admin, '/invitations/accept', { token }),
            request(admin, '/invitations/accept', { token }),
          ]);
          assert.ok(results.every((result) => result.status === 201));
          assert.equal(
            await database.db.businessAccess.count({
              where: { userId: admin.id },
            }),
            1,
          );
          assert.equal(
            (await request(admin, path(), { email: 'someone@example.com' }))
              .status,
            403,
          );
          assert.equal(
            (
              await request(
                await user('admin+team@example.com'),
                '/invitations/accept',
                { token },
              )
            ).status,
            409,
          );
          const audits = await database.db.auditEvent.findMany();
          assert.ok(!JSON.stringify(audits).includes(token));
        },
      );
      await t.test(
        'expiry, revocation, resend rotation and delivery failures',
        async () => {
          deliveryOk = false;
          const invite = await request(owner, path(), {
            email: 'other@example.com',
          });
          assert.equal(invite.body.deliveryStatus, 'FAILED');
          const old = sent.at(-1).token;
          await database.db.invitation.update({
            where: { id: invite.body.id },
            data: { expiresAt: new Date(Date.now() - 1000) },
          });
          assert.equal(
            (await request(outsider, '/invitations/accept', { token: old }))
              .status,
            400,
          );
          deliveryOk = true;
          assert.equal(
            (await request(owner, `${path()}/${invite.body.id}/resend`, {}))
              .body.deliveryStatus,
            'SENT',
          );
          const fresh = sent.at(-1).token;
          assert.notEqual(old, fresh);
          assert.equal(
            (await request(outsider, '/invitations/accept', { token: old }))
              .status,
            400,
          );
          assert.equal(
            (await request(owner, `${path()}/${invite.body.id}/revoke`, {}))
              .status,
            201,
          );
          assert.equal(
            (await request(outsider, '/invitations/accept', { token: fresh }))
              .status,
            400,
          );
        },
      );
      await t.test(
        'existing Owner is never downgraded; provider failure cannot grant access',
        async () => {
          await request(owner, path(), { email: 'owner@example.com' });
          const token = sent.at(-1).token;
          providerUnavailable = true;
          assert.notEqual(
            (await request(owner, '/invitations/accept', { token })).status,
            201,
          );
          providerUnavailable = false;
          assert.equal(
            (await request(owner, '/invitations/accept', { token })).status,
            201,
          );
          assert.equal(
            (await request(owner, '/me/businesses')).body[0].role,
            'OWNER',
          );
        },
      );
      await t.test(
        'dashboard enforces tenant/branch authorization and returns real foundation data with empty future domains',
        async () => {
          const other = await request(outsider, '/onboarding', {
            ...onboarding,
            name: 'Other Gym',
          });
          const otherBranches = await database.db.branch.findMany({
            where: { businessId: other.body.id },
          });
          const ownBranches = await database.db.branch.findMany({
            where: { businessId },
          });
          const dashboardPath = `/businesses/${businessId}/dashboard`;
          assert.equal((await request(null, dashboardPath)).status, 401);
          assert.equal((await request(outsider, dashboardPath)).status, 403);
          assert.equal(
            (await request(owner, `/businesses/${other.body.id}/dashboard`))
              .status,
            403,
          );
          assert.equal(
            (
              await request(
                owner,
                `${dashboardPath}?branchId=${otherBranches[0].id}`,
              )
            ).status,
            403,
          );
          assert.equal(
            (await request(owner, `${dashboardPath}?branchId=bad`)).status,
            400,
          );
          assert.equal(
            (await request(owner, `${dashboardPath}?unexpected=yes`)).status,
            400,
          );
          const result = await request(owner, dashboardPath);
          assert.equal(result.status, 200);
          assert.equal(result.body.business.name, 'Gym One');
          assert.equal(result.body.role, 'OWNER');
          assert.equal(result.body.branchSummary.total, 1);
          assert.equal(result.body.branchSummary.selected, null);
          assert.ok(
            Object.values(result.body.metrics).every((value) => value === 0),
          );
          assert.deepEqual(result.body.chartData, {
            collections: [],
            memberGrowth: [],
          });
          assert.deepEqual(result.body.outstandingDues, []);
          assert.deepEqual(result.body.upcomingExpirations, []);
          const ownAudits = await database.db.auditEvent.findMany({
            where: { businessId },
          });
          assert.ok(result.body.recentActivity.length > 0);
          assert.ok(
            result.body.recentActivity.every((event) =>
              ownAudits.some((audit) => audit.id === event.id),
            ),
          );
          assert.ok(
            result.body.recentActivity.every(
              (event) => !('actorId' in event) && !('targetId' in event),
            ),
          );
          const branchResult = await request(
            admin,
            `${dashboardPath}?branchId=${ownBranches[0].id}`,
          );
          assert.equal(branchResult.status, 200);
          assert.equal(branchResult.body.role, 'ADMIN');
          assert.equal(branchResult.body.branchSummary.inScope, 1);
          assert.equal(
            branchResult.body.branchSummary.selected.id,
            ownBranches[0].id,
          );
          assert.equal(branchResult.body.activityScope, 'business');
          assert.equal(await database.db.invitation.count(), 3);
        },
      );
      await t.test(
        'branch CRUD, tenant boundaries, validation and archive history',
        async () => {
          const basePath = `/businesses/${businessId}/branches`;
          const input = {
            name: 'Ongole Main',
            code: ' ong001 ',
            addressLine1: '12 Main Road',
            city: 'Ongole',
            state: 'Andhra Pradesh',
            postalCode: '00120',
            country: 'India',
            phone: '+91 98765 43210',
            email: 'branch@example.com',
          };
          assert.equal((await request(null, basePath)).status, 401);
          assert.equal((await request(outsider, basePath)).status, 403);
          assert.equal((await request(outsider, basePath, input)).status, 403);
          const created = await request(owner, basePath, input);
          assert.equal(created.status, 201);
          assert.equal(created.body.code, 'ONG001');
          assert.equal(created.body.postalCode, '00120');
          const id = created.body.id;
          assert.equal((await request(admin, basePath, input)).status, 409);
          const adminCreated = await request(admin, basePath, {
            ...input,
            code: 'adm001',
            name: 'Admin Branch',
          });
          assert.equal(adminCreated.status, 201);
          const generated = await Promise.all([
            request(owner, basePath, { ...input, code: '' }),
            request(admin, basePath, { ...input, code: '' }),
          ]);
          assert.ok(generated.every((value) => value.status === 201));
          assert.notEqual(generated[0].body.code, generated[1].body.code);
          const otherBusiness = (await request(outsider, '/me/businesses'))
            .body[0].businessId;
          const otherPath = `/businesses/${otherBusiness}/branches`;
          const sameCode = await request(outsider, otherPath, input);
          assert.equal(sameCode.status, 201);
          for (const method of ['GET', 'PATCH', 'ARCHIVE']) {
            const suffix = method === 'ARCHIVE' ? '/archive' : '';
            const data =
              method === 'GET'
                ? undefined
                : method === 'PATCH'
                  ? { name: 'Forged' }
                  : {};
            const httpMethod = method === 'PATCH' ? 'PATCH' : undefined;
            assert.equal(
              (
                await request(
                  owner,
                  `${basePath}/${sameCode.body.id}${suffix}`,
                  data,
                  httpMethod,
                )
              ).status,
              404,
            );
            assert.equal(
              (
                await request(
                  owner,
                  `${otherPath}/${id}${suffix}`,
                  data,
                  httpMethod,
                )
              ).status,
              403,
            );
            assert.equal(
              (
                await request(
                  outsider,
                  `${basePath}/${id}${suffix}`,
                  data,
                  httpMethod,
                )
              ).status,
              403,
            );
          }
          for (const invalid of [
            { name: '' },
            { name: null },
            { email: 'bad' },
            { phone: 'abc' },
            { timezone: 'Not/AZone' },
            { postalCode: 123 },
            { code: 'bad code' },
            { businessId: otherBusiness },
            { status: 'ARCHIVED' },
          ]) {
            assert.equal(
              (await request(owner, `${basePath}/${id}`, invalid, 'PATCH'))
                .status,
              400,
              JSON.stringify(invalid),
            );
          }
          assert.equal(
            (await request(owner, basePath, { name: 'Missing address' }))
              .status,
            400,
          );
          const updated = await request(
            admin,
            `${basePath}/${id}`,
            {
              name: 'Ongole Central',
              timezone: 'Europe/London',
              addressLine2: 'Floor 2',
            },
            'PATCH',
          );
          assert.equal(updated.status, 200);
          let detail = (await request(admin, `${basePath}/${id}`)).body;
          assert.equal(detail.effectiveTimezone, 'Europe/London');
          assert.ok(
            Object.values(detail.metrics).every((value) => value === 0),
          );
          assert.equal(
            (
              await request(
                owner,
                `${basePath}/${id}`,
                { code: 'ADM001' },
                'PATCH',
              )
            ).status,
            409,
          );
          await request(
            owner,
            `${basePath}/${id}`,
            { timezone: '', phone: '', email: '' },
            'PATCH',
          );
          detail = (await request(owner, `${basePath}/${id}`)).body;
          assert.equal(detail.effectiveTimezone, 'Asia/Kolkata');
          assert.equal(detail.phone, null);
          assert.equal(detail.email, null);
          assert.equal(
            (await request(admin, `${basePath}/${id}/archive`, {})).status,
            403,
          );
          assert.equal(
            (await request(owner, `${basePath}/${id}/archive`, {})).status,
            201,
          );
          assert.equal(
            (await request(owner, `${basePath}/${id}/archive`, {})).status,
            201,
          );
          const persisted = await database.db.branch.findUnique({
            where: { id },
          });
          assert.equal(persisted.status, 'ARCHIVED');
          assert.ok(persisted.archivedAt);
          assert.equal(
            (
              await request(
                owner,
                `${basePath}/${id}`,
                { name: 'Changed' },
                'PATCH',
              )
            ).body.code,
            'BRANCH_ARCHIVED',
          );
          assert.equal(
            (await request(admin, `${basePath}/${id}`)).body.status,
            'ARCHIVED',
          );
          assert.ok(
            !(await request(owner, basePath)).body.items.some(
              (branch) => branch.id === id,
            ),
          );
          assert.equal(
            (await request(owner, `${basePath}?status=ARCHIVED&search=central`))
              .body.items[0].id,
            id,
          );
          assert.equal(
            (await request(owner, `${basePath}?status=ALL&pageSize=1&page=2`))
              .body.items.length,
            1,
          );
          assert.equal(
            (await request(owner, `${basePath}?search=adm001`)).body.items[0]
              .id,
            adminCreated.body.id,
          );
          assert.equal(
            (await request(owner, `${basePath}?status=bad`)).status,
            400,
          );
          const audits = await database.db.auditEvent.findMany({
            where: { targetId: id },
          });
          for (const action of [
            'BRANCH_CREATED',
            'BRANCH_UPDATED',
            'BRANCH_ARCHIVED',
          ])
            assert.ok(audits.some((event) => event.action === action));
          assert.equal(
            audits.filter((event) => event.action === 'BRANCH_ARCHIVED').length,
            1,
          );
          assert.ok(
            audits.every(
              (event) => Object.keys(event.metadata).join() === 'branchName',
            ),
          );
          const dashboard = (
            await request(owner, `/businesses/${businessId}/dashboard`)
          ).body;
          assert.ok(
            dashboard.recentActivity.some((event) =>
              event.label.includes('Branch archived: Ongole Central'),
            ),
          );
          assert.equal(
            (
              await request(
                owner,
                `/businesses/${businessId}/dashboard?branchId=${id}`,
              )
            ).status,
            403,
          );
          assert.equal(
            (await request(owner, `${basePath}/${id}`, undefined, 'DELETE'))
              .status,
            404,
          );
        },
      );
      await t.test(
        'concurrent archive requests preserve the final active branch',
        async () => {
          const actor = await user('concurrent-branches@example.com');
          const business = (
            await request(actor, '/onboarding', {
              ...onboarding,
              name: 'Concurrent Gym',
            })
          ).body;
          const path = `/businesses/${business.id}/branches`;
          const initial = (await request(actor, path)).body.items[0];
          assert.equal(
            (await request(actor, `${path}/${initial.id}/archive`, {})).body
              .code,
            'LAST_ACTIVE_BRANCH',
          );
          const created = (
            await request(actor, path, {
              name: 'Second',
              addressLine1: '1 Street',
              city: 'London',
              state: 'London',
              country: 'UK',
              postalCode: 'SW1A 1AA',
            })
          ).body;
          const results = await Promise.all(
            [initial.id, created.id].map((id) =>
              request(actor, `${path}/${id}/archive`, {}),
            ),
          );
          assert.deepEqual(
            results.map((value) => value.status).sort(),
            [201, 409],
          );
          assert.equal(
            results.find((value) => value.status === 409).body.code,
            'LAST_ACTIVE_BRANCH',
          );
          assert.equal((await request(actor, path)).body.total, 1);
          assert.equal(
            (await request(actor, `${path}?status=ALL`)).body.total,
            2,
          );
        },
      );
      await t.test(
        'staff CRUD, assignments, counts, archive history and tenant isolation',
        async () => {
          const staffPath = `/businesses/${businessId}/staff`;
          const branches = (
            await request(owner, `/businesses/${businessId}/branches`)
          ).body.items;
          assert.ok(branches.length >= 2);
          const input = {
            fullName: 'Ravi Kumar',
            phone: '+91 90000 00001',
            email: 'ravi@example.com',
            jobTitle: 'Trainer',
            gender: 'Male',
            dateOfBirth: '1992-02-29',
            joiningDate: '2026-09-07',
            address: 'Ongole',
            emergencyContactName: 'Sai',
            emergencyContactPhone: '+91 90000 00002',
            notes: 'First aid trained',
            status: 'ACTIVE',
            branchIds: [branches[0].id],
          };
          assert.equal((await request(null, staffPath)).status, 401);
          assert.equal((await request(outsider, staffPath)).status, 403);
          const ownerCreated = await request(owner, staffPath, input);
          assert.equal(ownerCreated.status, 201);
          assert.deepEqual(
            ownerCreated.body.branches.map((branch) => branch.id),
            [branches[0].id],
          );
          const adminCreated = await request(admin, staffPath, {
            ...input,
            fullName: 'Sai Manager',
            phone: '+91 90000 00003',
            email: null,
            dateOfBirth: null,
            jobTitle: 'Manager',
            branchIds: [branches[0].id, branches[1].id],
          });
          assert.equal(adminCreated.status, 201);
          assert.equal(adminCreated.body.branches.length, 2);
          const id = ownerCreated.body.id;
          assert.equal(
            (await request(admin, `${staffPath}/${id}`)).body.fullName,
            'Ravi Kumar',
          );
          const updated = await request(
            admin,
            `${staffPath}/${id}`,
            {
              fullName: 'Ravi K',
              status: 'INACTIVE',
              branchIds: [branches[1].id],
            },
            'PATCH',
          );
          assert.equal(updated.status, 200);
          assert.equal(updated.body.status, 'INACTIVE');
          assert.deepEqual(
            updated.body.branches.map((branch) => branch.id),
            [branches[1].id],
          );
          assert.equal((await request(owner, staffPath)).body.total, 1);
          assert.equal(
            (
              await request(
                owner,
                `${staffPath}?status=INACTIVE&search=ravi&branchId=${branches[1].id}`,
              )
            ).body.items[0].id,
            id,
          );
          assert.equal(
            (await request(owner, `${staffPath}?jobTitle=manager`)).body
              .items[0].id,
            adminCreated.body.id,
          );
          assert.equal(
            (await request(owner, `${staffPath}?branchId=${randomUUID()}`))
              .status,
            404,
          );
          const otherBusiness = (await request(outsider, '/me/businesses'))
            .body[0].businessId;
          const foreignBranch = (
            await request(outsider, `/businesses/${otherBusiness}/branches`)
          ).body.items[0];
          const foreignStaff = await request(
            outsider,
            `/businesses/${otherBusiness}/staff`,
            {
              ...input,
              email: 'foreign@example.com',
              branchIds: [foreignBranch.id],
            },
          );
          assert.equal(foreignStaff.status, 201);
          assert.equal(
            (
              await request(owner, staffPath, {
                ...input,
                branchIds: [foreignBranch.id],
              })
            ).body.code,
            'INVALID_BRANCH_ASSIGNMENT',
          );
          assert.equal(
            (
              await request(
                owner,
                `${staffPath}/${id}`,
                { branchIds: [foreignBranch.id] },
                'PATCH',
              )
            ).body.code,
            'INVALID_BRANCH_ASSIGNMENT',
          );
          for (const path of [
            `${staffPath}/${foreignStaff.body.id}`,
            `/businesses/${otherBusiness}/staff/${id}`,
          ]) {
            assert.ok([403, 404].includes((await request(owner, path)).status));
            assert.ok(
              [403, 404].includes(
                (await request(owner, path, { fullName: 'Forged' }, 'PATCH'))
                  .status,
              ),
            );
            assert.ok(
              [403, 404].includes(
                (await request(owner, `${path}/archive`, {})).status,
              ),
            );
          }
          assert.equal(
            (
              await request(owner, staffPath, {
                ...input,
                joiningDate: '2026-02-30',
              })
            ).status,
            400,
          );
          assert.equal(
            (await request(owner, staffPath, { ...input, branchIds: [] }))
              .status,
            400,
          );
          assert.equal(
            (await request(owner, staffPath, { ...input, businessId })).status,
            400,
          );
          assert.equal(
            (await request(owner, staffPath, { ...input, status: 'ARCHIVED' }))
              .status,
            400,
          );
          const archivedBranch = (
            await request(
              owner,
              `/businesses/${businessId}/branches?status=ARCHIVED`,
            )
          ).body.items[0];
          assert.equal(
            (
              await request(owner, staffPath, {
                ...input,
                branchIds: [archivedBranch.id],
              })
            ).body.code,
            'ARCHIVED_BRANCH_ASSIGNMENT',
          );
          assert.equal(
            (await request(admin, `${staffPath}/${id}/archive`, {})).status,
            201,
          );
          assert.equal(
            (await request(owner, `${staffPath}/${id}/archive`, {})).status,
            201,
          );
          assert.equal(
            (
              await request(
                owner,
                `${staffPath}/${id}`,
                { status: 'ACTIVE' },
                'PATCH',
              )
            ).body.code,
            'STAFF_ARCHIVED',
          );
          assert.ok(
            !(await request(owner, staffPath)).body.items.some(
              (staff) => staff.id === id,
            ),
          );
          assert.equal(
            (await request(owner, `${staffPath}?status=ARCHIVED`)).body.items[0]
              .id,
            id,
          );
          assert.equal(
            (await database.db.staff.findUnique({ where: { id } })).status,
            'ARCHIVED',
          );
          assert.equal(
            await database.db.staffBranchAssignment.count({
              where: { staffId: id },
            }),
            1,
          );
          const branchDetail = (
            await request(
              owner,
              `/businesses/${businessId}/branches/${branches[0].id}`,
            )
          ).body;
          assert.equal(branchDetail.metrics.staff, 1);
          assert.equal(branchDetail.staffCount, 1);
          const dashboard = (
            await request(owner, `/businesses/${businessId}/dashboard`)
          ).body;
          assert.equal(dashboard.metrics.totalStaff, 1);
          assert.ok(
            dashboard.recentActivity.some((event) =>
              event.label.includes('Staff archived: Ravi K'),
            ),
          );
          const branchDashboard = (
            await request(
              owner,
              `/businesses/${businessId}/dashboard?branchId=${branches[0].id}`,
            )
          ).body;
          assert.equal(branchDashboard.metrics.totalStaff, 1);
          const links = await database.db.staffBranchAssignment.findMany({
            where: { staffId: adminCreated.body.id },
            orderBy: { branchId: 'asc' },
          });
          assert.equal(
            (
              await request(
                owner,
                `/businesses/${businessId}/branches/${branches[0].id}/archive`,
                {},
              )
            ).status,
            201,
          );
          const retained = await request(
            admin,
            `${staffPath}/${adminCreated.body.id}`,
            {
              branchIds: [branches[0].id, branches[1].id],
              notes: 'Historical branch retained',
            },
            'PATCH',
          );
          assert.equal(retained.status, 200);
          assert.equal(
            retained.body.branches.find(
              (branch) => branch.id === branches[0].id,
            ).status,
            'ARCHIVED',
          );
          assert.deepEqual(
            await database.db.staffBranchAssignment.findMany({
              where: { staffId: adminCreated.body.id },
              orderBy: { branchId: 'asc' },
            }),
            links,
          );
          assert.equal(
            (
              await request(admin, staffPath, {
                ...input,
                branchIds: [branches[0].id],
              })
            ).status,
            409,
          );
          for (const invalid of [
            { status: null },
            { fullName: null },
            { joiningDate: null },
            { branchIds: null },
            { branchIds: [randomUUID()] },
            { branchIds: [branches[1].id, branches[1].id] },
          ]) {
            assert.equal(
              (
                await request(
                  admin,
                  `${staffPath}/${adminCreated.body.id}`,
                  invalid,
                  'PATCH',
                )
              ).status,
              400,
              JSON.stringify(invalid),
            );
          }
          assert.equal(
            (await request(owner, `${staffPath}?status=ALL&pageSize=1&page=2`))
              .body.items.length,
            1,
          );
          assert.equal((await request(owner, `/me/businesses`)).body.length, 1);
          assert.equal(
            await database.db.businessAccess.count({
              where: { userId: adminCreated.body.id },
            }),
            0,
          );
          const audits = await database.db.auditEvent.findMany({
            where: { targetId: id },
          });
          for (const action of [
            'STAFF_CREATED',
            'STAFF_UPDATED',
            'STAFF_ARCHIVED',
          ])
            assert.ok(audits.some((event) => event.action === action));
          assert.equal(
            audits.filter((event) => event.action === 'STAFF_ARCHIVED').length,
            1,
          );
          assert.ok(
            audits.every(
              (event) => Object.keys(event.metadata).join() === 'staffName',
            ),
          );
          assert.equal(
            (await request(owner, `${staffPath}/${id}`, undefined, 'DELETE'))
              .status,
            404,
          );
        },
      );
      await t.test(
        'membership plans: roles, exact money, eligibility, lifecycle, isolation and audit',
        async () => {
          const planOwner = await user('plans-owner@example.com');
          const onboarded = await request(planOwner, '/onboarding', {
            ...onboarding,
            name: 'Plans Gym',
          });
          assert.equal(onboarded.status, 201);
          const biz = onboarded.body.id;
          assert.ok(biz);
          await database.db.businessAccess.create({
            data: { businessId: biz, userId: admin.id, role: 'ADMIN' },
          });
          const path = `/businesses/${biz}/membership-plans`;
          const branchPath = `/businesses/${biz}/branches`;
          const original = await database.db.branch.findFirstOrThrow({
            where: { businessId: biz },
          });
          const input = {
            name: 'Monthly',
            priceMinor: 120029,
            durationDays: 30,
            appliesToAllBranches: true,
          };
          assert.equal((await request(null, path)).status, 401);
          for (const [method, body] of [
            ['GET', undefined],
            ['POST', input],
          ])
            assert.equal(
              (await request(outsider, path, body, method)).status,
              403,
            );
          const created = await request(planOwner, path, input);
          assert.equal(created.status, 201);
          const id = created.body.id;
          assert.equal(created.body.priceMinor, 120029);
          assert.deepEqual(created.body.branches, []);
          assert.equal(
            await database.db.planBranchAssignment.count({
              where: { planId: id },
            }),
            0,
          );
          assert.equal(
            (
              await database.db.membershipPlan.findUniqueOrThrow({
                where: { id },
              })
            ).priceMinor,
            120029,
          );
          assert.equal(
            (await request(admin, `${path}/${id}`)).body.eligibleBranches
              .length,
            1,
          );
          const newBranch = await request(admin, branchPath, {
            name: 'Future Branch',
            addressLine1: '1 Road',
            city: 'Pune',
            state: 'Maharashtra',
            postalCode: '411001',
            country: 'India',
          });
          assert.equal(newBranch.status, 201);
          assert.equal(
            (await request(planOwner, `${path}/${id}`)).body.eligibleBranches
              .length,
            2,
          );
          const selected = await request(admin, path, {
            ...input,
            name: 'Quarterly',
            priceMinor: 320000,
            durationDays: 90,
            appliesToAllBranches: false,
            branchIds: [original.id, newBranch.body.id],
          });
          assert.equal(selected.status, 201);
          const selectedPath = `${path}/${selected.body.id}`;
          assert.equal(selected.body.branches.length, 2);
          assert.equal(
            (await request(planOwner, `${path}?branchId=${original.id}`)).body
              .total,
            2,
          );
          assert.equal(
            (await request(planOwner, `${path}?search=quarter&pageSize=1`)).body
              .items[0].id,
            selected.body.id,
          );
          assert.equal(
            (await request(planOwner, `${path}?pageSize=1&page=2`)).body.items
              .length,
            1,
          );
          for (const invalid of [
            { name: '' },
            { name: 'x'.repeat(121) },
            { description: 'x'.repeat(2001) },
            ...[0, -1, 1.5, '120000', 1000000001, null].map((priceMinor) => ({
              priceMinor,
            })),
            ...[0, -1, 30.5, '30', 3651, null].map((durationDays) => ({
              durationDays,
            })),
            { status: 'ARCHIVED' },
            { status: null },
            { appliesToAllBranches: null },
            { branchIds: null },
            { appliesToAllBranches: false, branchIds: [] },
            {
              appliesToAllBranches: false,
              branchIds: [original.id, original.id],
            },
            { branchIds: [original.id] },
            { currency: 'USD' },
          ]) {
            assert.equal(
              (await request(admin, path, { ...input, ...invalid })).status,
              400,
              JSON.stringify(invalid),
            );
            assert.equal(
              (await request(admin, `${path}/${id}`, invalid, 'PATCH')).status,
              400,
              JSON.stringify(invalid),
            );
          }
          const otherBiz = (
            await database.db.business.findFirstOrThrow({
              where: { ownerId: outsider.id },
            })
          ).id;
          const foreignBranch = await database.db.branch.findFirstOrThrow({
            where: { businessId: otherBiz },
          });
          assert.equal(
            (
              await request(admin, path, {
                ...input,
                appliesToAllBranches: false,
                branchIds: [foreignBranch.id],
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await request(
                admin,
                selectedPath,
                { branchIds: [foreignBranch.id] },
                'PATCH',
              )
            ).status,
            400,
          );
          assert.equal(
            (await request(admin, `${path}?branchId=${foreignBranch.id}`))
              .status,
            404,
          );
          const foreignPath = `/businesses/${otherBiz}/membership-plans`;
          assert.equal(
            (await request(outsider, foreignPath, input)).status,
            201,
            'same name is allowed in another business',
          );
          for (const [method, suffix, body] of [
            ['GET', '', undefined],
            ['PATCH', '', { name: 'Stolen' }],
            ['POST', '/archive', {}],
          ]) {
            assert.equal(
              (await request(outsider, `${path}/${id}${suffix}`, body, method))
                .status,
              403,
            );
            assert.equal(
              (
                await request(
                  outsider,
                  `${foreignPath}/${id}${suffix}`,
                  body,
                  method,
                )
              ).status,
              404,
            );
          }
          const updated = await request(
            admin,
            `${path}/${id}`,
            {
              name: 'Monthly Plus',
              priceMinor: 9999,
              durationDays: 365,
              status: 'INACTIVE',
            },
            'PATCH',
          );
          assert.equal(updated.status, 200);
          assert.equal(updated.body.priceMinor, 9999);
          assert.equal(updated.body.durationDays, 365);
          assert.deepEqual(
            (await request(admin, `${path}/${id}`)).body.eligibleBranches,
            [],
          );
          assert.equal((await request(admin, path)).body.total, 1);
          assert.equal(
            (await request(admin, `${path}?status=INACTIVE`)).body.total,
            1,
          );
          assert.equal(
            (
              await request(
                planOwner,
                `${path}/${id}`,
                { status: 'ACTIVE' },
                'PATCH',
              )
            ).status,
            200,
          );
          assert.equal(
            (await request(admin, `${path}/${id}`)).body.eligibleBranches
              .length,
            2,
          );
          assert.equal(
            (
              await request(
                admin,
                `${path}/${id}`,
                { appliesToAllBranches: false, branchIds: [original.id] },
                'PATCH',
              )
            ).body.branches.length,
            1,
          );
          assert.equal(
            (
              await request(
                admin,
                `${path}/${id}`,
                { appliesToAllBranches: true },
                'PATCH',
              )
            ).body.branches.length,
            0,
          );
          assert.equal(
            (
              await request(
                planOwner,
                `${branchPath}/${newBranch.body.id}/archive`,
                {},
              )
            ).status,
            201,
          );
          const history = (await request(admin, selectedPath)).body;
          assert.equal(history.branches.length, 2);
          assert.deepEqual(
            history.eligibleBranches.map((branch) => branch.id),
            [original.id],
          );
          assert.equal(
            (
              await request(
                admin,
                selectedPath,
                { description: 'Retained history' },
                'PATCH',
              )
            ).status,
            200,
          );
          assert.equal(
            (
              await request(admin, path, {
                ...input,
                appliesToAllBranches: false,
                branchIds: [newBranch.body.id],
              })
            ).status,
            409,
          );
          assert.equal(
            (
              await request(
                admin,
                `${path}/${id}`,
                { appliesToAllBranches: false, branchIds: [newBranch.body.id] },
                'PATCH',
              )
            ).status,
            409,
          );
          assert.equal(
            (await request(admin, `${path}?branchId=${newBranch.body.id}`))
              .status,
            400,
          );
          const archived = await request(admin, `${selectedPath}/archive`, {});
          assert.equal(archived.status, 201);
          assert.ok(archived.body.archivedAt);
          assert.equal(
            (await request(planOwner, `${selectedPath}/archive`, {})).body
              .archivedAt,
            archived.body.archivedAt,
          );
          assert.equal(
            (await request(admin, selectedPath, { status: 'ACTIVE' }, 'PATCH'))
              .status,
            409,
          );
          assert.equal(
            (await request(admin, selectedPath, undefined, 'DELETE')).status,
            404,
          );
          const detail = (await request(admin, selectedPath)).body;
          assert.deepEqual(detail.eligibleBranches, []);
          assert.equal(detail.branches.length, 2);
          assert.deepEqual(detail.metrics, {
            activeMembers: 0,
            totalMembers: 0,
            revenueMinor: 0,
          });
          assert.equal(
            (await request(admin, `${path}?status=ARCHIVED`)).body.total,
            1,
          );
          const audits = await database.db.auditEvent.findMany({
            where: { targetId: selected.body.id },
          });
          for (const action of [
            'MEMBERSHIP_PLAN_CREATED',
            'MEMBERSHIP_PLAN_UPDATED',
            'MEMBERSHIP_PLAN_ARCHIVED',
          ])
            assert.ok(audits.some((event) => event.action === action));
          assert.equal(
            audits.filter(
              (event) => event.action === 'MEMBERSHIP_PLAN_ARCHIVED',
            ).length,
            1,
          );
          assert.ok(
            audits.every(
              (event) => Object.keys(event.metadata).join() === 'planName',
            ),
          );
          const activity = (
            await request(admin, `/businesses/${biz}/dashboard`)
          ).body.recentActivity;
          assert.ok(
            activity.some(
              (event) => event.label === 'Membership plan archived: Quarterly',
            ),
          );
        },
      );
      await t.test(
        'members: concurrent numbering, contacts, dates, CRUD, tenant isolation, counts and history',
        async () => {
          const memberOwner = await user('member-owner@example.com');
          const biz = (
            await request(memberOwner, '/onboarding', {
              ...onboarding,
              name: 'Member Gym',
            })
          ).body.id;
          await database.db.businessAccess.create({
            data: { businessId: biz, userId: admin.id, role: 'ADMIN' },
          });
          const path = `/businesses/${biz}/members`;
          const input = {
            fullName: '  Yasmanth  ',
            phone: '+91 (98765) 43210',
            joiningDate: '2026-09-08',
            email: '  YAS@example.com ',
            dateOfBirth: '1995-05-20',
            heightCm: 175,
            weightGrams: 70250,
            fitnessGoal: 'Strength',
            postalCode: '00123',
          };
          const accessBefore = await database.db.businessAccess.count();
          assert.equal((await request(null, path)).status, 401);
          assert.equal((await request(outsider, path)).status, 403);
          const created = await request(memberOwner, path, input);
          assert.equal(created.status, 201);
          const id = created.body.id;
          assert.equal(created.body.memberNumber, 'MEM000001');
          assert.equal(created.body.fullName, 'Yasmanth');
          assert.equal(created.body.phone, '+919876543210');
          assert.equal(created.body.email, 'yas@example.com');
          assert.equal(created.body.joiningDate, '2026-09-08');
          assert.equal(created.body.dateOfBirth, '1995-05-20');
          assert.equal(created.body.postalCode, '00123');
          assert.ok(
            !('currentPhone' in created.body) && created.body.branchId === null,
          );
          const simultaneous = await Promise.all(
            Array.from({ length: 5 }, (_, index) =>
              request(admin, path, {
                ...input,
                fullName: `Concurrent ${index}`,
                phone: `900000000${index}`,
              }),
            ),
          );
          assert.ok(simultaneous.every((result) => result.status === 201));
          assert.equal(
            new Set(simultaneous.map((result) => result.body.memberNumber))
              .size,
            5,
          );
          assert.deepEqual(
            simultaneous.map((result) => result.body.memberNumber).sort(),
            ['MEM000002', 'MEM000003', 'MEM000004', 'MEM000005', 'MEM000006'],
          );
          const duplicate = await request(admin, path, {
            ...input,
            phone: '+91-98765-43210',
          });
          assert.equal(duplicate.status, 409);
          assert.equal(duplicate.body.code, 'DUPLICATE_MEMBER_PHONE');
          assert.equal(
            (
              await request(
                admin,
                `${path}/${simultaneous[0].body.id}`,
                { phone: '+919876543210' },
                'PATCH',
              )
            ).status,
            409,
          );
          const racingPhone = await Promise.all([
            request(memberOwner, path, { ...input, phone: '9000099999' }),
            request(admin, path, { ...input, phone: '90000 99999' }),
          ]);
          assert.deepEqual(
            racingPhone.map((result) => result.status).sort(),
            [201, 409],
          );
          const otherBiz = (
            await database.db.business.findFirstOrThrow({
              where: { ownerId: outsider.id },
            })
          ).id;
          const otherPath = `/businesses/${otherBiz}/members`;
          assert.equal((await request(outsider, otherPath, input)).status, 201);
          for (const [method, suffix, body] of [
            ['GET', '', undefined],
            ['PATCH', '', { fullName: 'Foreign' }],
            ['POST', '/archive', {}],
          ]) {
            assert.equal(
              (await request(outsider, `${path}/${id}${suffix}`, body, method))
                .status,
              403,
            );
            assert.equal(
              (
                await request(
                  outsider,
                  `${otherPath}/${id}${suffix}`,
                  body,
                  method,
                )
              ).status,
              404,
            );
          }
          for (const search of [
            'Yasmanth',
            'MEM000001',
            '+91 (98765) 43210',
            'yas@example.com',
          ]) {
            const results = (
              await request(
                admin,
                `${path}?search=${encodeURIComponent(search)}`,
              )
            ).body.items;
            assert.ok(results.some((item) => item.id === id));
            assert.ok(results.every((item) => item.businessId === biz));
          }
          assert.equal(
            (await request(outsider, `${otherPath}?search=Concurrent`)).body
              .total,
            0,
          );
          const invalids = [
            { fullName: '' },
            { fullName: null },
            { phone: null },
            { phone: 'abc123' },
            { phone: '++++++' },
            { joiningDate: null },
            { joiningDate: '2026-02-30' },
            { dateOfBirth: '2999-01-01' },
            { dateOfBirth: '2026-02-30' },
            { email: 'broken' },
            { status: null },
            { status: 'ARCHIVED' },
            { memberNumber: 'MEM999999' },
            { businessId: otherBiz },
            { id: randomUUID() },
            { branchId: randomUUID() },
            { profilePhotoUrl: 'https://example.com/photo.png' },
            ...[0, -1, 301, 1.5, '175'].map((heightCm) => ({ heightCm })),
            ...[0, -1, 1000001, 1.5, '70000'].map((weightGrams) => ({
              weightGrams,
            })),
            { fitnessGoal: 'Medical history' },
            { notes: 'x'.repeat(2001) },
          ];
          for (const invalid of invalids) {
            assert.equal(
              (
                await request(admin, path, {
                  ...input,
                  phone: '9000088888',
                  ...invalid,
                })
              ).status,
              400,
              JSON.stringify(invalid),
            );
            assert.equal(
              (await request(admin, `${path}/${id}`, invalid, 'PATCH')).status,
              400,
              JSON.stringify(invalid),
            );
          }
          const update = await request(
            admin,
            `${path}/${id}`,
            {
              fullName: 'Yasmanth Updated',
              status: 'INACTIVE',
              alternatePhone: '0091 90000 00000',
              emergencyContactName: 'Contact',
              emergencyContactRelationship: 'Sibling',
              emergencyContactPhone: '+91-90000-00000',
              notes: 'Updated profile',
              addressLine1: '1 Street',
              weightGrams: 71001,
            },
            'PATCH',
          );
          assert.equal(update.status, 200);
          assert.equal(update.body.memberNumber, 'MEM000001');
          assert.equal(update.body.alternatePhone, '00919000000000');
          assert.equal(update.body.joiningDate, '2026-09-08');
          assert.equal(
            (await request(admin, `${path}?status=INACTIVE`)).body.total,
            1,
          );
          assert.equal((await request(admin, path)).body.total, 6);
          const branch = await database.db.branch.findFirstOrThrow({
            where: { businessId: biz },
          });
          for (const suffix of ['', `?branchId=${branch.id}`]) {
            const metrics = (
              await request(admin, `/businesses/${biz}/dashboard${suffix}`)
            ).body.metrics;
            assert.equal(metrics.totalMembers, suffix ? 0 : 7);
            assert.equal(metrics.activeMembers, suffix ? 0 : 6);
          }
          assert.equal(
            (await request(admin, `${path}?pageSize=2&page=2`)).body.items
              .length,
            2,
          );
          assert.equal(
            (await request(admin, `${path}?branchId=${branch.id}`)).status,
            200,
            'member endpoints support branch filtering',
          );
          assert.equal(
            (
              await request(
                admin,
                `${path}/${id}`,
                {
                  status: 'ACTIVE',
                  dateOfBirth: null,
                  heightCm: null,
                  weightGrams: null,
                },
                'PATCH',
              )
            ).status,
            200,
          );
          const detail = (await request(admin, `${path}/${id}`)).body;
          assert.equal(detail.dateOfBirth, null);
          assert.ok(
            detail.activity.some((event) => event.action === 'MEMBER_CREATED'),
          );
          assert.ok(
            detail.activity.every(
              (event) =>
                Object.keys(event).sort().join() === 'action,id,occurredAt',
            ),
          );
          const archived = await request(admin, `${path}/${id}/archive`, {});
          assert.equal(archived.status, 201);
          assert.equal(archived.body.status, 'ARCHIVED');
          assert.ok(archived.body.archivedAt);
          assert.equal(
            (await request(memberOwner, `${path}/${id}/archive`, {})).body
              .archivedAt,
            archived.body.archivedAt,
          );
          assert.equal(
            (
              await request(
                admin,
                `${path}/${id}`,
                { status: 'ACTIVE' },
                'PATCH',
              )
            ).status,
            409,
          );
          assert.equal(
            (await request(admin, `${path}/${id}`, undefined, 'DELETE')).status,
            404,
          );
          assert.equal(
            (await request(admin, `${path}?status=ARCHIVED`)).body.items[0].id,
            id,
          );
          assert.ok(
            (await request(admin, path)).body.items.every(
              (item) => item.id !== id,
            ),
          );
          const history = await database.db.member.findUniqueOrThrow({
            where: { id },
          });
          assert.equal(history.phone, '+919876543210');
          assert.equal(history.currentPhone, null);
          const reused = await request(admin, path, input);
          assert.equal(reused.status, 201);
          assert.notEqual(reused.body.id, id);
          assert.equal(reused.body.memberNumber, 'MEM000008');
          assert.equal(await database.db.businessAccess.count(), accessBefore);
          const audits = await database.db.auditEvent.findMany({
            where: { targetId: id },
          });
          assert.equal(
            audits.filter((event) => event.action === 'MEMBER_ARCHIVED').length,
            1,
          );
          assert.ok(
            audits.every(
              (event) =>
                Object.keys(event.metadata).sort().join() ===
                'memberName,memberNumber',
            ),
          );
          assert.ok(
            (
              await request(admin, `/businesses/${biz}/dashboard`)
            ).body.recentActivity.some(
              (event) => event.label === 'Member archived: Yasmanth Updated',
            ),
          );
        },
      );
      await require('./product-workflows.cjs')({
        t,
        request,
        user,
        database,
        onboarding,
      });
      await require('./admin-regressions.cjs')({
        t,
        request,
        user,
        database,
        onboarding,
      });
    } finally {
      await app.close();
      await sql.end();
      await new Promise((resolve) => provider.close(resolve));
    }
  },
);
