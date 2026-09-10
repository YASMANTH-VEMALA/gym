import { expect, test, type Page } from '@playwright/test';
async function signIn(page: Page, email: string) {
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify and continue' }).click();
}
test('email OTP, owner onboarding, invitation context and verified-email acceptance', async ({
  page,
  browser,
  request,
}) => {
  await page.goto('/sign-in');
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await page.getByLabel('Email address').fill('owner-browser@example.com');
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await expect(page.getByRole('button', { name: /Resend in/ })).toBeDisabled();
  await page.getByLabel('Verification code').fill('000000');
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'invalid or expired' }),
  ).toBeVisible();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel('Business name').fill('Browser Gym');
  await page.getByLabel('First branch name').fill('Main Branch');
  await page.getByRole('button', { name: 'Create gym' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByRole('main')).toContainText('Browser Gym');
  await page
    .getByRole('main')
    .getByRole('link', { name: 'Access management' })
    .click();
  await page.getByLabel('Admin email').fill('admin-browser@example.com');
  await page.getByRole('button', { name: 'Send invitation' }).click();
  await expect(
    page.getByRole('cell', { name: 'SENT', exact: true }),
  ).toBeVisible();
  const outbox = await (
    await request.get('http://127.0.0.1:3102/outbox')
  ).json();
  const token = outbox.at(-1).token;
  const context = await browser.newContext();
  const invited = await context.newPage();
  await invited.goto(`/invite#token=${token}`);
  await expect(invited).toHaveURL(/\/invite$/);
  expect(
    await invited.evaluate(() =>
      sessionStorage.getItem('gym.pending-invitation'),
    ),
  ).toBe(token);
  await invited.getByRole('link', { name: 'Sign in to continue' }).click();
  await signIn(invited, 'wrong-browser@example.com');
  await invited
    .getByRole('button', { name: 'Accept Admin invitation' })
    .click();
  await expect(
    invited.getByRole('alert').filter({ hasText: 'verified email address' }),
  ).toBeVisible();
  await invited
    .getByRole('button', { name: 'Sign out and use another account' })
    .click();
  await signIn(invited, 'admin-browser@example.com');
  await invited
    .getByRole('button', { name: 'Accept Admin invitation' })
    .click();
  await expect(invited).toHaveURL(/\/admin\/dashboard/);
  await expect(invited.getByRole('main')).toContainText('Browser Gym');
  await invited.getByRole('button', { name: 'Open profile menu' }).click();
  await expect(invited.getByRole('menu')).toContainText('admin');
  await invited.keyboard.press('Escape');
  await expect(
    invited.getByRole('heading', { name: 'Admin invitations' }),
  ).toHaveCount(0);
  expect(
    await invited.evaluate(() =>
      sessionStorage.getItem('gym.pending-invitation'),
    ),
  ).toBeNull();
  await invited.reload();
  await expect(invited.getByRole('main')).toContainText('Browser Gym');
  await context.close();
});
test('Google PKCE callback establishes a session', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(
    page.getByRole('heading', { name: 'Set up your gym' }),
  ).toBeVisible();
});
test('invitation cancellation clears tab storage', async ({ page }) => {
  await page.goto(`/invite#token=${'a'.repeat(43)}`);
  await page.getByRole('button', { name: 'Cancel invitation' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(
    await page.evaluate(() => sessionStorage.getItem('gym.pending-invitation')),
  ).toBeNull();
});
