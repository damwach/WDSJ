import { test, expect, type Page } from '@playwright/test';
import { height, landing } from '../src/world/hill';
import { dimensions } from '../src/athlete/rig';

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

async function expectOverviewContainsHill(page: Page) {
  const points = await page.evaluate(landmarks => {
    const app = (window as any).SKYLIFT;
    app.setCamera('overview', true);
    app.step(0);
    return landmarks.map(({ name, x, y }) => {
      const point = app.view.camera.position.clone().set(x, y, 0).project(app.view.camera);
      return { name, x: point.x, y: point.y, z: point.z };
    });
  }, [
    { name: 'inrun start', x: -65, y: height(-65) },
    { name: 'takeoff lip', x: 0, y: 0 },
    { name: 'landing slope', x: 100, y: landing(100) },
    { name: 'flat outrun', x: 180, y: landing(180) },
  ]);
  for (const point of points) {
    expect(Math.abs(point.x), `${point.name} horizontal framing`).toBeLessThan(.9);
    expect(Math.abs(point.y), `${point.name} vertical framing`).toBeLessThan(.8);
    expect(point.z, `${point.name} behind camera`).toBeGreaterThan(-1);
    expect(point.z, `${point.name} beyond far plane`).toBeLessThan(1);
  }
  await expect(page.getByRole('button', { name: 'Skocznia', exact: true })).toHaveAttribute('aria-pressed', 'true');
}

test('overview frames the hill and camera controls show the motion sequence', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('http://localhost:5173');
  await page.waitForFunction(() => Boolean((window as any).SKYLIFT));
  await expectOverviewContainsHill(page);
  await page.screenshot({ path: 'artifacts/01-ready.png' });

  await page.getByRole('button', { name: 'Pokaz techniki', exact: true }).click();
  await page.evaluate(() => {
    const app = (window as any).SKYLIFT;
    app.setCamera('broadcast', true);
    app.step(180);
  });
  await expect(page.locator('#phase')).toHaveText('Najazd');
  await expect(page.getByRole('button', { name: 'Transmisja', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'artifacts/02-inrun.png' });

  await page.getByRole('button', { name: 'Zawodnik', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Zawodnik', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => {
    const app = (window as any).SKYLIFT;
    for (let i = 0; i < 1200 && app.sim.phase === 'inrun' && app.sim.x < -1.8; i++) app.sim.step();
    app.setCamera('athlete', true);
    app.step(0);
  });
  expect(await page.evaluate(() => (window as any).SKYLIFT.sim.extension)).toBeGreaterThan(.2);
  await page.screenshot({ path: 'artifacts/03-extension.png' });

  await page.getByRole('button', { name: 'Transmisja', exact: true }).click();
  await page.evaluate(() => {
    const app = (window as any).SKYLIFT;
    for (let i = 0; i < 1200 && app.sim.phase === 'inrun'; i++) app.sim.step();
    app.setCamera('broadcast', true);
    app.step(50);
  });
  await expect(page.locator('#phase')).toContainText('Lot');
  await page.screenshot({ path: 'artifacts/04-flight.png' });
  const lengths = await page.evaluate(() => {
    const athlete = (window as any).SKYLIFT.view.athlete;
    return athlete.legs.map((leg: any) => [leg.knee.position.length(), leg.ankle.position.length()]);
  });
  expect(lengths).toEqual(Array.from({ length: 2 }, () => [dimensions.thigh, dimensions.shin]));
  await page.getByRole('button', { name: 'Skocznia', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Skocznia', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('portrait overview keeps the hill and camera controls visible', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5173');
  await page.waitForFunction(() => Boolean((window as any).SKYLIFT));
  await expectOverviewContainsHill(page);
  for (const name of ['Skocznia', 'Transmisja', 'Zawodnik']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeInViewport();
  }
  await expect(page.getByRole('button', { name: 'Rozpocznij najazd' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/06-mobile-overview.png' });
  expect(errors).toEqual([]);
});

test('mouse buttons drive extension only in takeoff window', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('http://localhost:5173');
  await page.waitForFunction(() => Boolean((window as any).SKYLIFT));
  await page.evaluate(() => {
    const app = (window as any).SKYLIFT;
    app.reset();
    app.sim.x = -6;
  });
  await page.locator('#scene').dispatchEvent('pointermove', { buttons: 1, movementY: -60, movementX: 0 });
  await page.waitForTimeout(40);
  expect(await page.evaluate(() => (window as any).SKYLIFT.sim.target)).toBe(0);
  await page.locator('#scene').dispatchEvent('pointermove', { buttons: 3, movementY: -60, movementX: 12 });
  await expect.poll(() => page.evaluate(() => (window as any).SKYLIFT.sim.target)).toBe(.5);
  expect(await page.evaluate(() => (window as any).SKYLIFT.sim.eccentricity)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
