import {test, expect} from '@playwright/test';

test('close camera shows the complete staged athlete animation', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  await page.goto('http://localhost:5173');
  await page.waitForFunction(() => Boolean((window as any).SKYLIFT));
  await page.evaluate(() => {
    const a = (window as any).SKYLIFT;
    a.reset(true); a.setCamera('athlete', true); a.step(160);
  });
  await page.screenshot({path: 'artifacts/08-athlete-tuck.png'});
  await page.evaluate(() => {
    const a = (window as any).SKYLIFT;
    while (a.sim.phase === 'inrun' && a.sim.x < -1.8) a.sim.step();
    a.setCamera('athlete', true); a.step(0);
  });
  await page.screenshot({path: 'artifacts/09-athlete-drive.png'});
  await page.evaluate(() => {
    const a = (window as any).SKYLIFT;
    while (a.sim.phase === 'inrun') a.sim.step();
    a.step(24);
  });
  await page.screenshot({path: 'artifacts/10-athlete-transfer.png'});
  await page.evaluate(() => (window as any).SKYLIFT.step(48));
  await page.screenshot({path: 'artifacts/11-athlete-flight.png'});
  const framed = await page.evaluate(() => {
    const a = (window as any).SKYLIFT;
    const position = a.view.athlete.pelvis.getWorldPosition(a.view.camera.position.clone()).project(a.view.camera);
    return {x: position.x, y: position.y, phase: a.sim.phase};
  });
  expect(framed.phase).toBe('flight');
  expect(Math.abs(framed.x)).toBeLessThan(.4);
  expect(Math.abs(framed.y)).toBeLessThan(.4);
  await page.evaluate(() => {
    const a = (window as any).SKYLIFT;
    for (let i = 0; i < 2000 && a.sim.phase === 'flight'; i++) a.sim.step();
    a.step(0);
  });
  await expect(page.locator('#phase')).toContainText('Lądowanie');
  await page.screenshot({path: 'artifacts/12-athlete-touchdown.png'});
  await page.evaluate(() => (window as any).SKYLIFT.step(18));
  await page.screenshot({path: 'artifacts/13-athlete-absorption.png'});
  await page.evaluate(() => (window as any).SKYLIFT.step(150));
  await page.screenshot({path: 'artifacts/14-athlete-outrun.png'});
  expect(errors).toEqual([]);
});

test('render interpolation is smooth and cannot change physical state', async ({page}) => {
  await page.goto('http://localhost:5173');
  await page.waitForFunction(() => Boolean((window as any).SKYLIFT));
  const result = await page.evaluate(() => {
    const a = (window as any).SKYLIFT;
    a.reset(true); a.step(100);
    const previous = {...a.sim};
    a.sim.step();
    const physical = JSON.stringify(a.sim);
    a.view.render(a.sim, previous, .5);
    const midpointError = Math.abs(a.view.athlete.root.position.x - (previous.x + a.sim.x) * .5);
    const unchanged = physical === JSON.stringify(a.sim);
    a.view.render(a.sim);
    return {midpointError, unchanged, exactError: Math.abs(a.view.athlete.root.position.x - a.sim.x)};
  });
  expect(result.midpointError).toBeLessThan(1e-10);
  expect(result.unchanged).toBe(true);
  expect(result.exactError).toBe(0);
});

test('isolated anatomical poses render with a stable procedural mesh', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Keep the actual module/renderer, but render controlled poses without a live
  // game loop replacing them between setup and screenshot.
  await page.addInitScript(() => {window.requestAnimationFrame = () => 0;});
  await page.setViewportSize({width: 1100, height: 850});
  await page.goto('http://localhost:5173');
  await page.waitForFunction(() => Boolean((window as any).SKYLIFT));
  await page.evaluate(() => {
    const v = (window as any).SKYLIFT.view;
    const lights = v.scene.children.filter((o: any) => o.isLight).map((o: any) => o.clone());
    v.scene.clear(); v.scene.add(...lights, v.athlete.root);
    v.scene.fog = null; v.scene.background.set('#dde5e8');
    const sun = lights.find((light: any) => light.isDirectionalLight);
    sun.position.set(-3, 7, 5); v.scene.add(sun.target);
    v.athlete.root.position.set(0, 0, 0); v.athlete.root.rotation.set(0, 0, 0);
    v.camera.position.set(1.2, 1.6, 4.0); v.camera.lookAt(.38, .75, 0);
    document.querySelectorAll('body > :not(canvas)').forEach(o => (o as HTMLElement).style.display = 'none');
  });
  for (const [name, extension, flight, landing] of [
    ['tuck', 0, 0, 0], ['push', 1, 0, 0], ['flight', 1, 1, 0], ['telemark', 1, 3, 1],
  ] as const) {
    await page.evaluate(({extension, flight, landing}) => {
      const v = (window as any).SKYLIFT.view;
      v.athlete.pose(extension, flight, landing);
      v.renderer.render(v.scene, v.camera);
    }, {extension, flight, landing});
    await page.screenshot({path: `artifacts/athlete-${name}.png`});
  }
  expect(errors).toEqual([]);
});
