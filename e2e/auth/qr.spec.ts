import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
test('QR generation, download, rotation, revocation and public branch resolution', async ({
  page,
  request,
}) => {
  const email = `qr-${randomUUID()}@example.com`;
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
  await page.getByLabel('Full Name', { exact: true }).fill('QR Member');
  await page.getByLabel('Mobile Number', { exact: true }).fill('9012345678');
  await page.getByLabel('Joining Date', { exact: true }).fill('2026-09-01');
  await page.getByRole('button', { name: 'Create Member' }).click();
  await expect(
    page.getByRole('heading', { name: 'QR Member', exact: true }),
  ).toBeVisible();
  const route = `/admin/qr?businessId=${fixture.first.id}&branchId=${fixture.first.branches[0].id}`;
  await page.goto(route);
  await page
    .getByLabel('Member', { exact: true })
    .selectOption({ label: 'QR Member · MEM000001' });
  await page.getByRole('button', { name: 'Generate QR', exact: true }).click();
  await page.getByRole('button', { name: 'View QR', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'QR code for QR Member' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print QR' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download QR' }).click();
  expect((await download).suggestedFilename()).toBe('gym-qr.png');
  await page.getByRole('button', { name: 'Rotate QR', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm rotate', exact: true })
    .click();
  await expect(
    page.getByRole('img', { name: 'QR code for QR Member' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Revoke QR', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm revoke', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Regenerate QR', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Branch Registration QR Codes', exact: true })
    .click();
  await page.getByRole('button', { name: 'Prepare all branch codes' }).click();
  await expect(
    page.getByRole('button', { name: 'View QR', exact: true }),
  ).toHaveCount(2);
  const response = page.waitForResponse(
    (r) => r.request().method() === 'GET' && /\/qr\/[0-9a-f-]+$/.test(r.url()),
  );
  await page
    .getByRole('button', { name: 'View QR', exact: true })
    .first()
    .click();
  const image = await (await response).json();
  await page.goto(image.url);
  await expect(
    page.getByRole('heading', { name: 'Harbor Fitness', exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
  await page.getByRole('button', { name: 'Cancel registration' }).click();
  await expect(
    page.getByText(
      'No registration code is available. Scan your gym’s branch QR.',
    ),
  ).toBeVisible();
});
