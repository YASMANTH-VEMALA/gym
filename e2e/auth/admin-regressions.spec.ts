import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
test('branch registration, switching, transfer, attendance and settings work end to end', async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const email = `admin-regression-${randomUUID()}@example.com`;
  const fixture = await (
    await request.post('http://127.0.0.1:3102/fixtures/dashboard', {
      data: { email },
    })
  ).json();
  const businessId = fixture.first.id,
    first = fixture.first.branches[0],
    second = fixture.first.branches[1];
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await page.goto(
    `/admin/members/new?businessId=${businessId}&branchId=${first.id}`,
  );
  await expect(
    page.getByLabel('Registration branch', { exact: true }),
  ).toHaveValue(first.id);
  await page.getByLabel('Full Name', { exact: true }).fill('K5 Only Member');
  await page.getByLabel('Mobile Number', { exact: true }).fill('9090909090');
  await page.getByRole('button', { name: 'Create Member' }).click();
  await expect(
    page.getByRole('heading', { name: 'K5 Only Member', exact: true }),
  ).toBeVisible();
  const memberId = new URL(page.url()).pathname.split('/').at(-1)!;
  await page.goto(
    `/admin/members?businessId=${businessId}&branchId=${first.id}`,
  );
  await expect(page.getByRole('table')).toContainText('K5 Only Member');
  await page.getByLabel('Branch', { exact: true }).selectOption(second.id);
  await expect(
    page.getByRole('heading', { name: 'No members found' }),
  ).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText('K5 Only Member');
  await page.getByLabel('Branch', { exact: true }).selectOption(first.id);
  await expect(page.getByRole('table')).toContainText('K5 Only Member');
  await page.goto(
    `/admin/members/${memberId}/edit?businessId=${businessId}&branchId=${first.id}`,
  );
  await page
    .getByLabel('Registration branch', { exact: true })
    .selectOption(second.id);
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(
    page.getByRole('heading', { name: 'K5 Only Member', exact: true }),
  ).toBeVisible();
  await page.goto(
    `/admin/members?businessId=${businessId}&branchId=${first.id}`,
  );
  await expect(
    page.getByRole('heading', { name: 'No members found' }),
  ).toBeVisible();
  await page.getByLabel('Branch', { exact: true }).selectOption(second.id);
  await expect(page.getByRole('table')).toContainText('K5 Only Member');
  await page.goto(`/admin/membership-plans/new?businessId=${businessId}`);
  await page
    .getByLabel('Plan Name', { exact: true })
    .fill('Regression Monthly');
  await page.getByLabel('Price', { exact: true }).fill('123.45');
  await page.getByLabel('Duration in Days', { exact: true }).fill('30');
  await page.getByRole('button', { name: 'Create Plan' }).click();
  await expect(
    page.getByRole('heading', { name: 'Regression Monthly', exact: true }),
  ).toBeVisible();
  await page.goto(
    `/admin/memberships/new?businessId=${businessId}&branchId=${second.id}`,
  );
  await page.getByLabel('Member', { exact: true }).selectOption(memberId);
  await page
    .getByLabel('Membership branch', { exact: true })
    .selectOption(second.id);
  await page
    .getByLabel('Plan', { exact: true })
    .selectOption({ label: 'Regression Monthly' });
  await page
    .getByRole('button', { name: 'Confirm Membership', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Regression Monthly', exact: true }),
  ).toBeVisible();
  await page.goto(
    `/admin/attendance?businessId=${businessId}&branchId=${second.id}`,
  );
  await page.getByLabel('Member', { exact: true }).selectOption(memberId);
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Check-in recorded');
  await expect(
    page.getByRole('button', { name: 'Check out', exact: true }),
  ).toHaveCount(1);
  await page.getByRole('button', { name: 'Check out', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Check out', exact: true }),
  ).toHaveCount(0);
  await page.goto(
    `/admin/reports?businessId=${businessId}&branchId=${second.id}`,
  );
  await page
    .getByLabel('Report type', { exact: true })
    .selectOption('attendance');
  await expect(page.getByRole('table')).toContainText('K5 Only Member');
  await page.goto(`/admin/branches/${second.id}?businessId=${businessId}`);
  await expect(
    page.getByRole('region', {
      name: 'Outstanding Dues: ₹123.45',
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(`/admin/settings?businessId=${businessId}`);
  await expect(
    page.getByRole('heading', { name: 'Current team', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Admin invitations', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `/admin/members?businessId=${businessId}&branchId=${second.id}`,
  );
  await expect(
    page.getByRole('link', { name: 'K5 Only Member', exact: true }).last(),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/admin-branch-mobile.png',
    fullPage: true,
  });
});
