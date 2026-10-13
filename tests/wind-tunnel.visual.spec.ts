import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { sampleTunnel, type TunnelSettings } from '../src/lab/windTunnel';

const url = 'http://127.0.0.1:5173';
async function setSlider(page: Page, key: keyof TunnelSettings, value: number) {
  await page.locator(`#wind-tunnel [data-key="${key}"]`).evaluate((element, supplied) => {
    const input = element as HTMLInputElement;
    input.value = String(supplied);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
async function renderedFrame(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function specimenState(page: Page) {
  return page.evaluate(() => {
    const lab = (window as any).SKYLIFT.tunnel;
    lab.athlete.root.updateMatrixWorld(true);
    let maxX = 0, maxY = 0, minHeight = Infinity;
    lab.athlete.root.traverse((object: any) => {
      if (!object.isMesh) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const b = object.geometry.boundingBox;
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y])
        for (const z of [b.min.z, b.max.z]) {
          const point = lab.camera.position.clone().set(x, y, z).applyMatrix4(object.matrixWorld);
          minHeight = Math.min(minHeight, point.y);
          const projected = point.project(lab.camera);
          maxX = Math.max(maxX, Math.abs(projected.x));
          maxY = Math.max(maxY, Math.abs(projected.y));
        }
    });
    return { settings: lab.settings as TunnelSettings,
      pitch: lab.athlete.root.rotation.z, lean: -lab.athlete.torso.rotation.z,
      v: lab.athlete.legs.map((leg: any) => leg.ski.rotation.y),
      maxX, maxY, minHeight, triangles: lab.renderer.info.render.triangles };
  });
}

test('every slider agrees with the visible skeleton and the flight force calculation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url);
  await page.waitForFunction(() => Boolean((window as any).SKYLIFT));
  await page.evaluate(() => { const a = (window as any).SKYLIFT; a.reset(true); a.step(200); });
  const jump = await page.evaluate(() => JSON.stringify((window as any).SKYLIFT.sim));
  await page.locator('#open-tunnel').click();
  const tunnel = page.locator('#wind-tunnel');
  await expect(tunnel).toBeVisible();
  await expect(tunnel.locator('[data-key="density"]')).toHaveValue('1.225');
  await expect(tunnel.locator('[data-key="density"]').locator('..').locator('output')).toHaveText('1.225 kg/m³');
  for (const settings of [
    { speed: 27, incidenceDeg: 10, bodyLeanDeg: 73, vHalfAngleDeg: 10, density: 1.225 },
    { speed: 40, incidenceDeg: 30, bodyLeanDeg: 50, vHalfAngleDeg: 14, density: 1.5 },
    { speed: 12, incidenceDeg: -10, bodyLeanDeg: 86, vHalfAngleDeg: 0, density: .85 },
  ]) {
    for (const [key, value] of Object.entries(settings)) await setSlider(page, key as keyof TunnelSettings, value);
    const state = await specimenState(page);
    expect(state.settings).toEqual(settings);
    expect(state.pitch).toBeCloseTo(settings.incidenceDeg * Math.PI / 180, 10);
    expect(state.lean).toBeCloseTo(settings.bodyLeanDeg * Math.PI / 180, 10);
    expect(state.v[0]).toBeCloseTo(settings.vHalfAngleDeg * Math.PI / 180, 10);
    expect(state.v[1]).toBeCloseTo(-settings.vHalfAngleDeg * Math.PI / 180, 10);
    expect(state.maxX).toBeLessThan(.85); expect(state.maxY).toBeLessThan(.8);
    expect(state.minHeight).toBeGreaterThan(.10);
    const expected = sampleTunnel(settings);
    await expect(tunnel.locator('[data-metric="lift"]')).toHaveText(`${expected.liftVertical.toFixed(1)} N`);
    await expect(tunnel.locator('[data-metric="drag"]')).toHaveText(`${expected.dragLongitudinal.toFixed(1)} N`);
    await expect(tunnel.locator('[data-metric="moment"]')).toHaveText(`${expected.moment.toFixed(1)} N·m`);
    await expect(tunnel.locator('[data-metric="ratio"]')).toHaveText(expected.ratio.toFixed(2));
  }
  await setSlider(page, 'incidenceDeg', 10); await setSlider(page, 'bodyLeanDeg', 73);
  await setSlider(page, 'speed', 27); await setSlider(page, 'vHalfAngleDeg', 10); await setSlider(page, 'density', 1.225);
  await renderedFrame(page);
  expect((await specimenState(page)).triangles).toBeGreaterThan(1000);
  await page.screenshot({ path: 'artifacts/tunnel-desktop.png' });
  expect(await page.evaluate(() => JSON.stringify((window as any).SKYLIFT.sim))).toBe(jump);
  await page.keyboard.press('Escape');
  await expect(tunnel).toBeHidden();
  await expect(page.locator('#open-tunnel')).toBeFocused();
  expect(await page.evaluate(() => JSON.stringify((window as any).SKYLIFT.sim))).toBe(jump);
  expect(errors).toEqual([]);
});

test('zero flow stops tracers and rapid reopen keeps one animation loop', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeRequest = window.requestAnimationFrame.bind(window);
    const nativeCancel = window.cancelAnimationFrame.bind(window);
    const pending = new Map<number, FrameRequestCallback>();
    (window as any).__rafPending = pending;
    window.requestAnimationFrame = callback => {
      const id = nativeRequest(time => { pending.delete(id); callback(time); });
      pending.set(id, callback); return id;
    };
    window.cancelAnimationFrame = id => { pending.delete(id); nativeCancel(id); };
  });
  await page.goto(url); await page.locator('#open-tunnel').click();
  await setSlider(page, 'speed', 0); await renderedFrame(page);
  const dots = await page.evaluate(() => (window as any).SKYLIFT.tunnel.flowDots.map((dot: any) => dot.position.toArray()));
  await renderedFrame(page);
  expect(await page.evaluate(() => (window as any).SKYLIFT.tunnel.flowDots.map((dot: any) => dot.position.toArray()))).toEqual(dots);
  for (const metric of ['lift', 'drag']) await expect(page.locator(`[data-metric="${metric}"]`)).toHaveText('0.0 N');
  await expect(page.locator('[data-metric="ratio"]')).toHaveText('—');
  await expect(page.locator('[data-metric="alpha"]')).toHaveText('— / —');
  expect(await page.evaluate(() => {
    const t = (window as any).SKYLIFT.tunnel; return [t.liftArrow.visible, t.dragArrow.visible];
  })).toEqual([false, false]);
  await setSlider(page, 'speed', 27); await setSlider(page, 'density', 0);
  await expect(page.locator('[data-metric="pressure"]')).toHaveText('0.0 Pa');
  await expect(page.locator('[data-metric="moment"]')).toHaveText('0.0 N·m');
  const loops = await page.evaluate(() => {
    const t = (window as any).SKYLIFT.tunnel;
    const count = () => Array.from((window as any).__rafPending.values()).filter(cb => cb === t.render).length;
    for (let i = 0; i < 25; i++) { t.close(); t.open(); }
    const open = count(); t.close(); const closed = count(); t.open(); return { open, closed, reopened: count() };
  });
  expect(loops).toEqual({ open: 1, closed: 0, reopened: 1 });
  await renderedFrame(page);
  expect(await page.evaluate(() => {
    const t = (window as any).SKYLIFT.tunnel;
    return Array.from((window as any).__rafPending.values()).filter(cb => cb === t.render).length;
  })).toBe(1);
});

