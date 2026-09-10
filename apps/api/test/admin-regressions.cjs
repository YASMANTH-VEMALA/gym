const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
module.exports = async ({ t, request, user, database, onboarding }) => {
  const owner = await user('branch-regression-owner@example.com'),
    admin = await user('branch-regression-admin@example.com'),
    outsider = await user('branch-regression-outsider@example.com');
  const business = (
    await request(owner, '/onboarding', {
      ...onboarding,
      name: 'Branch regression',
    })
  ).body;
  const foreign = (
    await request(outsider, '/onboarding', {
      ...onboarding,
      name: 'Foreign regression',
    })
  ).body;
  const b = business.id,
    base = `/businesses/${b}`;
  await database.db.businessAccess.create({
    data: { businessId: b, userId: admin.id, role: 'ADMIN' },
  });
  const first = await database.db.branch.findFirstOrThrow({
    where: { businessId: b },
  });
  const second = (
    await request(owner, `${base}/branches`, {
      name: 'K5',
      addressLine1: '1 Test Road',
      city: 'Hyderabad',
      state: 'Telangana',
      postalCode: '500001',
      country: 'India',
    })
  ).body;
  const foreignBranch = await database.db.branch.findFirstOrThrow({
    where: { businessId: foreign.id },
  });
  const member = (
    await request(owner, `${base}/members`, {
      fullName: 'Branch member',
      phone: '9000111222',
      joiningDate: '2026-09-01',
      branchId: first.id,
    })
  ).body;
  await t.test(
    'branch registrations filter, transfer and reject foreign or archived assignments',
    async () => {
      assert.equal(
        (await request(admin, `${base}/members?branchId=${first.id}`)).body
          .total,
        1,
      );
      assert.equal(
        (await request(admin, `${base}/members?branchId=${second.id}`)).body
          .total,
        0,
      );
      assert.equal(
        (await request(admin, `${base}/members?branchId=${foreignBranch.id}`))
          .status,
        403,
      );
      assert.equal(
        (
          await request(
            admin,
            `${base}/members/${member.id}`,
            { branchId: foreignBranch.id },
            'PATCH',
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            admin,
            `${base}/members/${member.id}`,
            { branchId: second.id },
            'PATCH',
          )
        ).status,
        200,
      );
      assert.equal(
        (await request(admin, `${base}/members?branchId=${first.id}`)).body
          .total,
        0,
      );
      assert.equal(
        (await request(admin, `${base}/dashboard?branchId=${second.id}`)).body
          .metrics.totalMembers,
        1,
      );
      assert.equal(
        (await request(admin, `${base}/branches/${second.id}`)).body.metrics
          .members,
        1,
      );
      assert.equal(
        (
          await request(
            admin,
            `${base}/reports/members?branchId=${second.id}&from=2026-09-01&to=2026-09-01`,
          )
        ).body.total,
        1,
      );
    },
  );
  await t.test(
    'attendance rejects ineligible members, deduplicates concurrent check-ins, scopes history and checks out',
    async () => {
      const input = { memberId: member.id, branchId: second.id };
      assert.equal(
        (await request(admin, `${base}/attendance`, input)).status,
        409,
      );
      const plan = (
        await request(owner, `${base}/membership-plans`, {
          name: 'Daily',
          priceMinor: 10000,
          durationDays: 30,
          appliesToAllBranches: true,
        })
      ).body;
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: business.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      assert.equal(
        (
          await request(admin, `${base}/memberships`, {
            ...input,
            planId: plan.id,
            startDate: today,
            idempotencyKey: randomUUID(),
          })
        ).status,
        201,
      );
      const results = await Promise.all([
        request(admin, `${base}/attendance`, input),
        request(admin, `${base}/attendance`, input),
      ]);
      assert.equal(results[0].status, 201);
      assert.equal(results[0].body.id, results[1].body.id);
      const id = results[0].body.id;
      assert.equal(
        (await request(admin, `${base}/attendance?branchId=${second.id}`)).body
          .total,
        1,
      );
      assert.equal(
        (await request(admin, `${base}/attendance?branchId=${first.id}`)).body
          .total,
        0,
      );
      assert.equal(
        (
          await request(admin, `${base}/attendance`, {
            ...input,
            branchId: foreignBranch.id,
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await request(
            outsider,
            `/businesses/${foreign.id}/attendance/${id}/check-out`,
            {},
          )
        ).status,
        404,
      );
      const out = await request(
        admin,
        `${base}/attendance/${id}/check-out`,
        {},
      );
      assert.ok(out.body.checkedOutAt);
      assert.equal(
        (await request(admin, `${base}/attendance/${id}/check-out`, {})).body
          .checkedOutAt,
        out.body.checkedOutAt,
      );
      assert.equal(
        (await request(admin, `${base}/dashboard?branchId=${second.id}`)).body
          .metrics.todayCheckIns,
        1,
      );
      const report = (
        await request(
          admin,
          `${base}/reports/attendance?from=${today}&to=${today}&branchId=${second.id}`,
        )
      ).body;
      assert.equal(report.total, 1);
      assert.equal(report.metrics['Check-outs'], 1);
      const linked = await user('attendance-member@example.com');
      await database.db.memberAccountLink.create({
        data: { businessId: b, memberId: member.id, userId: linked.id },
      });
      const history = await request(
        linked,
        `/member/profiles/${member.id}/attendance`,
      );
      assert.equal(history.status, 200);
      assert.equal(history.body.total, 1);
      assert.ok(!('recordedByUserId' in history.body.items[0]));
      assert.equal(
        (await request(outsider, `/member/profiles/${member.id}/attendance`))
          .status,
        404,
      );
    },
  );
  await t.test(
    'branch QR registration persists branch and confines the member portal to the linked profile',
    async () => {
      const qr = (
        await request(owner, `${base}/qr`, {
          kind: 'BRANCH',
          targetId: first.id,
        })
      ).body;
      const image = await request(owner, `${base}/qr/${qr.id}`);
      const token = new URLSearchParams(
        new URL(image.body.url).hash.slice(1),
      ).get('token');
      const newcomer = await user('registered-branch-member@example.com');
      const input = {
        token,
        fullName: 'QR new member',
        phone: '9222333444',
        gender: 'Female',
        dateOfBirth: '1998-04-12',
        addressLine1: '12 Test Street, Bengaluru',
        emergencyContacts: [
          {
            name: 'First contact',
            phone: '9333444555',
            relationship: 'Parent',
          },
          {
            name: 'Second contact',
            phone: '9444555666',
            relationship: 'Friend',
          },
        ],
        profilePhotoDataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      };
      const registration = await request(newcomer, '/member/register', input);
      assert.equal(registration.status, 201);
      const id = registration.body.memberId;
      assert.equal(
        (await request(newcomer, '/member/register', input)).body.memberId,
        id,
      );
      const registered = await database.db.member.findUniqueOrThrow({
        where: { id },
      });
      assert.equal(registered.branchId, first.id);
      assert.deepEqual(registered.emergencyContacts, input.emergencyContacts);
      assert.ok(
        await database.db.memberProfilePhoto.findUnique({
          where: { memberId: id },
        }),
      );
      assert.equal(
        (await request(newcomer, `/member/profiles/${id}`)).status,
        200,
      );
      const profile = await request(newcomer, `/member/profiles/${id}`);
      assert.deepEqual(
        profile.body.member.emergencyContacts,
        input.emergencyContacts,
      );
      assert.match(profile.body.member.profilePhotoDataUrl, /^data:image\/png/);
      assert.equal(
        (await request(newcomer, `/member/profiles/${member.id}`)).status,
        403,
      );
      assert.equal((await request(newcomer, `${base}/members`)).status, 403);
      assert.equal(
        (await request(admin, `${base}/members?branchId=${first.id}`)).body
          .total,
        1,
      );
    },
  );
  await t.test(
    'only the owner can revoke admin access; revocation takes effect immediately and preserves owner',
    async () => {
      assert.equal((await request(admin, `${base}/access`)).status, 403);
      assert.equal((await request(owner, `${base}/access`)).body.length, 2);
      assert.equal(
        (await request(admin, `${base}/access/${owner.id}/revoke`, {})).status,
        403,
      );
      assert.equal(
        (await request(owner, `${base}/access/${owner.id}/revoke`, {})).status,
        403,
      );
      assert.equal(
        (await request(owner, `${base}/access/${admin.id}/revoke`, {})).status,
        201,
      );
      assert.equal((await request(admin, `${base}/members`)).status, 403);
      assert.equal(
        (await request(owner, `${base}/access/${admin.id}/revoke`, {})).status,
        201,
      );
      assert.equal(
        await database.db.auditEvent.count({
          where: {
            businessId: b,
            action: 'ADMIN_ACCESS_REVOKED',
            targetId: admin.id,
          },
        }),
        1,
      );
      assert.equal(
        (await request(owner, `${base}/branches/${second.id}/archive`, {}))
          .status,
        201,
      );
      assert.equal(
        (
          await request(
            owner,
            `${base}/members/${member.id}`,
            { branchId: first.id },
            'PATCH',
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            owner,
            `${base}/members/${member.id}`,
            { branchId: second.id },
            'PATCH',
          )
        ).status,
        400,
      );
    },
  );
};
