import { expect, test } from '@playwright/test';

test('shared scaling equations render destination then source fractions as accessible mathematics', async ({ page }) => {
  await page.goto('/lessons/04-regularization');
  const updates = page.locator('.lesson .katex-display').filter({ has: page.locator('annotation', { hasText: /^(v_j|u_i)\s*=/ }) });
  await expect(updates).toHaveCount(2);
  await expect(updates.nth(0).locator('annotation')).toContainText('v_j = \\frac{b_j}{\\sum_i K_{ij}u_i}');
  await expect(updates.nth(1).locator('annotation')).toContainText('u_i = \\frac{1}{\\sum_j ((1/a_i)K_{ij})v_j}');
  for (const update of await updates.all()) {
    await expect(update.locator('.katex-html')).toBeVisible();
    await expect(update.locator('.katex-mathml math mfrac')).toHaveCount(1);
  }
  await expect(page.locator('.katex-error')).toHaveCount(0);
});

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

test('manual allocation preview leaves confirmed accounting unchanged', async ({ page }) => {
  await page.goto('/lessons/02-manual-allocation');

  await expect(page.getByLabel('Warehouse A remaining')).toHaveText('40 kg');
  await expect(page.getByLabel('Destination A remaining')).toHaveText('50 kg');
  await page.getByLabel('Warehouse A to Destination A amount').fill('40');
  await page.getByRole('button', { name: 'Preview allocation' }).click();
  await expect(page.getByRole('dialog', { name: 'Confirm allocation' })).toContainText('40 kg');
  await expect(page.getByLabel('Warehouse A remaining')).toHaveText('40 kg');
  await expect(page.getByLabel('Destination A remaining')).toHaveText('50 kg');
});

test('manual allocation confirmation updates sent, received, and cost accounting', async ({ page }) => {
  await page.goto('/lessons/02-manual-allocation');

  await page.getByLabel('Warehouse A to Destination A amount').fill('40');
  await page.getByRole('button', { name: 'Preview allocation' }).click();
  await page.getByRole('dialog', { name: 'Confirm allocation' }).getByRole('button', { name: 'Confirm allocation' }).click();

  await expect(page.getByLabel('Warehouse A remaining')).toHaveText('0 kg');
  await expect(page.getByLabel('Destination A remaining')).toHaveText('10 kg');
  await expect(page.getByLabel('Destination A received')).toHaveText('40 kg');
  await expect(page.locator('.allocation-status')).toContainText('Accumulated cost40');
});

test('manual allocation caps the next confirmation by both remaining constraints', async ({ page }) => {
  await page.goto('/lessons/02-manual-allocation');

  await page.getByLabel('Warehouse A to Destination A amount').fill('40');
  await page.getByRole('button', { name: 'Preview allocation' }).click();
  await page.getByRole('dialog', { name: 'Confirm allocation' }).getByRole('button', { name: 'Confirm allocation' }).click();
  await page.getByLabel('Allocation source').selectOption('1');

  const amount = page.getByLabel('Warehouse B to Destination A amount');
  await expect(amount).toHaveAttribute('max', '10');
  await amount.fill('11');
  await expect(page.getByRole('button', { name: 'Preview allocation' })).toBeDisabled();
  await expect(page.getByRole('alert')).toHaveText('Enter at most 10 kg: the smaller of remaining stock and demand.');
});

test('manual allocation undo and reset restore every accounting counter', async ({ page }) => {
  await page.goto('/lessons/02-manual-allocation');

  const confirmForty = async () => {
    await page.getByLabel('Warehouse A to Destination A amount').fill('40');
    await page.getByRole('button', { name: 'Preview allocation' }).click();
    await page.getByRole('dialog', { name: 'Confirm allocation' }).getByRole('button', { name: 'Confirm allocation' }).click();
  };

  await confirmForty();
  await page.getByRole('button', { name: 'Undo allocation' }).click();
  await expect(page.getByLabel('Warehouse A remaining')).toHaveText('40 kg');
  await expect(page.getByLabel('Destination A remaining')).toHaveText('50 kg');
  await expect(page.getByLabel('Destination A received')).toHaveText('0 kg');
  await expect(page.getByText('No allocations confirmed yet.')).toBeVisible();

  await confirmForty();
  await page.getByRole('button', { name: 'Reset allocations' }).click();
  await expect(page.getByLabel('Warehouse A remaining')).toHaveText('40 kg');
  await expect(page.getByLabel('Destination A remaining')).toHaveText('50 kg');
  await expect(page.getByLabel('Destination A received')).toHaveText('0 kg');
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
