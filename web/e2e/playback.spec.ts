import { expect, test } from '@playwright/test';

test('ships the returned plan from one clock and links routes to cells', async ({ page }) => {
  await page.goto('/');
  const response = page.waitForResponse('**/api/solve');
  await page.getByRole('button', { name: 'Run Basic' }).click();
  const result = await (await response).json() as { transportCost: number };
  const panel = page.getByRole('article', { name: 'Basic result' });
  await panel.getByRole('tab', { name: 'Shipment', exact: true }).click();
  const progress = panel.getByLabel('Shipment progress');
  await progress.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 50; i++) await page.keyboard.press('ArrowRight');
  await expect(progress).toHaveValue('0.5');
  await expect(panel.getByLabel('Warehouse A remaining')).toHaveText('20 kg');
  await expect(panel.getByLabel('Destination A received')).toHaveText('25 kg');
  expect(Number(await panel.getByLabel('Accumulated transport cost').getAttribute('data-value'))).toBeCloseTo(result.transportCost / 2, 8);
  const cell = panel.getByRole('button', { name: 'Plan Warehouse A to Destination A', exact: true });
  const route = panel.getByRole('button', { name: 'Route Warehouse A to Destination A', exact: true });
  await cell.focus();
  await expect(route).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByLabel('Selected route')).toContainText('Warehouse A → Destination A');
  await panel.screenshot({ path: '../.superpowers/sdd/2026-09-19-sinkhorn-learning-app/screenshots/shipment-desktop.png' });
  await panel.getByRole('button', { name: 'Route Warehouse B to Destination B', exact: true }).focus();
  await expect(panel.getByRole('button', { name: 'Plan Warehouse B to Destination B', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await progress.focus();
  await page.keyboard.press('End');
  expect(Number(await panel.getByLabel('Accumulated transport cost').getAttribute('data-value'))).toBeCloseTo(result.transportCost, 8);
  await panel.getByRole('button', { name: 'Replay shipments' }).click();
  await panel.getByRole('button', { name: 'Pause shipments' }).click();
  expect(Number(await progress.inputValue())).toBeLessThan(0.2);
  await panel.getByLabel('Playback speed').selectOption('2');
  await expect(panel.getByLabel('Playback speed')).toHaveValue('2');
  await panel.getByRole('button', { name: 'Reset shipments' }).click();
  await expect(progress).toHaveValue('0');
});

test('keeps failed plans inspectable but disables shipment', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Zero support preset' }).click();
  await page.getByLabel('Solver', { exact: true }).selectOption('Basic');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByText('Numerical breakdown', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play shipments' })).toBeDisabled();
  await expect(page.getByRole('table', { name: 'Transport plan', exact: true })).toBeVisible();
  await expect(page.getByText(/Not approved for shipment/)).toBeVisible();
});

test('steps real phases, exposes rollback, and charts only reported checkpoints', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Zero support preset' }).click();
  const response = page.waitForResponse('**/api/solve');
  await page.getByRole('button', { name: 'Run Basic' }).click();
  const result = await (await response).json() as { errors: unknown[]; trace: { frames: Array<{ index: number; phase: string; rejected: boolean }> } };
  const panel = page.getByRole('article', { name: 'Basic result' });
  await expect(panel.getByLabel('Current solver phase')).toContainText('Initial solver state');
  await panel.getByRole('button', { name: 'Next phase' }).click();
  await expect(panel.getByLabel('Current solver phase')).toContainText('Rejected attempt');
  await panel.getByLabel('Retained trace frame').focus();
  await page.keyboard.press('End');
  await expect(panel.getByLabel('Current solver phase')).toContainText('Restored after rejection');
  await panel.screenshot({ path: '../.superpowers/sdd/2026-09-19-sinkhorn-learning-app/screenshots/basic-restored.png' });
  await expect(panel.getByLabel('Current solver phase')).toContainText(`Iteration ${result.trace.frames.at(-1)!.index}`);
  await expect(panel.getByRole('table', { name: 'Solver coordinates' })).toContainText('Scaling');
  await expect(panel.getByRole('table', { name: 'Reported target L2 errors' }).locator('tbody tr')).toHaveCount(result.errors.length);
});

