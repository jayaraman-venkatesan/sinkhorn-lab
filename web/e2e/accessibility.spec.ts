import { expect, test } from '@playwright/test';

test('enabled unselected mode tabs retain readable text on hover', async ({ page }) => {
  await page.goto('/lab');
  await page.getByRole('button', { name: 'Run Basic' }).click();
  const panel = page.getByRole('article', { name: 'Basic result' });
  for (const name of ['Solver', 'Shipment']) {
    const other = name === 'Solver' ? 'Shipment' : 'Solver';
    await panel.getByRole('tab', { name: other, exact: true }).click();
    const tab = panel.getByRole('tab', { name, exact: true });
    await expect(tab).toBeEnabled();
    await tab.hover();
    await expect(tab).toHaveAttribute('aria-selected', 'false');
    const contrast = await tab.evaluate((element) => {
      const style = getComputedStyle(element);
      const luminance = (color: string) => {
        const [r, g, b] = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
      };
      const foreground = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
    expect(contrast, `${name} hover text contrast`).toBeGreaterThanOrEqual(4.5);
  }
});

test('reduced motion uses explicit shipment steps and readable phase states', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/lab');
  await page.getByRole('button', { name: 'Run Basic' }).click();
  const panel = page.getByRole('article', { name: 'Basic result' });
  await expect(panel.getByText(/Reduced motion: static steps/)).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Play solver phases', exact: true })).toBeDisabled();
  await panel.getByRole('button', { name: 'Next phase' }).click();
  await expect(panel.getByLabel('Playback announcement')).toContainText('After destination update');
  await panel.getByRole('tab', { name: 'Shipment', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Play shipments', exact: true })).toBeDisabled();
  await panel.getByRole('button', { name: 'Next shipment step' }).click();
  await expect(panel.getByLabel('Shipment progress')).toHaveValue('0.25');
  await expect(panel.getByLabel('Warehouse A remaining')).toHaveText('30 kg');
  await expect(panel.getByLabel('Playback announcement')).toContainText('25%');
  await panel.screenshot({ path: '../.superpowers/sdd/2026-09-19-sinkhorn-learning-app/screenshots/reduced-motion.png' });
  await panel.getByRole('button', { name: 'Previous shipment step' }).click();
  await expect(panel.getByLabel('Shipment progress')).toHaveValue('0');
  await expect(panel.locator('.route-spark').first()).toHaveCSS('animation-name', 'none');
});

test('a motion preference change pauses a playing clock and deliberate updates alone announce', async ({ page }) => {
  await page.goto('/lab');
  await page.getByRole('button', { name: 'Run Basic' }).click();
  const panel = page.getByRole('article', { name: 'Basic result' });
  await panel.getByRole('button', { name: 'Play shipments', exact: true }).click();
  const announced = await panel.getByLabel('Playback announcement').textContent();
  await expect.poll(async () => Number(await panel.getByLabel('Shipment progress').inputValue())).toBeGreaterThan(0.02);
  await expect(panel.getByLabel('Playback announcement')).toHaveText(announced!);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(panel.getByRole('button', { name: 'Play shipments', exact: true })).toBeDisabled();
  const paused = await panel.getByLabel('Shipment progress').inputValue();
  await page.waitForTimeout(150);
  await expect(panel.getByLabel('Shipment progress')).toHaveValue(paused);
});

test('points have keyboard numeric alternatives and dragging invalidates the result', async ({ page }) => {
  await page.goto('/lab');
  const x = page.getByLabel('Warehouse A X position');
  await x.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('18');
  await page.keyboard.press('Tab');
  await expect(x).toHaveValue('18');
  await page.getByRole('button', { name: 'Run Basic' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('article', { name: 'Basic result' })).toBeVisible();
  const point = page.getByRole('button', { name: 'Move Warehouse A', exact: true });
  await point.scrollIntoViewIfNeeded();
  const box = (await point.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10, { steps: 5 });
  await page.mouse.up();
  await expect(x).not.toHaveValue('18');
  await expect(page.getByRole('article', { name: 'Basic result' })).toHaveCount(0);
  await expect(page.getByText('Inputs changed. The previous result is stale and was cleared.')).toBeVisible();
});

test('mode tabs support arrow-key navigation and describe their panel', async ({ page }) => {
  await page.goto('/lab');
  await page.getByRole('button', { name: 'Run Basic' }).click();
  const panel = page.getByRole('article', { name: 'Basic result' });
  await panel.getByRole('tab', { name: 'Solver', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(panel.getByRole('tab', { name: 'Shipment', exact: true })).toBeFocused();
  await expect(panel.getByRole('tabpanel', { name: 'Shipment', exact: true })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(panel.getByRole('tabpanel', { name: 'Solver', exact: true })).toBeVisible();
});
