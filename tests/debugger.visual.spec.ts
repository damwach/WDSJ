import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const collectErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
};

async function recordJump(page: Page) {
  await page.goto('http://localhost:5173');
  await page.waitForFunction(() => Boolean((window as any).SKYLIFT?.debugger));
  return page.evaluate(() => {
    const app = (window as any).SKYLIFT;
    app.reset(true); app.step(1440);
    const flight = app.recorder.frames.find((frame: any) => frame.phase === 'flight' && frame.state.flightTime > .65);
    const landing = app.recorder.frames.find((frame: any) => frame.phase === 'landed');
    if (!flight || !landing) throw new Error('The complete recording must contain flight and landing');
    return { flightTick: flight.tick, landingTick: landing.tick,
      live: JSON.stringify(app.sim.snapshot()), time: app.sim.time };
  });
}

async function openDebugger(page: Page) {
  await page.locator('#open-debugger').click();
  const panel = page.locator('#physics-debugger');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-validation]')).toHaveAttribute('data-state', 'valid');
  return panel;
}

test('debugger seeks, re-simulates and draws forces without changing the paused live jump', async ({ page }) => {
  const errors = collectErrors(page);
  const recorded = await recordJump(page);
  const panel = await openDebugger(page);
  await expect(panel.locator('[data-metadata]')).toContainText('120 Hz');
  await panel.locator('[data-seek]').evaluate((element, tick) => {
    const input = element as HTMLInputElement; input.value = String(tick); input.dispatchEvent(new Event('input', { bubbles: true }));
  }, recorded.flightTick);
  await expect(panel.locator('[data-phase]')).toHaveText('Lot');
  await expect(panel.locator('[data-tick]')).toContainText(`${recorded.flightTick} /`);
  const measured = await page.evaluate(() => {
    const app = (window as any).SKYLIFT;
    const frame = app.debugger.currentRecording.frames[app.debugger.selectedTick - 1];
    const overlays = app.view.scene.getObjectByName('physics-debug-overlays');
    return { live: JSON.stringify(app.sim.snapshot()), time: app.sim.time,
      model: app.view.athlete.root.position.toArray(), expected: [frame.state.x, frame.state.y, frame.state.z],
      lift: overlays.getObjectByName('debug-force-lift').visible,
      referencePoints: overlays.getObjectByName('debug-recorded-trajectory').geometry.attributes.position.count,
      replayPoints: overlays.getObjectByName('debug-recomputed-trajectory').geometry.attributes.position.count,
      rendererTriangles: app.view.renderer.info.render.triangles };
  });
  expect(measured.live).toBe(recorded.live); expect(measured.time).toBe(recorded.time);
  measured.model.forEach((value: number, axis: number) => expect(value).toBeCloseTo(measured.expected[axis], 6));
  expect(measured.lift).toBe(true); expect(measured.referencePoints).toBe(1440); expect(measured.replayPoints).toBe(1440);
  expect(measured.rendererTriangles).toBeGreaterThan(1000);
  for (const key of ['lift', 'drag', 'moment', 'alpha', 'contact'])
    await expect(panel.locator(`[data-chart="${key}"] [data-curve]`)).toHaveAttribute('points', /\d+,\d/);
  await page.screenshot({ path: 'artifacts/debugger-flight.png' });

  await panel.locator('[data-play]').click();
  await expect.poll(() => page.evaluate(() => (window as any).SKYLIFT.debugger.selectedTick)).toBeGreaterThan(recorded.flightTick + 3);
  await panel.locator('[data-play]').click();
  const stopped = await page.evaluate(() => (window as any).SKYLIFT.debugger.selectedTick);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).SKYLIFT.debugger.selectedTick)).toBe(stopped);
  await panel.locator('[data-seek]').evaluate((element, tick) => {
    const input = element as HTMLInputElement; input.value = String(tick); input.dispatchEvent(new Event('input', { bubbles: true }));
  }, recorded.landingTick);
  await expect(panel.locator('[data-phase]')).toHaveText('Lądowanie');
  await page.screenshot({ path: 'artifacts/debugger-landing.png' });
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page.locator('#open-debugger')).toBeFocused();
  expect(await page.evaluate(() => (window as any).SKYLIFT.sim.time)).toBe(recorded.time);
  expect(await page.evaluate(() => document.getElementById('scene')!.parentElement === document.body)).toBe(true);
  expect(errors).toEqual([]);
});