test('discloses sampled gaps and plays retained phases without invented iterations', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Stopping threshold').fill('1e-30');
  const response = page.waitForResponse('**/api/solve');
  await page.getByRole('button', { name: 'Run LogDomain' }).click();
  const result = await (await response).json() as { errors: Array<{ index: number }>; trace: { frames: Array<{ index: number }>; omittedCount: number } };
  expect(result.trace.omittedCount).toBeGreaterThan(0);
  const panel = page.getByRole('article', { name: 'LogDomain result' });
  await expect(panel.getByText(/Sampled trace:/)).toContainText(`${result.trace.omittedCount} omitted`);
  await expect(panel.locator('.error-chart circle')).toHaveCount(result.errors.length);
  const position = result.trace.frames.findIndex((frame, i, frames) => i > 0 && frame.index > frames[i - 1]!.index + 1);
  await panel.getByLabel('Retained trace frame').focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < position; i++) await page.keyboard.press('ArrowRight');
  await expect(panel.getByLabel('Current solver phase')).toContainText(`Iteration ${result.trace.frames[position]!.index}`);
  await expect(panel.getByLabel('Current solver phase')).toContainText('omitted');
  await panel.screenshot({ path: '../.superpowers/sdd/2026-09-19-sinkhorn-learning-app/screenshots/sampled-log-domain.png' });
  await panel.getByLabel('Playback speed').selectOption('2');
  await panel.getByRole('button', { name: 'Play solver phases', exact: true }).click();
  await expect(panel.getByLabel('Retained trace frame')).not.toHaveValue(String(position));
  await panel.getByRole('button', { name: 'Pause solver phases' }).click();
  await panel.getByRole('button', { name: 'Reset solver phases' }).click();
  await expect(panel.getByLabel('Retained trace frame')).toHaveValue('0');
});

test('an exhausted result exposes its final matrix independently of tentative trace selection', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Maximum update pairs').fill('1');
  const response = page.waitForResponse('**/api/solve');
  await page.getByRole('button', { name: 'Run Basic' }).click();
  const result = await (await response).json() as { plan: number[][] };
  const panel = page.getByRole('article', { name: 'Basic result' });
  await expect(panel.getByText('IterationLimit', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Play shipments', exact: true })).toBeDisabled();
  await panel.getByText('Inspect final returned plan', { exact: true }).click();
  const final = panel.getByRole('table', { name: 'Final returned transport plan', exact: true });
  expect(Number(await final.locator('tbody td').first().getAttribute('data-value'))).toBe(result.plan[0]![0]);
  await panel.getByRole('button', { name: 'Next phase' }).click();
  expect(Number(await final.locator('tbody td').first().getAttribute('data-value'))).toBe(result.plan[0]![0]);
});

test('solver replay restarts retained evidence and speed changes keep it playing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Run Basic' }).click();
  const panel = page.getByRole('article', { name: 'Basic result' });
  await panel.getByLabel('Retained trace frame').focus();
  await page.keyboard.press('End');
  await panel.getByRole('button', { name: 'Replay solver phases' }).click();
  await expect(panel.getByLabel('Retained trace frame')).toHaveValue('0');
  await panel.getByLabel('Playback speed').selectOption('0.5');
  await expect(panel.getByRole('button', { name: 'Pause solver phases' })).toBeVisible();
  await panel.getByRole('button', { name: 'Pause solver phases' }).click();
});

test('finite nonnegative exhaustion is reported separately from shipment approval', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Maximum update pairs').fill('1');
  const response = page.waitForResponse('**/api/solve');
  await page.getByRole('button', { name: 'Run Basic' }).click();
  const result = await (await response).json() as {
    termination: string;
    checks: { finite: boolean; nonnegative: boolean; usable: boolean; sourceL1: number; targetL1: number };
  };
  expect(result.termination).toBe('IterationLimit');
  expect(result.checks).toMatchObject({ finite: true, nonnegative: true, usable: false });
  const panel = page.getByRole('article', { name: 'Basic result' });
  await expect(panel.getByText(/Not approved for shipment/)).toBeVisible();
  await expect(panel.getByText(/Infeasible or invalid/)).toHaveCount(0);
  await expect(panel.getByText('IterationLimit', { exact: true })).toBeVisible();
  await expect(panel.getByText(/Finite entries: Yes; nonnegative entries: Yes/)).toBeVisible();
  await expect(panel.getByText('Source / target L1 residuals')).toBeVisible();
  await expect(panel.getByText(/both L1 residuals below the requested threshold of 1\.0000e-9 kg/)).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Play shipments', exact: true })).toBeDisabled();
});
