import { randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type Page,
  type APIRequestContext,
} from '@playwright/test';

async function setup(page: Page, request: APIRequestContext) {
  const email = `plans-${randomUUID()}@example.com`;
  const fixtures = await (
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
  return fixtures;
}

test('Owner plan creation, decimal pricing, editing, inactive/reactivation, archive and persistence', async ({
  page,
  request,
}) => {
  const fixtures = await setup(page, request);
  const base = `/admin/membership-plans?businessId=${fixtures.first.id}`;
  await page.goto(base);
  await expect(
    page.getByRole('heading', { name: 'No plans found' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Create Plan' }).click();
  await page.getByLabel('Plan Name').fill('Monthly');
  await page.getByLabel('Price', { exact: true }).fill('1200.29');
  await expect(page.getByLabel('Currency')).toHaveValue('INR');
  await expect(page.getByLabel('Currency')).toHaveAttribute('readonly', '');
  await expect(
    page.getByRole('radio', { name: 'All active branches' }),
  ).toBeChecked();
  const saving = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().endsWith('/membership-plans'),
  );
  await page.getByRole('button', { name: 'Create Plan' }).click();
  expect((await saving).postDataJSON().priceMinor).toBe(120029);
  await expect(
    page.getByRole('heading', { name: 'Monthly', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('main')).toContainText('₹1,200.29');
  await expect(
    page.getByRole('region', { name: 'Active Members: 0' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Total Members: 0' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Revenue: ₹0' })).toBeVisible();
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  await page.getByRole('button', { name: 'Members', exact: true }).click();
  await expect(page.getByText('No memberships yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Plan Overview' }).click();
  await page.getByRole('link', { name: 'Edit Plan' }).click();
  await expect(page.getByLabel('Price', { exact: true })).toHaveValue(
    '1200.29',
  );
  await page.getByLabel('Plan Name').fill('Quarterly');
  await page.getByLabel('Price', { exact: true }).fill('3200');
  await page.getByRole('button', { name: '90 Days', exact: true }).click();
  await page.getByRole('radio', { name: 'Selected branches' }).check();
  await page.getByLabel('Central', { exact: true }).check();
  await page.getByLabel('Riverside', { exact: true }).check();
  await page.getByLabel('Status', { exact: true }).selectOption('INACTIVE');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(
    page.getByRole('heading', { name: 'Quarterly', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('main')).toContainText('90 calendar days');
  await expect(
    page.getByText('Central, Riverside', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('This plan is temporarily unavailable for new memberships.'),
  ).toBeVisible();
  await page.goto(base);
  await expect(
    page.getByRole('heading', { name: 'No plans found' }),
  ).toBeVisible();
  await page.getByLabel('Status', { exact: true }).selectOption('INACTIVE');
  await expect(
    page.getByRole('link', { name: 'Quarterly', exact: true }),
  ).toBeVisible();
  await page.goto(
    `/admin/membership-plans/${id}/edit?businessId=${fixtures.first.id}`,
  );
  await page.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('status')).toContainText('updated successfully');
  await page.screenshot({
    path: 'test-results/auth-browser/plan-detail-desktop.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Archive Plan', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Archiving this plan prevents it from being assigned to new memberships. Existing historical memberships will remain unchanged.',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Archive Plan', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm archive' }).click();
  await expect(page.getByRole('status')).toContainText(
    'archived and read-only',
  );
  await expect(page.getByRole('link', { name: 'Edit Plan' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('status')).toContainText(
    'archived and read-only',
  );
  await page.goto(
    `/admin/membership-plans/${id}/edit?businessId=${fixtures.first.id}`,
  );
  await expect(
    page.getByRole('heading', { name: 'Archived plan' }),
  ).toBeVisible();
  await page.goto(base);
  await page.getByLabel('Status', { exact: true }).selectOption('ARCHIVED');
  await expect(
    page.getByRole('link', { name: 'Quarterly', exact: true }),
  ).toBeVisible();
});

test('mobile Admin validation, selected branches, filters, tenant switch and recoverable errors', async ({
  page,
  request,
}) => {
  const fixtures = await setup(page, request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `/admin/membership-plans/new?businessId=${fixtures.second.id}`,
  );
  await page.getByRole('button', { name: 'Create Plan' }).click();
  await expect(page.getByText('Plan name is required')).toBeVisible();
  await page.getByLabel('Plan Name').fill('Annual');
  for (const value of ['0', '-1', '1.001']) {
    await page.getByLabel('Price', { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Create Plan' }).click();
    await expect(
      page.getByText(
        'Enter a price greater than zero, up to 10,000,000, with at most two decimal places.',
      ),
    ).toBeVisible();
  }
  await page.getByLabel('Price', { exact: true }).fill('999.99');
  await expect(page.getByLabel('Currency')).toHaveValue('USD');
  await page.getByLabel('Duration in Days').fill('0');
  await page.getByRole('button', { name: 'Create Plan' }).click();
  await expect(
    page.getByText('Duration must be between 1 and 3650 days.'),
  ).toBeVisible();
  await page.getByRole('button', { name: '365 Days', exact: true }).click();
  await page.getByRole('radio', { name: 'Selected branches' }).check();
  await page.getByRole('button', { name: 'Create Plan' }).click();
  await expect(
    page.getByText('Select at least one active branch.'),
  ).toBeVisible();
  await page.getByLabel('North', { exact: true }).check();
  await page.screenshot({
    path: 'test-results/auth-browser/plan-form-mobile.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.route(
    '**/api/v1/businesses/*/membership-plans',
    (route) =>
      route.fulfill({
        status: 503,
        json: { message: 'Plans temporarily unavailable' },
      }),
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Create Plan' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Plans temporarily unavailable',
  );
  await expect(page.getByLabel('Plan Name')).toHaveValue('Annual');
  await page.getByRole('button', { name: 'Create Plan' }).click();
  await expect(
    page.getByRole('heading', { name: 'Annual', exact: true }),
  ).toBeVisible();
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  await page.goto(`/admin/membership-plans?businessId=${fixtures.second.id}`);
  await page
    .getByLabel('Branch', { exact: true })
    .selectOption(fixtures.second.branches[0].id);
  await expect(
    page.getByRole('link', { name: 'Annual', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Search plans').fill('missing');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'No plans found' }),
  ).toBeVisible();
  await page.goto(
    `/admin/membership-plans/${id}?businessId=${fixtures.second.id}`,
  );
  await page.getByRole('button', { name: 'Archive Plan', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm archive' }).click();
  await expect(page.getByRole('status')).toContainText(
    'archived and read-only',
  );
  await page.goto(`/admin/membership-plans?businessId=${fixtures.first.id}`);
  await expect(
    page.getByRole('heading', { name: 'No plans found' }),
  ).toBeVisible();
  await page.route(
    '**/api/v1/businesses/*/membership-plans?**',
    (route) =>
      route.fulfill({
        status: 503,
        json: { message: 'Plans temporarily unavailable' },
      }),
    { times: 1 },
  );
  await page.reload();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Plans temporarily unavailable',
  );
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(
    page.getByRole('heading', { name: 'No plans found' }),
  ).toBeVisible();
});
