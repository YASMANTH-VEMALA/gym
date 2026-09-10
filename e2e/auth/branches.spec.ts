import { randomUUID } from 'node:crypto';
import {
  expect,
  test,
  type Page,
  type APIRequestContext,
} from '@playwright/test';

async function setup(page: Page, request: APIRequestContext) {
  const email = `branches-${randomUUID()}@example.com`;
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
  await page.goto(`/admin/branches?businessId=${fixtures.first.id}`);
  await expect(
    page.getByRole('heading', { name: 'Branches', exact: true }),
  ).toBeVisible();
  return fixtures;
}
async function fillBranch(page: Page, name: string) {
  await page.getByLabel('Branch Name').fill(name);
  await page.getByLabel('Address Line 1').fill('12 Main Road');
  await page.getByLabel('City', { exact: false }).fill('Ongole');
  await page.getByLabel('State', { exact: false }).fill('Andhra Pradesh');
  await page.getByLabel('PIN / Postal Code').fill('001234');
}
test('connected branch creation, editing, archive, selector refresh and history', async ({
  page,
  request,
}) => {
  await setup(page, request);
  await expect(page.getByRole('table')).toContainText('Central');
  await page.getByRole('link', { name: 'Add Branch', exact: true }).click();
  await page
    .getByRole('button', { name: 'Create Branch', exact: true })
    .click();
  await expect(
    page.getByText('Branch name is required', { exact: true }),
  ).toBeVisible();
  await fillBranch(page, 'Ongole Main');
  await page.getByLabel('Branch Code').fill(' ong001 ');
  await page
    .getByRole('button', { name: 'Create Branch', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Ongole Main', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText(
    'Branch created successfully.',
  );
  await expect(page.getByText('ONG001 · Harbor Fitness')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Members: 0', exact: true }),
  ).toBeVisible();
  const selector = page.getByLabel('Branch', { exact: true });
  await expect(selector.locator('option')).toHaveText([
    'All Branches',
    'Central',
    'Ongole Main',
    'Riverside',
  ]);
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  await selector.selectOption(id);
  await expect(page).toHaveURL(new RegExp(`branchId=${id}`));
  await page.getByRole('link', { name: 'Edit Branch', exact: true }).click();
  await page.getByLabel('Branch Name').fill('Ongole Central');
  await page.getByLabel('Timezone override').fill('Europe/London');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(
    page.getByRole('heading', { name: 'Ongole Central' }),
  ).toBeVisible();
  await expect(selector.locator('option')).toHaveText([
    'All Branches',
    'Central',
    'Ongole Central',
    'Riverside',
  ]);
  await expect(page.getByText('Europe/London (override)')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Branch sections' })
    .getByRole('button', { name: 'Members', exact: true })
    .click();
  await expect(
    page.getByText('View members for Ongole Central.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(selector).toHaveValue(id);
  await page.screenshot({
    path: 'test-results/auth-browser/branch-detail-desktop.png',
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Archive Branch', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'Archiving this branch prevents new operational activity but preserves historical records.',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Archive Branch', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm archive' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText(
    'This branch is archived and read-only.',
  );
  await expect(selector).toHaveValue('');
  await expect(page).not.toHaveURL(/branchId=/);
  await expect(selector.locator('option')).toHaveText([
    'All Branches',
    'Central',
    'Riverside',
  ]);
  await expect(page.getByRole('link', { name: 'Edit Branch' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to branches' }).click();
  await expect(page.getByRole('table')).not.toContainText('Ongole Central');
  await page.getByLabel('Status', { exact: true }).selectOption('ARCHIVED');
  await expect(page.getByRole('table')).toContainText('Ongole Central');
  await page.reload();
  await expect(page.getByRole('table')).toContainText('Ongole Central');
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .getByRole('link', { name: 'Dashboard', exact: true })
    .click();
  await expect(page.getByText('Branch archived: Ongole Central')).toBeVisible();
});

test('mobile branch forms, duplicate codes, errors, search and Admin permissions', async ({
  page,
  request,
}) => {
  const fixtures = await setup(page, request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: 'Add Branch', exact: true }).click();
  await fillBranch(page, 'Mobile Branch');
  await page
    .getByLabel('Email (optional)', { exact: true })
    .fill('not-an-email');
  await page
    .getByRole('button', { name: 'Create Branch', exact: true })
    .click();
  await expect(
    page.getByText('Enter a valid email address', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Email (optional)', { exact: true }).fill('');
  await page.getByLabel('Branch Code').fill('MOB001');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'test-results/auth-browser/branch-form-mobile.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('button', { name: 'Create Branch', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Mobile Branch', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to branches' }).click();
  await page.getByRole('link', { name: 'Add Branch', exact: true }).click();
  await fillBranch(page, 'Duplicate');
  await page.getByLabel('Branch Code').fill('mob001');
  await page
    .getByRole('button', { name: 'Create Branch', exact: true })
    .click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'This branch code is already used in this business.',
  );
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await page.getByLabel('Search branches').fill('mob001');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/search=mob001/);
  await expect(
    page
      .getByRole('link', { name: 'Mobile Branch', exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/auth-browser/branch-list-mobile.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel('Search branches').fill('no-such-branch');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'No branches found' }),
  ).toBeVisible();
  await page.goto(
    `/admin/branches/${fixtures.second.branches[0].id}?businessId=${fixtures.second.id}`,
  );
  await expect(
    page.getByRole('link', { name: 'Edit Branch', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Archive Branch', exact: true }),
  ).toHaveCount(0);
  await page.route(
    '**/api/v1/businesses/*/branches?**',
    (route) =>
      route.fulfill({
        status: 503,
        json: { message: 'Branches temporarily unavailable' },
      }),
    { times: 1 },
  );
  await page.getByRole('link', { name: 'Back to branches' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Branches temporarily unavailable',
  );
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(
    page
      .getByRole('link', {
        name: fixtures.second.branches[0].name,
        exact: true,
      })
      .filter({ visible: true }),
  ).toBeVisible();
});