test('A/B preserves conditions and CSV contains reproducible polar settings', async ({ page }) => {
  await page.goto(url); await page.locator('#open-tunnel').click();
  await page.locator('[data-compare="A"]').click();
  await setSlider(page, 'bodyLeanDeg', 50); await setSlider(page, 'vHalfAngleDeg', 0);
  await page.locator('[data-compare="B"]').click();
  await expect(page.locator('[data-comparison]')).toContainText('tułów 73.0° · V 20.0°');
  await expect(page.locator('[data-comparison]')).toContainText('tułów 50.0° · V 0.0°');
  const download = page.waitForEvent('download'); await page.locator('[data-export]').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('skylift-wind-tunnel.csv');
  const rows = (await readFile((await file.path())!, 'utf8')).trim().split('\n');
  expect(rows[0]).toBe('angle_deg,speed_m_s,body_lean_deg,v_half_angle_deg,density_kg_m3,lift_N,drag_N,lift_drag_ratio');
  expect(rows).toHaveLength(42);
  const values = rows[1].split(',').map(Number);
  expect(values.slice(0, 5)).toEqual([-10, 27, 50, 0, 1.225]);
  const expected = sampleTunnel({ speed: 27, incidenceDeg: -10, bodyLeanDeg: 50, vHalfAngleDeg: 0, density: 1.225 });
  expect(values[5]).toBeCloseTo(expected.liftVertical, 10);
  expect(values[6]).toBeCloseTo(expected.dragLongitudinal, 10);
  expect(values[7]).toBeCloseTo(expected.ratio, 10);
});

test('portrait layout keeps the complete specimen and controls within the viewport', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url); await page.locator('#open-tunnel').click();
  await setSlider(page, 'incidenceDeg', 30); await setSlider(page, 'bodyLeanDeg', 50); await setSlider(page, 'vHalfAngleDeg', 14);
  await renderedFrame(page);
  const specimen = await specimenState(page);
  expect(specimen.maxX).toBeLessThan(.85); expect(specimen.maxY).toBeLessThan(.8);
  expect(specimen.minHeight).toBeGreaterThan(.10);
  const overflow = await page.evaluate(() => {
    const panel = document.querySelector('#wind-tunnel')!;
    return panel.scrollWidth - panel.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'artifacts/tunnel-mobile.png' });
  await page.locator('[data-export]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/tunnel-mobile-controls.png' });
  expect(errors).toEqual([]);
});
