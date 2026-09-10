import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
test('membership assignment, partial payment, promise date, void and dashboard balances', async ({
  page,
  request,
}) => {
  const email = `product-${randomUUID()}@example.com`;
  const fixture = await (
    await request.post('http://127.0.0.1:3102/fixtures/dashboard', {
      data: { email },
    })
  ).json();
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await page.goto(`/admin/members/new?businessId=${fixture.first.id}`);
  await page.getByLabel('Full Name', { exact: true }).fill('Workflow Member');
  await page.getByLabel('Mobile Number', { exact: true }).fill('9876543210');
  await page.getByLabel('Joining Date', { exact: true }).fill('2026-09-01');
  await page.getByRole('button', { name: 'Create Member' }).click();
  await expect(
    page.getByRole('heading', { name: 'Workflow Member', exact: true }),
  ).toBeVisible();
  await page.goto(`/admin/membership-plans/new?businessId=${fixture.first.id}`);
  await page.getByLabel('Plan Name', { exact: true }).fill('Workflow Monthly');
  await page.getByLabel('Price', { exact: true }).fill('1200.50');
  await page.getByLabel('Duration in Days', { exact: true }).fill('30');
  await page.getByRole('button', { name: 'Create Plan' }).click();
  await expect(
    page.getByRole('heading', { name: 'Workflow Monthly', exact: true }),
  ).toBeVisible();
  await page.goto(`/admin/memberships/new?businessId=${fixture.first.id}`);
  await page
    .getByLabel('Member', { exact: true })
    .selectOption({ label: 'Workflow Member · MEM000001' });
  await page
    .getByLabel('Membership branch', { exact: true })
    .selectOption({ index: 1 });
  await page
    .getByLabel('Plan', { exact: true })
    .selectOption({ label: 'Workflow Monthly' });
  await page.getByLabel('Start Date', { exact: true }).fill('2026-09-01');
  await page.getByRole('button', { name: 'Confirm Membership' }).click();
  await expect(
    page.getByRole('heading', { name: 'Membership details' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Record payment', exact: true })
    .click();
  await page.getByLabel('Amount', { exact: true }).fill('500.25');
  await page.getByRole('button', { name: 'Review payment' }).click();
  await expect(page.getByText(/Remaining balance:.*700.25/)).toBeVisible();
  await page
    .getByRole('button', { name: 'Confirm payment', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Record payment', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/^Workflow Member ·.*500\.25$/)).toBeVisible();
  await page.getByLabel('Promise-to-pay date').fill('2099-12-31');
  await page.getByRole('button', { name: 'Save promise' }).click();
  await expect(page.getByText('PARTIALLY PAID', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Void payment', exact: true }).click();
  await page.getByLabel('Void reason').fill('Correcting receipt');
  await page.getByRole('button', { name: 'Confirm void' }).click();
  await expect(
    page.locator('span').filter({ hasText: /^VOID$/ }),
  ).toBeVisible();
  await page.goto(`/admin/dashboard?businessId=${fixture.first.id}`);
  await expect(page.getByRole('main')).toContainText('Workflow Member');
  await expect(page.getByRole('main')).toContainText('1,200.50');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/admin/dues?businessId=${fixture.first.id}`);
  await expect(
    page.getByRole('heading', { name: 'Payments & dues' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto(`/admin/reports?businessId=${fixture.first.id}`);
  await page.getByLabel('Report type', { exact: true }).selectOption('dues');
  await page.getByLabel('Report from', { exact: true }).fill('2026-09-01');
  await page.getByLabel('Report to', { exact: true }).fill('2026-09-30');
  await expect(page.getByRole('table')).toContainText('Workflow Member');
  await expect(page.getByRole('table')).toContainText('1,200.50');
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect((await exported).suggestedFilename()).toBe(
    'gym-dues-2026-09-01-2026-09-30.csv',
  );
  for (const report of ['memberships', 'members', 'branches', 'staff']) {
    await page.getByLabel('Report type', { exact: true }).selectOption(report);
    await expect(
      page.getByRole('heading', {
        name: `${{ memberships: 'Memberships', members: 'Members', branches: 'Branches', staff: 'Staff' }[report]} report`,
        exact: true,
      }),
    ).toBeVisible();
  }
  await page
    .getByLabel('Report type', { exact: true })
    .selectOption('attendance');
  await expect(
    page.getByRole('heading', { name: 'Attendance report', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
