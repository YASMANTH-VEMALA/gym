import { randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
async function setup(page: Page, request: APIRequestContext) {
  const email = `staff-${randomUUID()}@example.com`;
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
async function required(page: Page, name: string) {
  await page.getByLabel('Full Name').fill(name);
  await page.getByLabel('Phone', { exact: true }).fill('+91 90000 00001');
  await page.getByLabel('Job Title').fill('Trainer');
  await page.getByLabel('Joining Date').fill('2026-09-07');
}

test('staff list, create, detail, multi-branch edit, counts, archive and history', async ({
  page,
  request,
}) => {
  const fixtures = await setup(page, request);
  await page.goto(`/admin/staff?businessId=${fixtures.first.id}`);
  await expect(
    page.getByRole('heading', { name: 'Staff', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'No staff found' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Add Staff' }).click();
  await page.getByRole('button', { name: 'Create Staff' }).click();
  await expect(page.getByText('Full name is required')).toBeVisible();
  await required(page, 'Ravi Kumar');
  await page.getByLabel('Email (optional)').fill('ravi@example.com');
  await page.getByLabel('Central').check();
  await page.getByRole('button', { name: 'Create Staff' }).click();
  await expect(page.getByRole('heading', { name: 'Ravi Kumar' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText(
    'Staff created successfully.',
  );
  await expect(
    page.getByRole('main').getByText('Central', { exact: true }),
  ).toBeVisible();
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  await page.getByRole('link', { name: 'Edit Staff' }).click();
  await page.getByLabel('Full Name').fill('Ravi Trainer');
  await page.getByLabel('Riverside').check();
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(
    page.getByRole('heading', { name: 'Ravi Trainer' }),
  ).toBeVisible();
  await expect(page.getByText('Central, Riverside')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Staff sections' })
    .getByRole('button', { name: 'Activity' })
    .click();
  await expect(page.getByText('staff created')).toBeVisible();
  await page.getByRole('button', { name: 'Overview' }).click();
  await page.goto(
    `/admin/branches/${fixtures.first.branches[0].id}?businessId=${fixtures.first.id}`,
  );
  await expect(page.getByRole('region', { name: 'Staff: 1' })).toBeVisible();
  await page.goto(`/admin/dashboard?businessId=${fixtures.first.id}`);
  await expect(
    page.getByRole('region', { name: 'Active Staff: 1' }),
  ).toBeVisible();
  await page.goto(
    `/admin/branches/${fixtures.first.branches[0].id}?businessId=${fixtures.first.id}`,
  );
  await page
    .getByRole('button', { name: 'Archive Branch', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm archive' }).click();
  await expect(page.getByRole('status')).toContainText(
    'archived and read-only',
  );
  await page.goto(`/admin/staff/${id}/edit?businessId=${fixtures.first.id}`);
  await expect(
    page.getByLabel(`${fixtures.first.branches[0].name} (archived, retained)`),
  ).toBeChecked();
  await page.getByLabel('Notes (optional)').fill('Retained branch history');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(
    page.getByText('Retained branch history', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('main')).toContainText(
    `${fixtures.first.branches[0].name} (archived)`,
  );
  await page.screenshot({
    path: 'test-results/auth-browser/staff-detail-desktop.png',
    fullPage: true,
  });
  await page.goto(`/admin/staff/${id}?businessId=${fixtures.first.id}`);
  await page.getByRole('button', { name: 'Archive Staff' }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'historical record and existing assignments will be preserved',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Archive Staff' }).click();
  await page.getByRole('button', { name: 'Confirm archive' }).click();
  await expect(page.getByRole('status')).toContainText(
    'archived and read-only',
  );
  await expect(page.getByRole('link', { name: 'Edit Staff' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to staff' }).click();
  await expect(
    page.getByRole('heading', { name: 'No staff found' }),
  ).toBeVisible();
  await page.getByLabel('Status', { exact: true }).selectOption('ARCHIVED');
  await expect(
    page.getByText('Ravi Trainer', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('Ravi Trainer', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
});

test('mobile Staff flow supports Admin create/archive, branch filters and API recovery', async ({
  page,
  request,
}) => {
  const fixtures = await setup(page, request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/admin/staff?businessId=${fixtures.second.id}`);
  await expect(
    page.getByRole('heading', { name: 'No staff found' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Add Staff' }).click();
  await required(page, 'Mobile Manager');
  await page.getByLabel('Job Title').fill('Manager');
  await page.getByLabel('North').check();
  await page.screenshot({
    path: 'test-results/auth-browser/staff-form-mobile.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Create Staff' }).click();
  await expect(
    page.getByRole('heading', { name: 'Mobile Manager' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Archive Staff' }).click();
  await page.getByRole('button', { name: 'Confirm archive' }).click();
  await expect(page.getByRole('status')).toContainText(
    'archived and read-only',
  );
  await page.goto(`/admin/staff?businessId=${fixtures.first.id}`);
  await page
    .getByLabel('Branch', { exact: true })
    .selectOption(fixtures.first.branches[0].id);
  await expect(page).toHaveURL(/branchId=/);
  await expect(
    page.getByRole('heading', { name: 'No staff found' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.route(
    '**/api/v1/businesses/*/staff?**',
    (route) =>
      route.fulfill({
        status: 503,
        json: { message: 'Staff temporarily unavailable' },
      }),
    { times: 1 },
  );
  await page.reload();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Staff temporarily unavailable',
  );
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(
    page.getByRole('heading', { name: 'No staff found' }),
  ).toBeVisible();
});
