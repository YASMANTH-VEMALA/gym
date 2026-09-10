import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
type FixtureBusiness = {
  id: string;
  name: string;
  branches: { id: string; name: string }[];
};
test('dashboard uses real business/branch data, filters, placeholders, and profile sign-out', async ({
  page,
  request,
}) => {
  const email = `dashboard-${randomUUID()}@example.com`;
  const fixtures: { first: FixtureBusiness; second: FixtureBusiness } = await (
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
  await page
    .getByLabel('Business', { exact: true })
    .selectOption(fixtures.first.id);
  await expect(page.getByRole('main')).toContainText('Harbor Fitness');
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Total Members: 0', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Collections: ₹0', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('No collections yet', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('No upcoming expirations', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('No dues to display', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Business and first branch created', { exact: true }),
  ).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Admin navigation' });
  for (const label of [
    'Dashboard',
    'Branches',
    'Members',
    'Staff',
    'Membership Plans',
    'Memberships',
    'Payments & Dues',
    'Attendance',
    'QR Management',
    'Reports',
    'Settings',
  ])
    await expect(
      nav.getByRole('link', { name: label, exact: true }),
    ).toBeVisible();
  await expect(
    nav.getByRole('link', { name: 'Dashboard', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    page.getByLabel('Branch', { exact: true }).locator('option'),
  ).toHaveText(['All Branches', 'Central', 'Riverside']);
  const branch = fixtures.first.branches.find(
    (item) => item.name === 'Riverside',
  )!;
  const filtered = page.waitForResponse((response) =>
    response
      .url()
      .includes(
        `/businesses/${fixtures.first.id}/dashboard?branchId=${branch.id}`,
      ),
  );
  await page.getByLabel('Branch', { exact: true }).selectOption(branch.id);
  expect((await filtered).status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`branchId=${branch.id}`));
  await expect(page.getByRole('main')).toContainText('1 branch in view');
  await page.reload();
  await expect(page.getByLabel('Branch', { exact: true })).toHaveValue(
    branch.id,
  );
  await expect(page.getByText('Business-wide', { exact: true })).toBeVisible();
  await page.screenshot({
    path: 'test-results/auth-browser/dashboard-desktop.png',
    fullPage: true,
  });
  await page
    .getByLabel('Business', { exact: true })
    .selectOption(fixtures.second.id);
  await expect(page.getByRole('main')).toContainText('Northside Gym');
  await expect(page.getByLabel('Branch', { exact: true })).toHaveValue('');
  await expect(page).not.toHaveURL(/branchId=/);
  await expect(
    page.getByRole('region', { name: 'Collections: $0', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('No activity yet', { exact: true }),
  ).toBeVisible();
  await nav.getByRole('link', { name: 'Members', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Members', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No members found' }),
  ).toBeVisible();
  await expect(
    nav.getByRole('link', { name: 'Members', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Total Members: 0', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open profile menu' }).click();
  await expect(page.getByRole('menu')).toContainText(email);
  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('dashboard loading/retry and mobile drawer keyboard behavior', async ({
  page,
  request,
}) => {
  const email = `mobile-${randomUUID()}@example.com`;
  const fixtures: { first: FixtureBusiness } = await (
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
  await page.goto(`/admin/dashboard?businessId=${fixtures.first.id}`);
  await expect(page.getByRole('main')).toContainText('Harbor Fitness');
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    '**/api/v1/businesses/*/dashboard*',
    async (route) => {
      await hold;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Dashboard temporarily unavailable' }),
      });
    },
    { times: 1 },
  );
  await page.reload();
  await expect(
    page.getByRole('status', { name: 'Loading dashboard' }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole('heading', { name: 'Unable to load dashboard' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Total Members: 0', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const dialog = page.getByRole('dialog', { name: 'Gym navigation' });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('link', { name: 'Dashboard', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Tab');
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Open navigation' }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page
    .getByRole('dialog')
    .getByRole('link', { name: 'Reports', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Reports', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(`/admin/dashboard?businessId=${fixtures.first.id}`);
  await expect(
    page.getByRole('region', { name: 'Total Members: 0', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/auth-browser/dashboard-mobile.png',
    fullPage: true,
  });
});
