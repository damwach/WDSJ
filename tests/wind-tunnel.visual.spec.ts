import { test, expect } from '@playwright/test';

test('the wind tunnel renders and changes live measurements without modifying the jump', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/');
  await page.locator('#open-tunnel').click();
  const tunnel = page.locator('#wind-tunnel');
  await expect(tunnel).toBeVisible();
  const lift = tunnel.locator('[data-metric="lift"]');
  await expect(lift).not.toBeEmpty();
  const before = await lift.textContent();
  await tunnel.locator('[data-key="speed"]').evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '35';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(lift).not.toHaveText(before || '');
  await expect(tunnel.locator('[data-metric="moment"]')).not.toBeEmpty();
  await expect(tunnel.locator('[data-curve]')).toHaveAttribute('points', /\d/);
  await page.screenshot({ path: 'artifacts/wind-tunnel.png' });
  await page.keyboard.press('Escape');
  await expect(tunnel).toBeHidden();
  await page.locator('#start').click();
  await expect(page.locator('#phase')).toHaveText('Najazd');
  expect(errors).toEqual([]);
});
