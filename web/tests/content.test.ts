// @ts-expect-error Node's runtime module is available to Vitest; no browser package uses it.
import { execFileSync, spawnSync } from 'node:child_process';
// @ts-expect-error Node's runtime module is available to Vitest; no browser package uses it.
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
// @ts-expect-error Node's runtime module is available to Vitest; no browser package uses it.
import { tmpdir } from 'node:os';
// @ts-expect-error Node's runtime module is available to Vitest; no browser package uses it.
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { safeLessonUrl } from '../src/lessons/LessonPage';

declare const process: { execPath: string; cwd(): string };

const repositoryRoot = path.resolve(process.cwd(), '..');
const verifier = path.join(repositoryRoot, 'scripts/verify-content.mjs');
const temporaryRoots: string[] = [];

async function contentWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'sinkhorn-content-'));
  temporaryRoots.push(root);
  for (const entry of ['content', 'vendor', 'docs', 'examples']) {
    await cp(path.join(repositoryRoot, entry), path.join(root, entry), { recursive: true });
  }
  await cp(path.join(repositoryRoot, 'README.md'), path.join(root, 'README.md'));
  return root;
}

function verify(root: string) {
  return spawnSync(process.execPath, [verifier, '--root', root], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
}

async function replace(root: string, relative: string, from: string, to: string) {
  const filename = path.join(root, relative);
  const original = await readFile(filename, 'utf8');
  expect(original).toContain(from);
  await writeFile(filename, original.replace(from, to));
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('shared course content', () => {
  it('passes the executable fixture, link, static-equivalent, and figure drift verifier', () => {
    const output = execFileSync(process.execPath, ['scripts/verify-content.mjs'], {
      cwd: path.resolve(process.cwd(), '..'),
      encoding: 'utf8',
    });

    expect(output).toContain('Content verification passed: 6 lessons.');
  });

  it('accepts an isolated intact content workspace', async () => {
    const result = verify(await contentWorkspace());

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it('rejects duplicate example ids', async () => {
    const root = await contentWorkspace();
    await replace(root, 'content/examples/zero-support.json', '"id": "zero-support"', '"id": "balanced"');

    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Duplicate example id: balanced');
  });

  it.each([
    ['protocol-relative', '//evil.example/tracker.svg', 'unsafe or unsupported URL'],
    ['backslash-relative', '\\\\evil.example\\tracker.svg', 'unsafe or unsupported URL'],
    ['missing relative', '../examples/does-not-exist.json', 'broken relative link'],
    ['website-only root route', '/lab', 'unsafe or unsupported URL'],
  ])('rejects %s links in shared Markdown', async (_kind, href, message) => {
    const root = await contentWorkspace();
    const lesson = path.join(root, 'content/lessons/01-problem.md');
    await writeFile(lesson, `${await readFile(lesson, 'utf8')}\n[Invalid link](${href})\n`);

    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(message);
  });

  it('rejects example provenance drift', async () => {
    const root = await contentWorkspace();
    await replace(root, 'content/examples/balanced.json', '85113e9a380f5fcf684c50c73c1ff6a164a7366e', '0000000000000000000000000000000000000000');

    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('balanced: Basic provenance differs from pinned fixture');
  });

  it('rejects expected solver-result drift', async () => {
    const root = await contentWorkspace();
    await replace(root, 'content/examples/balanced.json', '"transportCost": 0.26894142136999516', '"transportCost": 999');

    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('balanced: Basic expected outcome differs from pinned fixture');
  });

  it('rejects chapter 4 phase-table drift from pinned trace snapshots', async () => {
    const root = await contentWorkspace();
    await replace(root, 'content/lessons/04-regularization.md', '47.888986454621566 kg', '47 kg');

    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('phase residuals differ from pinned rectangular100 Basic trace');
  });

  it('rejects chapter 5 solver-table drift from shared expected outcomes', async () => {
    const root = await contentWorkspace();
    await replace(root, 'content/lessons/05-numerical-behavior.md', '322 / 321', '322 / 320');

    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('solver-result table differs from shared expected outcomes');
  });

  it('rejects generated figure drift', async () => {
    const root = await contentWorkspace();
    const figure = path.join(root, 'content/figures/balanced.svg');
    await writeFile(figure, `${await readFile(figure, 'utf8')}\n`);

    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Figure drift: content/figures/balanced.svg');
  });

  it('keeps dangerous Markdown URLs inert while allowing course navigation', () => {
    expect(safeLessonUrl('javascript:alert(1)')).toBe('');
    expect(safeLessonUrl('data:text/html,unsafe')).toBe('');
    expect(safeLessonUrl('//evil.example/tracker.svg')).toBe('');
    expect(safeLessonUrl('\\\\evil.example\\tracker.svg')).toBe('');
    expect(safeLessonUrl('/\\evil.example/tracker.svg')).toBe('');
    expect(safeLessonUrl('https:\\\\evil.example/tracker.svg')).toBe('');
    expect(safeLessonUrl('/lab')).toBe('/lab');
    expect(safeLessonUrl('https://arxiv.org/pdf/1306.0895')).toBe('https://arxiv.org/pdf/1306.0895');
  });

  it('maps the shared research-note link to a bundled website asset', () => {
    const url = safeLessonUrl('../../docs/research/paper-arxiv-1306-0895-sinkhorn-shift-lab/mass-trace-research.md');

    expect(url).toContain('mass-trace-research');
    expect(url).not.toContain('../');
  });
});