test('debugger exports a valid 120 Hz JSON file and rejects malformed import while preserving replay', async ({ page }) => {
  const errors = collectErrors(page);
  const recorded = await recordJump(page);
  const panel = await openDebugger(page);
  const downloadPromise = page.waitForEvent('download');
  await panel.locator('[data-export]').click();
  const download = await downloadPromise;
  const path = await download.path(); expect(path).not.toBeNull();
  const json = await readFile(path!, 'utf8'); const data = JSON.parse(json);
  expect(data.header.sampleRate).toBe(120); expect(data.header.fixedStep).toBe(1 / 120); expect(data.frames).toHaveLength(1440);
  expect(data.frames[0].forces.gravity.y).toBeLessThan(0);
  await panel.locator('[data-import]').setInputFiles({ name: 'recording.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await expect(panel.locator('[data-validation]')).toHaveAttribute('data-state', 'valid');
  await expect(panel.locator('[data-recordings] option')).toHaveCount(2);
  await panel.locator('[data-import]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"header":{}}') });
  await expect(panel.locator('[data-error]')).toBeVisible();
  await expect(panel.locator('[data-error]')).toContainText('Nie można wczytać nagrania');
  await expect(panel.locator('[data-validation]')).toHaveAttribute('data-state', 'valid');
  await expect(panel.locator('[data-tick]')).toHaveText('1440 / 1440');
  expect(await page.evaluate(() => (window as any).SKYLIFT.sim.time)).toBe(recorded.time);
  await page.screenshot({ path: 'artifacts/debugger-import-validation.png' });
  expect(errors).toEqual([]);
});

test('mobile debugger keeps the whole skier visible and controls inside the viewport', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const recorded = await recordJump(page);
  const panel = await openDebugger(page);
  await panel.locator('[data-seek]').evaluate((element, tick) => {
    const input = element as HTMLInputElement; input.value = String(tick); input.dispatchEvent(new Event('input', { bubbles: true }));
  }, recorded.flightTick);
  const bounds = await panel.locator('[data-preview]').boundingBox();
  expect(bounds!.height).toBeGreaterThan(250); expect(bounds!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(panel.locator('[data-close]')).toBeInViewport();
  const projected = await page.evaluate(() => {
    const app = (window as any).SKYLIFT;
    const skier = app.view.athlete.root;
    const vertices: { x: number; y: number; z: number }[] = [];
    skier.updateMatrixWorld(true);
    skier.traverse((object: any) => {
      const positions = object.geometry?.attributes.position;
      if (!positions) return;
      for (let i = 0; i < positions.count; i += 7) {
        const point = skier.position.clone().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(app.view.camera);
        vertices.push({ x: point.x, y: point.y, z: point.z });
      }
    });
    return vertices;
  });
  for (const point of projected) { expect(Math.abs(point.x)).toBeLessThan(1); expect(Math.abs(point.y)).toBeLessThan(1); }
  await panel.evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: 'artifacts/debugger-mobile.png' });
  await panel.locator('[data-chart="contact"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/debugger-mobile-charts.png' });
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  expect(errors).toEqual([]);
});

test('debugger selects a prior jump after reset and shows its recorded contact forces', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('http://localhost:5173');
  await page.waitForFunction(() => Boolean((window as any).SKYLIFT?.debugger));
  await page.evaluate(() => {
    const app = (window as any).SKYLIFT;
    app.reset(true); app.step(180); app.reset(false); app.step(30);
  });
  const panel = await openDebugger(page);
  await expect(panel.locator('[data-recordings] option')).toHaveCount(2);
  await expect(panel.locator('[data-metadata]')).toContainText('30 kroków');
  await panel.locator('[data-recordings]').selectOption('1');
  await expect(panel.locator('[data-metadata]')).toContainText('180 kroków');
  await expect(panel.locator('[data-validation]')).toHaveAttribute('data-state', 'valid');
  const reaction = await panel.locator('[data-chart="contact"] output').textContent();
  expect(Number(reaction!.split(' ')[0])).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/debugger-inrun.png' });
  await panel.locator('[data-recordings]').selectOption('0');
  await expect(panel.locator('[data-metadata]')).toContainText('30 kroków');
  expect(await page.evaluate(() => (window as any).SKYLIFT.sim.time)).toBeCloseTo(.25, 12);
  expect(errors).toEqual([]);
});
