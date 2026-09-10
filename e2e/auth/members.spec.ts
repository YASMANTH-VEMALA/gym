import { randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type Page,
  type APIRequestContext,
} from '@playwright/test';
async function setup(page: Page, request: APIRequestContext) {
  const email = `members-${randomUUID()}@example.com`;
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
async function required(page: Page, name: string, phone: string) {
  await page.getByLabel('Full Name', { exact: true }).fill(name);
  await page.getByLabel('Mobile Number', { exact: true }).fill(phone);
  await page.getByLabel('Joining Date', { exact: true }).fill('2026-09-08');
}
test('Owner creates, searches, edits and archives members with real dashboard counts and activity', async ({
  page,
  request,
}) => {
  const fixture = await setup(page, request);
  const base = `/admin/members?businessId=${fixture.first.id}`;
  await page.goto(base);
  await expect(
    page.getByRole('heading', { name: 'Members', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No members found' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Add Member' }).click();
  await page.getByRole('button', { name: 'Create Member' }).click();
  await expect(page.getByText('Full name is required')).toBeVisible();
  await required(page, 'Yasmanth', '+91 (98765) 43210');
  await page.getByText('More personal details', { exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('yas@example.com');
  await page.getByLabel('Date of Birth', { exact: true }).fill('1995-05-20');
  await page.getByRole('button', { name: 'Create Member' }).click();
  await expect(
    page.getByRole('heading', { name: 'Yasmanth', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('main')).toContainText('MEM000001');
  await expect(page.getByRole('main')).toContainText('+919876543210');
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  await page
    .getByRole('navigation', { name: 'Member sections' })
    .getByRole('button', { name: 'Memberships', exact: true })
    .click();
  await expect(page.getByText('No memberships yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Payments', exact: true }).click();
  await expect(page.getByText('No payments recorded yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(page.getByText('Member created', { exact: true })).toBeVisible();
  await page.goto(base);
  await expect(
    page.getByRole('link', { name: 'Yasmanth', exact: true }),
  ).toBeVisible();
  for (const term of ['MEM000001', '98765', 'yas@example.com']) {
    await page.getByLabel('Search members').fill(term);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'Yasmanth', exact: true }),
    ).toBeVisible();
  }
  await page.getByRole('link', { name: 'Yasmanth', exact: true }).click();
  await page.getByRole('link', { name: 'Edit Member' }).click();
  await page.getByLabel('Full Name', { exact: true }).fill('Yasmanth Updated');
  await page
    .getByLabel('Notes', { exact: true })
    .fill('Profile updated by Owner');
  await page.getByLabel('Status', { exact: true }).selectOption('INACTIVE');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(
    page.getByRole('heading', { name: 'Yasmanth Updated' }),
  ).toBeVisible();
  await expect(page.getByRole('main')).toContainText('MEM000001');
  await expect(
    page.getByText('Profile updated by Owner', { exact: true }),
  ).toBeVisible();
  await page.goto(`/admin/dashboard?businessId=${fixture.first.id}`);
  await expect(
    page.getByRole('region', { name: 'Total Members: 1', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Active Members: 0', exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Branch', { exact: true })
    .selectOption(fixture.first.branches[0].id);
  await expect(
    page.getByText(
      'Member counts show registrations at this branch. Financial totals show memberships purchased at this branch.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Total Members: 0', exact: true }),
  ).toBeVisible();
  await page.goto(`/admin/members/${id}/edit?businessId=${fixture.first.id}`);
  await page.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('status')).toContainText('updated successfully');
  await page.screenshot({
    path: 'test-results/auth-browser/member-detail-desktop.png',
    fullPage: true,
  });
  await page.goto(`/admin/dashboard?businessId=${fixture.first.id}`);
  await expect(
    page.getByRole('region', { name: 'Active Members: 1', exact: true }),
  ).toBeVisible();
  await page.goto(`/admin/members/${id}?businessId=${fixture.first.id}`);
  await page
    .getByRole('button', { name: 'Archive Member', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'Archiving this member removes them from normal operational lists while preserving their historical records.',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page
    .getByRole('button', { name: 'Archive Member', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm archive' }).click();
  await expect(page.getByRole('status')).toContainText(
    'archived and read-only',
  );
  await expect(page.getByRole('link', { name: 'Edit Member' })).toHaveCount(0);
  await page.goto(base);
  await expect(
    page.getByRole('heading', { name: 'No members found' }),
  ).toBeVisible();
  await page.getByLabel('Status', { exact: true }).selectOption('ARCHIVED');
  await expect(
    page.getByRole('link', { name: 'Yasmanth Updated', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('link', { name: 'Yasmanth Updated', exact: true }),
  ).toBeVisible();
  await page.goto(`/admin/dashboard?businessId=${fixture.first.id}`);
  await expect(
    page.getByRole('region', { name: 'Total Members: 0', exact: true }),
  ).toBeVisible();
});

test('mobile Admin member form validates, recovers, handles duplicates and retains business isolation', async ({
  page,
  request,
}) => {
  const fixture = await setup(page, request);
  await page.setViewportSize({ width: 390, height: 844 });
  const base = `/admin/members?businessId=${fixture.second.id}`;
  await page.goto(`/admin/members/new?businessId=${fixture.second.id}`);
  await required(page, 'Mobile Member', '90000 00001');
  await page.getByText('More personal details', { exact: true }).click();
  await page.getByLabel('Date of Birth', { exact: true }).fill('2999-01-01');
  await page.getByRole('button', { name: 'Create Member' }).click();
  await expect(
    page.getByText('Enter a valid date of birth that is not in the future.'),
  ).toBeVisible();
  await page.getByLabel('Date of Birth', { exact: true }).fill('1990-01-01');
  await page.getByText('Fitness Details', { exact: true }).click();
  await page.getByLabel('Height (cm)', { exact: true }).fill('0');
  await page.getByLabel('Weight (kg)', { exact: true }).fill('-1');
  await page.getByRole('button', { name: 'Create Member' }).click();
  await expect(
    page.getByText('Height must be a whole number from 1 to 300 cm.'),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Enter a positive weight up to 1000 kg, with at most three decimal places.',
    ),
  ).toBeVisible();
  await page.getByLabel('Height (cm)', { exact: true }).fill('175');
  await page.getByLabel('Weight (kg)', { exact: true }).fill('70.001');
  await page
    .getByLabel('Fitness Goal', { exact: true })
    .selectOption('Strength');
  await page.route(
    '**/api/v1/businesses/*/members',
    (route) =>
      route.fulfill({
        status: 503,
        json: { message: 'Members temporarily unavailable' },
      }),
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Create Member' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Members temporarily unavailable',
  );
  await expect(page.getByLabel('Full Name', { exact: true })).toHaveValue(
    'Mobile Member',
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'test-results/auth-browser/member-form-mobile.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Create Member' }).click();
  await expect(
    page.getByRole('heading', { name: 'Mobile Member', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('main')).toContainText('70.001 kg');
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  await page.goto(`/admin/members/new?businessId=${fixture.second.id}`);
  await required(page, 'Duplicate', '9000000001');
  await page.getByRole('button', { name: 'Create Member' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'A current member already uses this mobile number',
  );
  await expect(page.getByLabel('Full Name', { exact: true })).toHaveValue(
    'Duplicate',
  );
  await page.goto(`/admin/members/${id}/edit?businessId=${fixture.second.id}`);
  await page.getByLabel('Full Name', { exact: true }).fill('Admin Updated');
  await page.route(
    '**/api/v1/businesses/*/members/*',
    (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 503,
            json: { message: 'Update temporarily unavailable' },
          })
        : route.continue(),
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Update temporarily unavailable',
  );
  await expect(page.getByLabel('Full Name', { exact: true })).toHaveValue(
    'Admin Updated',
  );
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(
    page.getByRole('heading', { name: 'Admin Updated', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Archive Member', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm archive' }).click();
  await expect(page.getByRole('status')).toContainText(
    'archived and read-only',
  );
  await page.goto(base);
  await expect(
    page.getByRole('heading', { name: 'No members found' }),
  ).toBeVisible();
  await page.goto(`/admin/members?businessId=${fixture.first.id}`);
  await expect(
    page.getByRole('heading', { name: 'No members found' }),
  ).toBeVisible();
  await page.route(
    '**/api/v1/businesses/*/members?**',
    (route) =>
      route.fulfill({
        status: 503,
        json: { message: 'Members temporarily unavailable' },
      }),
    { times: 1 },
  );
  await page.reload();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Members temporarily unavailable',
  );
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(
    page.getByRole('heading', { name: 'No members found' }),
  ).toBeVisible();
  await page.goto(`/admin/members/${id}?businessId=${fixture.first.id}`);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Member not found in this business',
  );
});
