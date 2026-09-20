// @ts-expect-error Node's runtime module is available to Vitest; no browser package uses it.
import { execFileSync } from 'node:child_process';
// @ts-expect-error Node's runtime module is available to Vitest; no browser package uses it.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { safeLessonUrl } from '../src/lessons/LessonPage';

declare const process: { execPath: string; cwd(): string };

describe('shared course content', () => {
  it('passes the executable fixture, link, static-equivalent, and figure drift verifier', () => {
    const output = execFileSync(process.execPath, ['scripts/verify-content.mjs'], {
      cwd: path.resolve(process.cwd(), '..'),
      encoding: 'utf8',
    });

    expect(output).toContain('Content verification passed: 6 lessons.');
  });

  it('keeps dangerous Markdown URLs inert while allowing course navigation', () => {
    expect(safeLessonUrl('javascript:alert(1)')).toBe('');
    expect(safeLessonUrl('data:text/html,unsafe')).toBe('');
    expect(safeLessonUrl('/lab')).toBe('/lab');
    expect(safeLessonUrl('https://arxiv.org/pdf/1306.0895')).toBe('https://arxiv.org/pdf/1306.0895');
  });
});
