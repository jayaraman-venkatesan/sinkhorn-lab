import { expect, test } from '@playwright/test';

test('chapter navigation renders shared prose, accessible math, and the lab', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Where should the grain go?' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Course chapters' })).toBeVisible();
  await expect(page.locator('.katex-mathml').first()).toBeAttached();
  const openingScene = page.getByRole('region', { name: 'Starting warehouse quantities and fill levels' });
  await expect(openingScene.getByLabel('Warehouse A remaining')).toHaveText('40 kg');
  await expect(openingScene.getByLabel('Destination A received')).toHaveText('0 kg');
  await expect(openingScene.locator('.map-node.source .grain-fill').first()).toHaveAttribute('height', '56');
  await expect(openingScene.locator('.map-node.target .grain-fill').first()).toHaveAttribute('height', '0');

  await page.getByRole('link', { name: '2. Try a plan' }).click();
  await expect(page).toHaveURL(/\/lessons\/02-manual-allocation$/);
  await expect(page.getByRole('heading', { name: 'Build a feasible plan' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Continue learning' }).getByRole('link', { name: 'Open the experiment lab' }).click();
  await expect(page).toHaveURL(/\/lab$/);
  await expect(page.getByRole('button', { name: 'Run Basic' })).toBeVisible();
});

test('guided scaling chapter runs the real solver scene before the lab', async ({ page }, testInfo) => {
  await page.goto('/lessons/04-regularization');
  await expect(page.getByRole('heading', { name: 'Show the mathematics' })).toBeVisible();
  await page.getByRole('button', { name: 'Run guided Basic solver' }).click();
  await expect(page.getByRole('article', { name: 'Basic result' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Basic result' })).toContainText('ThresholdMet');
  const sourceLabels = page.getByRole('article', { name: 'Basic result' }).locator('.map-node.source .node-name');
  const boxes = await sourceLabels.evaluateAll((labels) => labels.map((label) => label.getBoundingClientRect().toJSON()));
  expect(boxes).toHaveLength(3);
  expect(boxes[0]!.y + boxes[0]!.height).toBeLessThan(boxes[1]!.y);
  expect(boxes[1]!.y + boxes[1]!.height).toBeLessThan(boxes[2]!.y);
  await page.getByRole('region', { name: 'Watch destination and source updates' }).screenshot({ path: testInfo.outputPath('guided-scene.png') });
});

test('manual allocation confirms constrained shipments and supports undo and reset', async ({ page }) => {
  await page.goto('/lessons/02-manual-allocation');

  await page.getByLabel('Warehouse A to Destination A amount').fill('40');
  await page.getByRole('button', { name: 'Preview allocation' }).click();
  await expect(page.getByRole('dialog', { name: 'Confirm allocation' })).toContainText('40 kg');
  await page.getByRole('button', { name: 'Confirm allocation' }).click();
  await expect(page.getByLabel('Warehouse A remaining')).toHaveText('0 kg');
  await expect(page.getByLabel('Destination A remaining')).toHaveText('10 kg');

  await page.getByRole('button', { name: 'Undo allocation' }).click();
  await expect(page.getByLabel('Warehouse A remaining')).toHaveText('40 kg');
  await page.getByRole('button', { name: 'Reset allocations' }).click();
  await expect(page.getByText('No allocations confirmed yet.')).toBeVisible();
  const reset = page.getByRole('button', { name: 'Reset allocations' });
  await reset.hover();
  await expect(reset).toHaveCSS('background-color', 'rgb(238, 241, 233)');
  await expect(reset).toHaveCSS('color', 'rgb(23, 63, 45)');
});

test('course has readable desktop and mobile layouts', async ({ page }, testInfo) => {
  await page.goto('/lessons/04-regularization');
  await expect(page.getByRole('heading', { name: 'Regularization and alternating scaling' })).toBeVisible();
  await page.getByRole('button', { name: 'Run guided Basic solver' }).click();
  await expect(page.getByRole('article', { name: 'Basic result' })).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('course-desktop.png'),
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/lessons/02-manual-allocation');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('course-mobile.png'),
  });
});
