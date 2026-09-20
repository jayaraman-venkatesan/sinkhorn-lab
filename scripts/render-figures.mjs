#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootArgument = process.argv.indexOf('--root');
const root = rootArgument >= 0 ? path.resolve(process.argv[rootArgument + 1]) : scriptRoot;
const examplesDirectory = path.join(root, 'content', 'examples');
const figuresDirectory = path.join(root, 'content', 'figures');
const check = process.argv.includes('--check');

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function number(value) {
  if (Math.abs(value) >= 100 || (value !== 0 && Math.abs(value) < 0.001)) return value.toExponential(3);
  return Number(value.toPrecision(6)).toString();
}

export function renderFigure(example) {
  const outcomeEntries = Object.entries(example.expected);
  const width = 860;
  const height = 250 + outcomeEntries.length * 48;
  const source = example.source.map(number).join(', ');
  const target = example.target.map(number).join(', ');
  const costRows = example.costs.map((row) => `[${row.map(number).join(', ')}]`).join('  ');
  const outcomes = outcomeEntries.map(([solver, result], index) => {
    const y = 238 + index * 48;
    const status = result.checks.usable ? 'usable' : 'not usable';
    return `<g transform="translate(42 ${y})"><circle cx="8" cy="-5" r="7" fill="${result.checks.usable ? '#2c6e49' : '#a1462f'}"/><text x="28" y="0" class="body"><tspan class="strong">${escapeXml(solver)}</tspan><tspan> · ${escapeXml(result.termination)} · ${status} · cost ${number(result.transportCost)}</tspan></text></g>`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(example.title)}</title>
  <desc id="description">Reference inputs and named solver outcomes generated from ${escapeXml(example.id)}.json.</desc>
  <style>.title{font:700 28px Georgia,serif;fill:#173f2d}.label{font:700 14px system-ui,sans-serif;fill:#8a4615}.body{font:16px system-ui,sans-serif;fill:#17211b}.strong{font-weight:700}.box{fill:#fffdf5;stroke:#c8c4b5;stroke-width:2}</style>
  <rect x="10" y="10" width="840" height="${height - 20}" rx="18" class="box"/>
  <text x="42" y="56" class="title">${escapeXml(example.title)}</text>
  <text x="42" y="91" class="label">SOURCE</text><text x="145" y="91" class="body">${escapeXml(source)}</text>
  <text x="42" y="124" class="label">TARGET</text><text x="145" y="124" class="body">${escapeXml(target)}</text>
  <text x="42" y="157" class="label">COSTS</text><text x="145" y="157" class="body">${escapeXml(costRows)}</text>
  <text x="42" y="190" class="label">SETTINGS</text><text x="145" y="190" class="body">regularization ${number(example.regularization)} · threshold ${number(example.threshold)} · budget ${example.maxIterations}</text>
  ${outcomes}
  <text x="42" y="${height - 30}" class="label">PINNED ${escapeXml(example.reference.version)} · ${escapeXml(example.reference.commit.slice(0, 12))}</text>
</svg>
`;
}

await mkdir(figuresDirectory, { recursive: true });
const files = (await readdir(examplesDirectory)).filter((filename) => filename.endsWith('.json')).sort();
let drift = false;
for (const filename of files) {
  const example = JSON.parse(await readFile(path.join(examplesDirectory, filename), 'utf8'));
  const destination = path.join(figuresDirectory, `${example.id}.svg`);
  const rendered = renderFigure(example);
  if (check) {
    let existing = '';
    try { existing = await readFile(destination, 'utf8'); } catch { /* Report as drift below. */ }
    if (existing !== rendered) {
      console.error(`Figure drift: content/figures/${example.id}.svg`);
      drift = true;
    }
  } else {
    await writeFile(destination, rendered);
    console.log(`Rendered content/figures/${example.id}.svg`);
  }
}

if (drift) process.exitCode = 1;
else if (check) console.log(`Figure drift check passed: ${files.length} figures.`);
