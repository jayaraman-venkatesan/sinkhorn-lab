import { expect, test } from '@playwright/test';

const solveRequest = {
  requestId: 'deployment-acceptance',
  source: [0.5, 0.5],
  target: [0.5, 0.5],
  costs: [[0, 1], [1, 0]],
  regularization: 1,
  solver: 'Basic',
  maxIterations: 1000,
  threshold: 1e-9,
  traceMode: 'None',
};

test('one origin serves the built course, real solver, health, and lesson reloads', async ({ request }) => {
  await expect.poll(async () => (await request.get('/api/health')).status(), { timeout: 120_000 }).toBe(200);

  const home = await request.get('/');
  expect(home.status()).toBe(200);
  expect(home.headers()['content-type']).toContain('text/html');
  expect(await home.text()).toContain('<title>Sinkhorn Lab</title>');

  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  await expect(health.json()).resolves.toEqual({ status: 'ready' });

  const unknownApi = await request.get('/api/not-a-route');
  expect(unknownApi.status()).toBe(404);
  expect(unknownApi.headers()['content-type'] ?? '').not.toContain('text/html');

  const solve = await request.post('/api/solve', { data: solveRequest });
  expect(solve.status()).toBe(200);
  await expect(solve.json()).resolves.toMatchObject({
    requestId: 'deployment-acceptance',
    solver: 'Basic',
    referenceCommit: '85113e9a380f5fcf684c50c73c1ff6a164a7366e',
    transportCost: 0.26894142136999516,
    termination: 'ThresholdMet',
    checks: { usable: true },
  });

  const lesson = await request.get('/lessons/05-numerical-behavior');
  expect(lesson.status()).toBe(200);
  expect(lesson.headers()['content-type']).toContain('text/html');
  expect(await lesson.text()).toContain('<title>Sinkhorn Lab</title>');
});
