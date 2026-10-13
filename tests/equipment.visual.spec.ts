import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { DEFAULT_EQUIPMENT } from '../src/equipment/config';
import { maximumHeelAngleRad } from '../src/equipment/model';
import { sampleTunnel } from '../src/lab/windTunnel';

async function frame(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function hardware(page: Page) {
  return page.evaluate(({ frontHeight, rearHeight }) => {
    const lab = (window as any).SKYLIFT.tunnel;
    lab.athlete.root.updateMatrixWorld(true);
    const point = (name: string) => lab.athlete.root.getObjectByName(name).getWorldPosition(lab.camera.position.clone());
    const skis = lab.athlete.legs.map((leg: any, i: number) => {
      const side = i === 0 ? 'left' : 'right';
      const front = point(`${side}-boot-front-attachment`), skiFront = point(`${side}-ski-front-attachment`);
      const rearBoot = point(`${side}-binding-rear-boot-anchor`), rearSki = point(`${side}-binding-rear-ski-anchor`);
      const rearInSki = leg.ski.worldToLocal(rearBoot.clone());
      const rotation = leg.ski.getWorldQuaternion(leg.ski.quaternion.clone());
      const chord = lab.camera.position.clone().set(1, 0, 0).applyQuaternion(rotation);
      const normal = lab.camera.position.clone().set(0, 1, 0).applyQuaternion(rotation);
      const positions = leg.ski.children[0].geometry.getAttribute('position');
      let minZ = Infinity, maxZ = -Infinity;
      for (let j = 0; j < positions.count; j++) {
        const vertex = lab.camera.position.clone().fromBufferAttribute(positions, j).applyMatrix4(leg.ski.children[0].matrixWorld);
        minZ = Math.min(minZ, vertex.z); maxZ = Math.max(maxZ, vertex.z);
      }
      return { frontGap: front.distanceTo(skiFront), rodLength: rearBoot.distanceTo(rearSki),
        heelRise: rearInSki.y + frontHeight - rearHeight,
        heel: leg.ski.userData.heelAngleRad, chord: chord.toArray(), normal: normal.toArray(), minZ, maxZ,
        projected: [front, rearBoot, rearSki].map(p => p.project(lab.camera).toArray()),
        hasRod: Boolean(lab.athlete.root.getObjectByName(`${side}-binding-rear-rod`)) };
    });
    return { skis, settings: lab.settings, heels: lab.heelAngles,
      gap: skis[1].minZ - skis[0].maxZ, cameraMode: lab.cameraMode };
  }, { frontHeight: DEFAULT_EQUIPMENT.binding.frontPivotHeightM,
    rearHeight: DEFAULT_EQUIPMENT.binding.rearBootAttachmentHeightM });
}

test('native heel controls keep front joints fixed, rear rods bounded and both physical skis separated', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://127.0.0.1:5173'); await page.locator('#open-tunnel').click();
  await page.locator('[data-lab-view="bindings"]').click();
  await frame(page);
  await page.locator('.wind-canvas').screenshot({ path: 'artifacts/m1-bindings-neutral-desktop.png' });
  const neutral = await hardware(page);
  expect(neutral.cameraMode).toBe('bindings');
  expect(neutral.heels).toEqual([0, 0]);
  // End/Home are real keyboard events on the native range controls.
  await page.locator('[data-heel="0"]').focus(); await page.keyboard.press('End');
  await page.locator('[data-heel="1"]').focus(); await page.keyboard.press('End');
  await frame(page);
  const extended = await hardware(page);
  for (const ski of extended.skis) {
    expect(ski.heel).toBeCloseTo(maximumHeelAngleRad(), 10);
    expect(ski.frontGap).toBeLessThan(1e-10);
    expect(ski.rodLength).toBeLessThanOrEqual(DEFAULT_EQUIPMENT.binding.rodMaxLengthM + 1e-10);
    expect(ski.heelRise).toBeGreaterThan(.04);
    expect(ski.hasRod).toBe(true);
  }
  for (const point of extended.skis[0].projected) {
    expect(Math.abs(point[0])).toBeLessThan(.85); expect(Math.abs(point[1])).toBeLessThan(.8);
  }
  expect(extended.gap).toBeGreaterThanOrEqual(.03 - 1e-6);
  const expected = sampleTunnel(extended.settings, extended.heels);
  for (let i = 0; i < 2; i++) for (const [key, vector] of [['chord', expected.skis[i].chord], ['normal', expected.skis[i].normal]] as const) {
    for (const [axis, coordinate] of ['x', 'y', 'z'].entries()) expect(extended.skis[i][key][axis]).toBeCloseTo(vector[coordinate as 'x' | 'y' | 'z'], 10);
  }
  await expect(page.locator('[data-metric="alpha"]')).toHaveText(`${(expected.skis[0].alpha * 180 / Math.PI).toFixed(1)}° / ${(expected.skis[1].alpha * 180 / Math.PI).toFixed(1)}° / ${(expected.body.alpha * 180 / Math.PI).toFixed(1)}°`);
  await page.locator('.wind-canvas').screenshot({ path: 'artifacts/m1-bindings-raised-desktop.png' });
  await page.locator('[data-compare="A"]').click();
  await page.locator('[data-heel="1"]').focus(); await page.keyboard.press('Home');
  await page.locator('[data-compare="B"]').click();
  await expect(page.locator('[data-comparison]')).toContainText('pięty L/P');
  const download = page.waitForEvent('download'); await page.locator('[data-export]').click();
  const csv = (await readFile((await (await download).path())!, 'utf8')).trim().split('\n');
  const lastTwo = csv[1].split(',').slice(-2).map(Number);
  expect(lastTwo[0]).toBeCloseTo(maximumHeelAngleRad(), 10); expect(lastTwo[1]).toBe(0);
  await page.locator('[data-lab-view="athlete"]').click();
  const asymmetric = await hardware(page);
  expect(asymmetric.gap).toBeGreaterThanOrEqual(.03 - 1e-6);
  expect(errors).toEqual([]);
});

test('mobile binding close view exposes toe clamp, heel eye and rear guide without horizontal overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5173'); await page.locator('#open-tunnel').click();
  await page.locator('[data-heel="0"]').focus(); await page.keyboard.press('End');
  await page.locator('[data-lab-view="bindings"]').click();
  await page.locator('.wind-canvas').scrollIntoViewIfNeeded(); await frame(page);
  const state = await hardware(page);
  for (const p of state.skis[0].projected) {
    expect(Math.abs(p[0])).toBeLessThan(.85); expect(Math.abs(p[1])).toBeLessThan(.8);
  }
  expect(state.skis[0].frontGap).toBeLessThan(1e-10);
  expect(state.skis[0].rodLength).toBeLessThanOrEqual(DEFAULT_EQUIPMENT.binding.rodMaxLengthM + 1e-10);
  const overflow = await page.evaluate(() => {
    const panel = document.querySelector('#wind-tunnel')!; return panel.scrollWidth - panel.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'artifacts/m1-bindings-mobile.png' });
  await page.locator('.wind-canvas').screenshot({ path: 'artifacts/m1-bindings-mobile-close.png' });
  expect(errors).toEqual([]);
});
