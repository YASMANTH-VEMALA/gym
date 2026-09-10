const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
module.exports = async ({ t, request, user, database, onboarding }) => {
  const owner = await user('product-owner@example.com'),
    admin = await user('product-admin@example.com'),
    stranger = await user('product-stranger@example.com');
  const biz = (
    await request(owner, '/onboarding', { ...onboarding, name: 'Product Gym' })
  ).body.id;
  const otherBiz = (
    await request(stranger, '/onboarding', {
      ...onboarding,
      name: 'Foreign Gym',
    })
  ).body.id;
  await database.db.businessAccess.create({
    data: { businessId: biz, userId: admin.id, role: 'ADMIN' },
  });
  const branch = await database.db.branch.findFirstOrThrow({
    where: { businessId: biz },
  });
  const foreignBranch = await database.db.branch.findFirstOrThrow({
    where: { businessId: otherBiz },
  });
  const member = (
    await request(owner, `/businesses/${biz}/members`, {
      branchId: branch.id,
      fullName: 'Product Member',
      phone: '9000012345',
      email: 'product-member@example.com',
      joiningDate: '2026-09-01',
    })
  ).body;
  const plan = (
    await request(owner, `/businesses/${biz}/membership-plans`, {
      name: 'Monthly',
      priceMinor: 120050,
      durationDays: 30,
      appliesToAllBranches: true,
    })
  ).body;
  const base = `/businesses/${biz}`;
  let membership;
  await t.test(
    'membership snapshots, dates, eligibility, overlaps, cancellation and idempotency',
    async () => {
      const input = {
        memberId: member.id,
        branchId: branch.id,
        planId: plan.id,
        startDate: '2026-09-01',
        idempotencyKey: randomUUID(),
      };
      const created = await request(owner, `${base}/memberships`, input);
      assert.equal(created.status, 201);
      membership = created.body;
      assert.equal(membership.endDate.slice(0, 10), '2026-09-30');
      assert.equal(membership.priceMinorSnapshot, 120050);
      assert.equal(
        (await request(admin, `${base}/memberships`, input)).body.id,
        membership.id,
      );
      assert.equal(
        (
          await request(admin, `${base}/memberships`, {
            ...input,
            startDate: '2026-10-01',
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request(admin, `${base}/memberships`, {
            ...input,
            idempotencyKey: randomUUID(),
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request(admin, `${base}/memberships`, {
            ...input,
            branchId: foreignBranch.id,
            idempotencyKey: randomUUID(),
          })
        ).status,
        400,
      );
      assert.equal(
        (await request(stranger, `${base}/memberships/${membership.id}`))
          .status,
        403,
      );
      assert.equal(
        (
          await request(
            stranger,
            `/businesses/${otherBiz}/memberships/${membership.id}`,
          )
        ).status,
        404,
      );
      await request(
        owner,
        `${base}/membership-plans/${plan.id}`,
        { priceMinor: 99999, name: 'Changed' },
        'PATCH',
      );
      assert.equal(
        (await request(admin, `${base}/memberships/${membership.id}`)).body
          .priceMinorSnapshot,
        120050,
      );
      const renewal = await request(admin, `${base}/memberships`, {
        ...input,
        startDate: '2026-10-01',
        idempotencyKey: randomUUID(),
      });
      assert.equal(renewal.status, 201);
      assert.equal(
        (
          await request(
            admin,
            `${base}/memberships/${renewal.body.id}/cancel`,
            { reason: 'Member requested cancellation' },
          )
        ).status,
        201,
      );
      assert.equal(
        (await request(admin, `${base}/memberships?status=CANCELLED`)).body
          .total,
        1,
      );
    },
  );
  await t.test(
    'receivables, promise dates, exact payments, concurrent overpayment, voids and tenant isolation',
    async () => {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const load = async () =>
        (
          await request(
            admin,
            `${base}/dues?status=ALL&membershipId=${membership.id}`,
          )
        ).body.items[0];
      const due = await load();
      assert.equal(due.originalAmountMinor, 120050);
      assert.equal(due.outstandingMinor, 120050);
      assert.equal(due.dueDate.slice(0, 10), '2026-09-01');
      assert.equal(
        await database.db.receivable.count({
          where: { membershipId: membership.id },
        }),
        1,
      );
      assert.equal((await request(stranger, `${base}/dues`)).status, 403);
      assert.equal(
        (await request(admin, `${base}/dues?branchId=${foreignBranch.id}`))
          .status,
        403,
      );
      assert.equal(
        (
          await request(
            stranger,
            `/businesses/${otherBiz}/dues?memberId=${member.id}`,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await request(
            admin,
            `${base}/dues/${due.id}/promise`,
            { promiseToPayDate: '2099-12-31' },
            'PATCH',
          )
        ).status,
        200,
      );
      assert.equal((await load()).status, 'OPEN');
      assert.equal((await load()).dueDate.slice(0, 10), '2026-09-01');
      const input = {
        receivableId: due.id,
        idempotencyKey: randomUUID(),
        amountMinor: 50000,
        method: 'UPI',
        paidAt: today,
        reference: 'Transfer 001',
      };
      const partial = await request(admin, `${base}/payments`, input);
      assert.equal(partial.status, 201);
      assert.equal((await load()).paidMinor, 50000);
      assert.equal((await load()).outstandingMinor, 70050);
      assert.equal((await load()).status, 'PARTIALLY_PAID');
      assert.equal(
        (await request(admin, `${base}/payments`, input)).body.id,
        partial.body.id,
      );
      assert.equal(
        (
          await request(admin, `${base}/payments`, {
            ...input,
            amountMinor: 50001,
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request(admin, `${base}/payments`, {
            ...input,
            idempotencyKey: randomUUID(),
            amountMinor: 0,
          })
        ).status,
        400,
      );
      const race = await Promise.all(
        [1, 2].map(() =>
          request(admin, `${base}/payments`, {
            ...input,
            idempotencyKey: randomUUID(),
            amountMinor: 70050,
          }),
        ),
      );
      assert.deepEqual(race.map((x) => x.status).sort(), [201, 409]);
      assert.equal((await load()).outstandingMinor, 0);
      assert.equal((await load()).status, 'PAID');
      assert.equal(
        (
          await request(
            admin,
            `${base}/dues/${due.id}/promise`,
            { promiseToPayDate: today },
            'PATCH',
          )
        ).status,
        409,
      );
      const final = race.find((x) => x.status === 201).body;
      assert.equal(
        (
          await request(
            stranger,
            `/businesses/${otherBiz}/payments/${final.id}/void`,
            { reason: 'Forged' },
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await request(admin, `${base}/payments/${final.id}/void`, {
            reason: '   ',
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(admin, `${base}/payments/${final.id}/void`, {
            reason: 'Recorded against incorrect receipt',
          })
        ).status,
        201,
      );
      assert.equal(
        (
          await request(admin, `${base}/payments/${final.id}/void`, {
            reason: 'Retry',
          })
        ).status,
        201,
      );
      assert.equal((await load()).outstandingMinor, 70050);
      assert.equal(
        (
          await request(
            admin,
            `${base}/dues/${due.id}/promise`,
            { promiseToPayDate: null },
            'PATCH',
          )
        ).status,
        200,
      );
      assert.equal(
        (await load()).status,
        today > '2026-09-01' ? 'OVERDUE' : 'PARTIALLY_PAID',
      );
      const history = (
        await request(admin, `${base}/payments?membershipId=${membership.id}`)
      ).body;
      assert.equal(history.total, 2);
      assert.equal(history.items.filter((x) => x.status === 'VOID').length, 1);
      const cashMonth = (
        await request(
          admin,
          `${base}/payments?paidFrom=${today.slice(0, 7)}-01&paidTo=${today}&paymentMethod=CASH`,
        )
      ).body;
      assert.equal(cashMonth.metrics.paymentCount, 0);
      assert.equal(cashMonth.metrics.collectedMinor, 0);
      assert.equal(cashMonth.branches[0].branchId, branch.id);
      const dashboard = (await request(admin, `${base}/dashboard`)).body;
      assert.equal(dashboard.metrics.collections, 50000);
      assert.equal(dashboard.metrics.outstandingDues, 170049);
      const audit = await database.db.auditEvent.findMany({
        where: {
          businessId: biz,
          action: {
            in: [
              'PAYMENT_RECORDED',
              'PAYMENT_VOIDED',
              'PROMISE_TO_PAY_SET',
              'PROMISE_TO_PAY_UPDATED',
            ],
          },
        },
      });
      assert.equal(audit.length, 5);
    },
  );
  await t.test(
    'QR credentials: opaque encryption, authorized resolution, rotation, revocation and inactive targets',
    async () => {
      const created = await request(admin, `${base}/qr`, {
        kind: 'MEMBER',
        targetId: member.id,
      });
      assert.equal(created.status, 201);
      assert.equal(created.body.tokenHash, undefined);
      assert.equal(created.body.encryptedToken, undefined);
      const viewed = await request(admin, `${base}/qr/${created.body.id}`);
      assert.equal(viewed.status, 200);
      assert.match(viewed.body.dataUrl, /^data:image\/png;base64,/);
      const token = new URLSearchParams(
        new URL(viewed.body.url).hash.slice(1),
      ).get('token');
      assert.match(token, /^[A-Za-z0-9_-]{43}$/);
      assert.ok(!viewed.body.url.includes(member.id));
      assert.ok(!viewed.body.url.includes(member.phone));
      const saved = await database.db.qrCredential.findUniqueOrThrow({
        where: { id: created.body.id },
      });
      assert.equal(
        saved.tokenHash,
        require('node:crypto').createHash('sha256').update(token).digest('hex'),
      );
      assert.ok(!JSON.stringify(saved).includes(token));
      assert.equal(
        (
          await request(admin, `${base}/qr`, {
            kind: 'MEMBER',
            targetId: member.id,
          })
        ).body.id,
        saved.id,
      );
      assert.equal(
        (await request(stranger, `${base}/qr/${saved.id}`)).status,
        403,
      );
      assert.equal(
        (await request(stranger, `/businesses/${otherBiz}/qr/${saved.id}`))
          .status,
        404,
      );
      assert.equal(
        (
          await request(stranger, `/businesses/${otherBiz}/qr`, {
            kind: 'MEMBER',
            targetId: member.id,
          })
        ).status,
        404,
      );
      assert.equal(
        (await request(admin, `${base}/qr/resolve/member`, { token })).body
          .member.id,
        member.id,
      );
      const scanned = await request(admin, `${base}/qr/check-in/member`, {
        token,
        branchId: branch.id,
      });
      assert.equal(scanned.status, 201);
      assert.equal(scanned.body.member.id, member.id);
      assert.equal(scanned.body.attendance.memberId, member.id);
      assert.equal(
        (
          await request(admin, `${base}/qr/check-in/member`, {
            token,
            branchId: branch.id,
          })
        ).body.attendance.id,
        scanned.body.attendance.id,
      );
      assert.equal(
        (
          await request(stranger, `/businesses/${otherBiz}/qr/resolve/member`, {
            token,
          })
        ).status,
        404,
      );
      await request(admin, `${base}/qr`, {
        kind: 'MEMBER',
        targetId: member.id,
        rotate: true,
      });
      assert.equal(
        (await request(admin, `${base}/qr/resolve/member`, { token })).status,
        404,
      );
      const rotated = (await request(admin, `${base}/qr/${saved.id}`)).body;
      const rotatedToken = new URLSearchParams(
        new URL(rotated.url).hash.slice(1),
      ).get('token');
      assert.notEqual(rotatedToken, token);
      await request(admin, `${base}/qr/${saved.id}/revoke`, {});
      assert.equal(
        (
          await request(admin, `${base}/qr/resolve/member`, {
            token: rotatedToken,
          })
        ).status,
        404,
      );
      assert.equal(
        (await request(admin, `${base}/qr/${saved.id}`)).status,
        409,
      );
      assert.equal(
        (
          await database.db.qrCredential.findUniqueOrThrow({
            where: { id: saved.id },
          })
        ).encryptedToken,
        null,
      );
      const ensured = await request(admin, `${base}/qr/branches/ensure`, {});
      assert.equal(ensured.body.created, 1);
      assert.equal(
        (await request(admin, `${base}/qr/branches/ensure`, {})).body.created,
        0,
      );
      const branchQr = await database.db.qrCredential.findFirstOrThrow({
        where: { branchId: branch.id },
      });
      const branchView = (await request(admin, `${base}/qr/${branchQr.id}`))
        .body;
      const branchToken = new URLSearchParams(
        new URL(branchView.url).hash.slice(1),
      ).get('token');
      assert.deepEqual(
        (await request(null, '/public/qr/branch', { token: branchToken })).body,
        {
          businessName: 'Product Gym',
          branchName: branch.name,
          joiningDate: new Date().toLocaleDateString('en-CA', {
            timeZone: 'Asia/Kolkata',
          }),
        },
      );
      assert.equal(
        (await request(null, '/public/qr/branch', { token })).status,
        404,
      );
      await request(admin, `${base}/qr/${branchQr.id}/revoke`, {});
      assert.equal(
        (await request(null, '/public/qr/branch', { token: branchToken }))
          .status,
        404,
      );
      assert.equal(
        (await request(admin, `${base}/qr/branches/ensure`, {})).body.created,
        0,
      );
      await request(admin, `${base}/qr`, {
        kind: 'MEMBER',
        targetId: member.id,
      });
      const latest = (await request(admin, `${base}/qr/${saved.id}`)).body;
      const latestToken = new URLSearchParams(
        new URL(latest.url).hash.slice(1),
      ).get('token');
      await database.db.member.update({
        where: { id: member.id },
        data: { status: 'INACTIVE' },
      });
      assert.equal(
        (
          await request(admin, `${base}/qr/resolve/member`, {
            token: latestToken,
          })
        ).status,
        404,
      );
      await database.db.member.update({
        where: { id: member.id },
        data: { status: 'ACTIVE' },
      });
      const audits = await database.db.auditEvent.findMany({
        where: { businessId: biz },
      });
      for (const secret of [token, rotatedToken, branchToken, latestToken])
        assert.ok(!JSON.stringify(audits).includes(secret));
    },
  );
  await t.test(
    'reports aggregate real records, preserve filters and date boundaries, and export safe CSV',
    async () => {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const collection = await request(
        admin,
        `${base}/reports/collections?from=${today}&to=${today}`,
      );
      assert.equal(collection.status, 200);
      assert.equal(collection.body.metrics['Total collected'], 50000);
      assert.equal(collection.body.metrics.UPI, 50000);
      assert.equal(collection.body.metrics['Payment count'], 1);
      const people = await request(
        admin,
        `${base}/reports/people-status?from=${today.slice(0, 7)}-01&to=${today}&branchId=${branch.id}`,
      );
      assert.equal(people.status, 200);
      assert.equal(people.body.total, 1);
      assert.equal(people.body.rows[0].memberNumber, member.memberNumber);
      assert.equal(people.body.rows[0].profileStatus, 'ACTIVE');
      assert.equal(people.body.rows[0].membershipStatus, 'ACTIVE');
      assert.equal(people.body.rows[0].paymentStatus, 'PARTIALLY PAID');
      assert.equal(people.body.rows[0].attendanceCount, 1);
      assert.equal(people.body.metrics['People with dues'], 1);
      assert.equal(
        (await request(admin, `${base}/reports/collections?method=CASH`)).body
          .metrics['Total collected'],
        0,
      );
      assert.equal(
        (
          await request(
            admin,
            `${base}/reports/collections?from=2026-01-01&to=2026-01-01`,
          )
        ).body.total,
        0,
      );
      assert.equal(
        (
          await request(
            admin,
            `${base}/reports/collections?branchId=${foreignBranch.id}`,
          )
        ).status,
        403,
      );
      assert.equal(
        (await request(stranger, `${base}/reports/dues`)).status,
        403,
      );
      assert.equal(
        (await request(admin, `${base}/reports/dues?planId=${randomUUID()}`))
          .status,
        404,
      );
      assert.equal(
        (
          await request(
            admin,
            `${base}/reports/members?from=2020-01-01&to=2026-09-01`,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            admin,
            `${base}/reports/members?from=2026-09-02&to=2026-09-01`,
          )
        ).status,
        400,
      );
      assert.equal(
        (await request(admin, `${base}/reports/members?status=PAID`)).status,
        400,
      );
      const dues = (
        await request(
          admin,
          `${base}/reports/dues?from=2026-09-01&to=2026-10-31`,
        )
      ).body;
      assert.equal(dues.metrics.Outstanding, 170049);
      assert.equal(dues.total, 1);
      assert.equal(dues.rows[0].paidMinor, 50000);
      const memberships = (
        await request(
          admin,
          `${base}/reports/memberships?from=2026-09-01&to=2026-10-31`,
        )
      ).body;
      assert.equal(memberships.metrics['Total memberships'], 2);
      assert.equal(memberships.metrics.Cancelled, 1);
      assert.equal(memberships.distributions['Plan distribution'].length, 2);
      const branchReport = (
        await request(
          admin,
          `${base}/reports/branches?from=${today}&to=${today}`,
        )
      ).body;
      assert.equal(branchReport.rows[0].collectionsMinor, 50000);
      assert.equal(branchReport.rows[0].outstandingMinor, 170049);
      const memberReport = (
        await request(
          admin,
          `${base}/reports/members?from=2026-09-01&to=2026-09-01&branchId=${branch.id}`,
        )
      ).body;
      assert.equal(memberReport.total, 1);
      assert.equal(memberReport.distributions['Joining trends'][0].count, 1);
      const staff = (
        await request(admin, `${base}/staff`, {
          fullName: 'Report Staff',
          phone: '9012345678',
          jobTitle: 'Trainer',
          joiningDate: '2026-09-01',
          branchIds: [branch.id],
        })
      ).body;
      const staffReport = (
        await request(
          admin,
          `${base}/reports/staff?from=2026-09-01&to=2026-09-30`,
        )
      ).body;
      assert.equal(staffReport.metrics.Active, 1);
      assert.equal(staffReport.metrics['Branch assignments'], 1);
      assert.equal(
        staffReport.distributions['Job-title distribution'][0].label,
        'Trainer',
      );
      assert.ok(staff.id);
      const before = member.fullName;
      await database.db.member.update({
        where: { id: member.id },
        data: { fullName: '=HYPERLINK("bad")' },
      });
      const csv = (
        await request(
          admin,
          `${base}/reports/members/export?from=2026-09-01&to=2026-09-30`,
        )
      ).body.csv;
      assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
      assert.ok(csv.startsWith('\uFEFF'));
      await database.db.member.update({
        where: { id: member.id },
        data: { fullName: before },
      });
      const { csvCell } = require('../dist/modules/reports/csv');
      for (const value of [
        '=1+1',
        '+cmd',
        '-cmd',
        '@SUM(A1)',
        ' \t=cmd',
        '\r\n+cmd',
      ])
        assert.ok(csvCell(value).startsWith('"\''));
      assert.equal(csvCell('a,"b"\nline'), '"a,""b""\nline"');
      assert.equal(
        (await request(admin, `${base}/reports/attendance`)).status,
        200,
      );
    },
  );
};
