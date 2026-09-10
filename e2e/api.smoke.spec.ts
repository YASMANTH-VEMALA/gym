import { expect, test } from '@playwright/test';

test('API health endpoint is available', async ({ request }) => {
  const response = await request.get('http://127.0.0.1:3001/health');

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'ok' });
});
