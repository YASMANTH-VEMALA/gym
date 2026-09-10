import { expect, test } from '@playwright/test';

test('passwordless sign-in page is available', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.ok()).toBe(true);
  await expect(
    page.getByRole('heading', {
      name: 'Welcome to your gym',
      exact: true,
    }),
  ).toBeVisible();
});

test('unauthenticated dashboard access returns to sign-in', async ({
  page,
}) => {
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/sign-in$/);
});
