import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('standalone HTML renders and responds without a server or Internet', async ({ page, context }) => {
  const errors: string[] = [];
  const remoteRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => {
    if (/^https?:/.test(request.url())) remoteRequests.push(request.url());
  });
  await context.setOffline(true);
  // The cloud Chromium policy blocks all file:// navigation. Load the exact
  // distributable document into a blank page; keep networking disabled and
  // check that the document does not request any external resources.
  const {version} = JSON.parse(await readFile('package.json', 'utf8'));
  await page.setContent(await readFile(`artifacts/SKYLIFT-${version.split('.').slice(0, 2).join('.')}.html`, 'utf8'));
  await page.waitForFunction(() => Boolean((window as any).SKYLIFT));
  const startX=await page.evaluate(()=>(window as any).SKYLIFT.sim.x);
  await page.getByRole('button', { name: 'Pokaz techniki' }).click();
  await expect(page.locator('#phase')).toHaveText('Najazd');
  await page.evaluate(() => (window as any).SKYLIFT.step(180));
  const result = await page.evaluate(() => {
    const { sim, view } = (window as any).SKYLIFT;
    return { x: sim.x, phase: sim.phase, triangles: view.renderer.info.render.triangles };
  });
  expect(result.x).toBeGreaterThan(startX);
  expect(result.phase).toBe('inrun');
  expect(result.triangles).toBeGreaterThan(1000);
  await page.getByRole('button', { name: 'Zawodnik', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Zawodnik', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => {
    const app = (window as any).SKYLIFT;
    app.setCamera('athlete', true);
    app.step(0);
  });
  await page.screenshot({ path: 'artifacts/05-standalone.png' });
  expect(remoteRequests).toEqual([]);
  expect(errors).toEqual([]);
});
