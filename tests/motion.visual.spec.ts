import { test, expect, type Page } from '@playwright/test';
import { hill } from '../src/world/hill';
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
    { name: 'inrun start', ...hill.points.A },
    { name: 'takeoff lip', x: 0, y: 0 },
    { name: 'K125', ...hill.points.K },
    { name: 'HS140', ...hill.points.L },
    { name: 'outrun minimum U', ...hill.points.U },
    { name: 'rising outrun end', ...hill.points.outrunEnd },
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

test('two buttons independently trigger takeoff without a drag gesture', async ({ page }) => {
  const errors=collectErrors(page);
  await page.goto('http://localhost:5173');
  await page.waitForFunction(()=>Boolean((window as any).SKYLIFT));
  await page.evaluate(()=>{const a=(window as any).SKYLIFT;a.reset();a.sim.x=-6;});
  await page.locator('#scene').dispatchEvent('pointermove',{buttons:3,movementY:-70,movementX:30});
  await page.waitForTimeout(40);
  expect(await page.evaluate(()=>(window as any).SKYLIFT.sim.takeoffClicked)).toBe(false);
  await page.locator('#scene').dispatchEvent('pointerdown',{button:0,buttons:1,timeStamp:1000});
  await expect.poll(()=>page.evaluate(()=>(window as any).SKYLIFT.sim.takeoffLegTimes[0])).not.toBeNull();
  expect(await page.evaluate(()=>(window as any).SKYLIFT.sim.takeoffLegTimes[1])).toBeNull();
  await page.locator('#scene').dispatchEvent('pointerdown',{button:2,buttons:3,timeStamp:1030});
  await expect.poll(()=>page.evaluate(()=>(window as any).SKYLIFT.sim.takeoffPressGapMs)).not.toBeNull();
  expect(await page.evaluate(()=>(window as any).SKYLIFT.sim.target)).toBe(1);
  expect(await page.evaluate(()=>(window as any).SKYLIFT.sim.eccentricity)).toBe(0);
  expect(errors).toEqual([]);
});

test('the complete demonstration contacts the slope and continues on the ground', async ({ page }) => {
  const errors=collectErrors(page);
  await page.goto('http://localhost:5173');
  await page.waitForFunction(()=>Boolean((window as any).SKYLIFT));
  await page.getByRole('button',{name:'Pokaz techniki',exact:true}).click();
  const result=await page.evaluate(()=>{
    const app=(window as any).SKYLIFT;app.step(0);
    for(let i=0;i<2000&&(app.sim.phase==='inrun'||app.sim.phase==='flight');i++)app.sim.step();
    app.setCamera('athlete',true);app.step(0);
    return {phase:app.sim.phase,time:app.sim.flightTime,distance:app.sim.resultDistance,impact:app.sim.impact};
  });
  expect(result.phase).toBe('landed');expect(result.time).toBeLessThan(6);expect(result.distance).toBeGreaterThan(40);expect(result.impact).toBeLessThan(6);
  await expect(page.locator('#phase')).toContainText('Lądowanie');
  await page.screenshot({path:'artifacts/07-landing.png'});
  await page.evaluate(()=>{const app=(window as any).SKYLIFT;app.step(120);});
  await expect(page.locator('#phase')).toContainText('Lądowanie');
  expect(errors).toEqual([]);
});

test('real two-button press starts independently timed muscle activation',async ({page})=>{
  const errors=collectErrors(page);
  await page.goto('http://localhost:5173');
  await page.waitForFunction(()=>Boolean((window as any).SKYLIFT));
  await page.evaluate(()=>{const a=(window as any).SKYLIFT;a.reset();a.sim.x=-6.5;a.sim.v=5;});
  await page.mouse.move(900,550);
  await page.mouse.down({button:'left'});
  await page.mouse.down({button:'right'});
  await expect.poll(()=>page.evaluate(()=>(window as any).SKYLIFT.sim.takeoffPressGapMs)).not.toBeNull();
  await expect.poll(()=>page.evaluate(()=>(window as any).SKYLIFT.sim.extension)).toBeGreaterThan(.05);
  const state=await page.evaluate(()=>{const s=(window as any).SKYLIFT.sim;
    return {target:s.target,clickX:s.takeoffClickX,effort:s.effort,bank:s.pilotBank,
      gap:s.takeoffPressGapMs,legTimes:s.takeoffLegTimes};});
  expect(state.target).toBe(1);
  expect(state.clickX).toBeGreaterThan(-8);
  expect(state.effort).toBe(1);
  expect(state.bank).toBe(0);
  expect(state.gap).toBeGreaterThanOrEqual(0);
  expect(state.legTimes.every((t:number|null)=>t!==null)).toBe(true);
  await page.mouse.up({button:'right'});await page.mouse.up({button:'left'});
  expect(errors).toEqual([]);
});
