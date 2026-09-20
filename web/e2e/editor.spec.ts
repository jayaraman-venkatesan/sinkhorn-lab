import { expect, test, type Page, type Route } from '@playwright/test';

async function holdNextSolve(page: Page) {
  let release!: () => void;
  let intercepted!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const reached = new Promise<void>((resolve) => { intercepted = resolve; });
  await page.route('**/api/solve', async (route: Route) => {
    intercepted();
    await gate;
    try {
      await route.continue();
    } catch {
      // The browser correctly disposed the intercepted request after AbortController.abort().
    }
  });
  return { reached, release };
}

test('edits quantities and blocks an unequal scenario before transport', async ({ page }) => {
  await page.goto('/lab');

  await expect(page.getByText('Supply total: 100', { exact: true })).toBeVisible();
  await expect(page.getByText('Demand total: 100', { exact: true })).toBeVisible();
  await page.getByLabel('Warehouse A quantity').fill('41');

  await expect(page.getByText('Supply total: 101', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('alert').getByText('Supply and demand totals must be equal before running.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Basic' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Run comparison' })).toBeDisabled();
});

test('previews every custom cost replacement before cancel or confirmation', async ({ page }) => {
  await page.goto('/lab');
  const mode = page.getByLabel('Cost mode');
  const firstCost = page.getByLabel('Cost from Warehouse A to Destination A');

  await mode.selectOption('Custom');
  await firstCost.fill('123');
  await mode.selectOption('Distance');

  const preview = page.getByRole('dialog', { name: 'Replace custom costs?' });
  await expect(preview.getByRole('table', { name: 'Cost replacement preview' })).toBeVisible();
  await expect(
    preview.getByRole('row', { name: /Warehouse A to Destination A 123 60/ }),
  ).toBeVisible();
  await preview.getByRole('button', { name: 'Keep custom costs' }).click();
  await expect(mode).toHaveValue('Custom');
  await expect(firstCost).toHaveValue('123');

  await mode.selectOption('Distance');
  await preview.getByRole('button', { name: 'Replace costs' }).click();
  await expect(mode).toHaveValue('Distance');
  await expect(firstCost).toHaveValue('60');
  await expect(firstCost).toBeDisabled();
});

test('keeps keyboard focus inside the replacement preview and Escape cancels', async ({ page }) => {
  await page.goto('/lab');
  const mode = page.getByLabel('Cost mode');
  const sourceX = page.getByLabel('Warehouse A X position');
  const firstCost = page.getByLabel('Cost from Warehouse A to Destination A');

  await mode.selectOption('Custom');
  await firstCost.fill('123');
  await mode.selectOption('Distance');

  const preview = page.getByRole('dialog', { name: 'Replace custom costs?' });
  const keepCustom = preview.getByRole('button', { name: 'Keep custom costs' });
  await expect(keepCustom).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(preview.getByRole('button', { name: 'Replace costs' })).toBeFocused();
  await sourceX.focus();
  await expect(sourceX).not.toBeFocused();

  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(mode).toHaveValue('Custom');
  await expect(firstCost).toHaveValue('123');
});

test('applies the exact distance matrix shown in the replacement preview', async ({ page }) => {
  await page.goto('/lab');
  const mode = page.getByLabel('Cost mode');
  const sourceX = page.getByLabel('Warehouse A X position');
  const firstCost = page.getByLabel('Cost from Warehouse A to Destination A');

  await mode.selectOption('Custom');
  await mode.selectOption('Distance');
  const preview = page.getByRole('dialog', { name: 'Replace custom costs?' });
  await expect(
    preview.getByRole('row', { name: /Warehouse A to Destination A 60 60/ }),
  ).toBeVisible();

  await sourceX.evaluate((element) => {
    const input = element as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setValue) throw new Error('The browser did not expose the input value setter.');
    setValue.call(input, '16');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(sourceX).toHaveValue('16');

  await preview.getByRole('button', { name: 'Replace costs' }).click();
  await expect(mode).toHaveValue('Distance');
  await expect(firstCost).toHaveValue('60');
});

test('runs Basic through the real API and renders its result', async ({ page }) => {
  await page.goto('/lab');
  await page.getByRole('button', { name: 'Run Basic' }).click();

  const result = page.getByRole('article', { name: 'Basic result' });
  await expect(result).toBeVisible();
  await expect(result.getByText('ThresholdMet', { exact: true })).toBeVisible();
  await expect(result.getByText('Usable plan: Yes', { exact: true })).toBeVisible();
  await expect(result.getByText(/0\.9\.6\.post1/)).toBeVisible();
});

test('runs a real sequential comparison with identical numerical settings', async ({ page }) => {
  const requests: Array<Record<string, unknown>> = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/solve')) {
      requests.push(request.postDataJSON() as Record<string, unknown>);
    }
  });
  await page.goto('/lab');
  await page.getByRole('button', { name: 'Run comparison' }).click();

  await expect(page.getByRole('article', { name: 'Basic result' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'LogDomain result' })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests.map((request) => request.solver)).toEqual(['Basic', 'LogDomain']);
  const basic = { ...requests[0]! };
  const logDomain = { ...requests[1]! };
  delete basic.solver;
  delete logDomain.solver;
  expect(basic).toEqual(logDomain);
});

test('editing aborts a held request and prevents its late result from replacing stale state', async ({
  page,
}) => {
  await page.goto('/lab');
  const held = await holdNextSolve(page);
  await page.getByRole('button', { name: 'Run Basic' }).click();
  await held.reached;

  await page.getByLabel('Warehouse A X position').fill('16');
  held.release();

  await expect(page.getByText('Inputs changed. The previous result is stale and was cleared.')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Basic result' })).toHaveCount(0);
});

test('cancel aborts a held request and never accepts a result', async ({ page }) => {
  await page.goto('/lab');
  const held = await holdNextSolve(page);
  await page.getByRole('button', { name: 'Run Basic' }).click();
  await held.reached;
  await page.getByRole('button', { name: 'Cancel' }).click();
  held.release();

  await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Basic result' })).toHaveCount(0);
  await expect(page.getByText('Run a solver explicitly to inspect its numerical result.')).toBeVisible();
});
