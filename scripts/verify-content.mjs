#!/usr/bin/env node

import { access, readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonDirectory = path.join(root, 'content', 'lessons');
const expectedLessons = [
  '01-problem.md',
  '02-manual-allocation.md',
  '03-history.md',
  '04-regularization.md',
  '05-numerical-behavior.md',
  '06-library-usage.md',
];

const errors = [];
const examplesDirectory = path.join(root, 'content', 'examples');
const figuresDirectory = path.join(root, 'content', 'figures');
const referenceFixtures = {
  Basic: JSON.parse(await readFile(path.join(root, 'vendor/sinkhorn/tests/Sinkhorn.Tests/Fixtures/basic.json'), 'utf8')),
  LogDomain: JSON.parse(await readFile(path.join(root, 'vendor/sinkhorn/tests/Sinkhorn.Tests/Fixtures/log-domain.json'), 'utf8')),
};
const phaseFixtures = JSON.parse(await readFile(path.join(root, 'vendor/sinkhorn/tests/Sinkhorn.Tests/Fixtures/phase-traces.json'), 'utf8'));
const examplesById = new Map();

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function expectedSubset(referenceCase) {
  const { termination, lastAttemptedIndex, attemptedPairs, acceptedPairs, plan, checks, transportCost, warnings } = referenceCase.expected;
  return { termination, lastAttemptedIndex, attemptedPairs, acceptedPairs, plan, checks, transportCost, warnings };
}

function marginalL1(snapshot, requested, axis) {
  const actual = axis === 'row'
    ? snapshot.plan.map((row) => row.reduce((sum, value) => sum + value, 0))
    : requested.map((_, column) => snapshot.plan.reduce((sum, row) => sum + row[column], 0));
  return actual.reduce((sum, value, index) => sum + Math.abs(value - requested[index]), 0);
}

try {
  for (const filename of (await readdir(examplesDirectory)).filter((entry) => entry.endsWith('.json')).sort()) {
    const example = JSON.parse(await readFile(path.join(examplesDirectory, filename), 'utf8'));
    if (examplesById.has(example.id)) errors.push(`Duplicate example id: ${example.id}`);
    examplesById.set(example.id, example);
    if (filename !== `${example.id}.json`) errors.push(`Example filename/id mismatch: ${filename} / ${example.id}`);
    for (const solver of ['Basic', 'LogDomain']) {
      const fixture = referenceFixtures[solver].cases.find((candidate) => candidate.name === example.reference.fixtureCase);
      if (!fixture) {
        errors.push(`${example.id}: missing ${solver} fixture ${example.reference.fixtureCase}`);
        continue;
      }
      const input = ['source', 'target', 'costs', 'regularization', 'threshold', 'maxIterations'];
      for (const field of input) {
        if (!same(example[field], fixture[field])) errors.push(`${example.id}: ${field} differs from ${solver} fixture`);
      }
      if (!same(example.expected[solver], expectedSubset(fixture))) errors.push(`${example.id}: ${solver} expected outcome differs from pinned fixture`);
      const provenance = referenceFixtures[solver].provenance;
      if (example.reference.version !== `POT ${provenance.potVersion}` || example.reference.commit !== provenance.potCommit || example.reference.sourceGitBlob !== provenance.sourceGitBlob) {
        errors.push(`${example.id}: ${solver} provenance differs from pinned fixture`);
      }
    }
  }
} catch (error) {
  errors.push(`Cannot read shared examples: ${error.message}`);
}

for (const filename of expectedLessons) {
  const lessonPath = path.join(lessonDirectory, filename);
  try {
    await access(lessonPath);
    const markdown = await readFile(lessonPath, 'utf8');
    if (!/^# .+/m.test(markdown)) errors.push(`${filename}: missing chapter title`);
    if (!/^## Static equivalent$/m.test(markdown)) errors.push(`${filename}: missing readable static equivalent`);
    if (!/^\|.+\|$/m.test(markdown)) errors.push(`${filename}: static equivalent needs a Markdown table`);
    if (/<[A-Za-z][^>]*>/.test(markdown)) errors.push(`${filename}: raw HTML is not allowed`);
    const mathDelimiters = (markdown.match(/\$/g) ?? []).length;
    if (mathDelimiters % 2 !== 0) errors.push(`${filename}: unmatched math delimiter`);
    const links = [...markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]);
    for (const href of links) {
      if (/^(https:\/\/|#|\/)/.test(href)) continue;
      if (/^[a-z]+:/i.test(href)) {
        errors.push(`${filename}: unsafe or unsupported URL ${href}`);
        continue;
      }
      const relative = href.split('#', 1)[0];
      try { await access(path.resolve(lessonDirectory, relative)); }
      catch { errors.push(`${filename}: broken relative link ${href}`); }
    }
    const exampleLinks = [...markdown.matchAll(/\]\(\.\.\/examples\/([a-z0-9-]+)\.json(?:#[a-z0-9-]+)?\)/g)].map((match) => match[1]);
    if (exampleLinks.length === 0) errors.push(`${filename}: missing ordinary example link`);
    for (const id of exampleLinks) if (!examplesById.has(id)) errors.push(`${filename}: unknown example id ${id}`);
    const figureLinks = [...markdown.matchAll(/!\[[^\]]+\]\(\.\.\/figures\/([a-z0-9-]+)\.svg\)/g)].map((match) => match[1]);
    if (figureLinks.length === 0) errors.push(`${filename}: missing static figure`);
    for (const id of figureLinks) if (!examplesById.has(id)) errors.push(`${filename}: figure has no shared example ${id}`);
    if (filename === '04-regularization.md') {
      const trace = phaseFixtures.cases.find((candidate) => candidate.name === 'rectangular100' && candidate.solver === 'basic');
      const selected = [trace.snapshots[0], trace.snapshots[1], trace.snapshots[3]];
      for (const snapshot of selected) {
        const row = marginalL1(snapshot, trace.source, 'row');
        const column = marginalL1(snapshot, trace.target, 'column');
        if (!markdown.includes(`${row} kg`) || !markdown.includes(`${column} kg`)) {
          errors.push(`${filename}: phase residuals differ from pinned rectangular100 Basic trace`);
          break;
        }
      }
    }
  } catch {
    errors.push(`Missing lesson: content/lessons/${filename}`);
  }
}

try {
  const entries = await readdir(lessonDirectory);
  const unexpected = entries.filter((entry) => entry.endsWith('.md') && !expectedLessons.includes(entry));
  for (const entry of unexpected) errors.push(`Unexpected lesson: content/lessons/${entry}`);
} catch {
  // The per-file messages above state the actionable missing behavior.
}

const figureCheck = spawnSync(process.execPath, [path.join(root, 'scripts/render-figures.mjs'), '--check'], { cwd: root, encoding: 'utf8' });
if (figureCheck.status !== 0) errors.push((figureCheck.stderr || figureCheck.stdout).trim() || 'Figure drift check failed');

try {
  const readme = await readFile(path.join(root, 'README.md'), 'utf8');
  const snippet = await readFile(path.join(root, 'examples/LessonUsage/Program.cs'), 'utf8');
  const match = readme.match(/<!-- lesson-usage:start -->\s*```csharp\n([\s\S]*?)```\s*<!-- lesson-usage:end -->/);
  if (!match || `${match[1].trim()}\n` !== snippet) errors.push('README C# lesson snippet differs from the compiled LessonUsage example');
} catch (error) {
  errors.push(`Cannot verify compiled README snippet: ${error.message}`);
}

if (errors.length > 0) {
  console.error(`Content verification failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Content verification passed: ${expectedLessons.length} lessons.`);
}
