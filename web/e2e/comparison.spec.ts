import { expect, test } from '@playwright/test';

test('comparison panels retain independent playback, selection, status, and errors side by side', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/lab');
  await page.getByRole('button', { name: 'Run comparison' }).click();
  const basic = page.getByRole('article', { name: 'Basic result' });
  const log = page.getByRole('article', { name: 'LogDomain result' });
  await expect(log).toBeVisible();
  const basicBox = (await basic.boundingBox())!;
  const logBox = (await log.boundingBox())!;
  expect(logBox.x).toBeGreaterThan(basicBox.x + basicBox.width);
  await basic.getByRole('button', { name: 'Next phase' }).click();
  await expect(basic.getByLabel('Retained trace frame')).toHaveValue('1');
  await expect(log.getByLabel('Retained trace frame')).toHaveValue('0');
  await basic.getByRole('tab', { name: 'Shipment', exact: true }).click();
  await basic.getByRole('button', { name: 'Next shipment step' }).click();
  await expect(basic.getByLabel('Shipment progress')).toHaveValue('0.25');
  await expect(log.getByRole('tab', { name: 'Solver', exact: true })).toHaveAttribute('aria-selected', 'true');
  await basic.getByRole('button', { name: 'Plan Warehouse A to Destination A', exact: true }).focus();
  await expect(log.getByRole('button', { name: 'Plan Warehouse A to Destination A', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(basic.getByText('ThresholdMet', { exact: true })).toBeVisible();
  await expect(log.getByText('ThresholdMet', { exact: true })).toBeVisible();
  await expect(log.getByText('Source / target L1 residuals')).toBeVisible();
  await page.locator('.comparison-panels').screenshot({ path: '../.superpowers/sdd/2026-09-19-sinkhorn-learning-app/screenshots/comparison-desktop.png' });
});

test('375px comparison keeps failed and successful results accessible without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/lab');
  await page.getByRole('button', { name: 'Zero support preset' }).click();
  await page.getByRole('button', { name: 'Run comparison' }).click();
  const basic = page.getByRole('article', { name: 'Basic result' });
  const log = page.getByRole('article', { name: 'LogDomain result' });
  await expect(log).toBeVisible();
  await expect(basic.getByText('Numerical breakdown', { exact: true })).toBeVisible();
  await expect(basic.getByRole('button', { name: 'Play shipments', exact: true })).toBeDisabled();
  await expect(log.getByRole('button', { name: 'Play shipments', exact: true })).toBeEnabled();
  const basicBox = (await basic.boundingBox())!;
  const logBox = (await log.boundingBox())!;
  expect(logBox.y).toBeGreaterThanOrEqual(basicBox.y + basicBox.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await log.getByRole('tab', { name: 'Shipment', exact: true }).click();
  await log.getByRole('button', { name: 'Next shipment step' }).click();
  await expect(log.getByLabel('Destination B received')).toHaveText('0.25 kg');
  await page.locator('.comparison-panels').screenshot({ path: '../.superpowers/sdd/2026-09-19-sinkhorn-learning-app/screenshots/comparison-mobile.png' });
});

test('ordinary and tiny regularization presets replace the full scenario explicitly', async ({ page }) => {
  await page.goto('/lab');
  await page.getByRole('button', { name: 'Zero support preset' }).click();
  await page.getByRole('button', { name: 'Ordinary success preset' }).click();
  await expect(page.getByText('Supply total: 100', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Regularization', { exact: true })).toHaveValue('10');
  await expect(page.getByLabel('Cost mode')).toHaveValue('Distance');
  await page.getByRole('button', { name: 'Tiny regularization preset' }).click();
  await expect(page.getByLabel('Regularization', { exact: true })).toHaveValue('0.000001');
  await page.getByRole('button', { name: 'Run Basic' }).click();
  await expect(page.getByText('Numerical breakdown', { exact: true })).toBeVisible();
});
