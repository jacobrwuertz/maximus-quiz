#!/usr/bin/env node
// Build gate: every quiz definition in the repo must produce markup that
// round-trips cleanly.
//
//   node scripts/check-definitions.mjs [--dir examples]
//
// For each definition file it runs the whole chain the Webflow build depends
// on — validate → generate → parse → verify → lint — and fails on anything that
// would surface later as a silently broken published page. This is the cheap
// half of the gate: it catches a bad definition BEFORE anyone builds it in
// Webflow. The other half (`verify-quiz.mjs --url`) checks what actually
// published, which no local check can substitute for.
//
// Wired into `npm run check`, so it runs with the tests.

import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import { loadAuthoring } from './_authoring.mjs';
const { generateWebflowQuiz, validateDefinition, verifyQuizMarkup } = await loadAuthoring();

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const name = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[name] = next;
      i += 1;
    } else {
      args[name] = true;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const dir = args.dir ?? 'examples';

let entries;
try {
  entries = (await readdir(dir)).filter((f) => extname(f) === '.json').sort();
} catch {
  console.error(`error: cannot read definition directory "${dir}"`);
  process.exit(2);
}

if (entries.length === 0) {
  console.log(`no quiz definitions in ${dir}/ — nothing to check`);
  process.exit(0);
}

// One DOM for every definition; each gets its own container element.
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;

let failed = 0;

for (const file of entries) {
  const path = join(dir, file);
  let definition;

  try {
    definition = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    console.error(`✗ ${path}\n    not valid JSON: ${error.message}`);
    failed += 1;
    continue;
  }

  const problems = [];

  // 1. The definition itself — duplicate keys, dangling show-if, thin questions.
  for (const warning of validateDefinition(definition)) {
    problems.push(`definition: ${warning}`);
  }

  // 2. Generate, then read the markup back exactly as a published page would be
  //    read. A generator bug shows up here rather than in Webflow.
  const { html, classes } = generateWebflowQuiz(definition);
  const container = dom.window.document.createElement('div');
  container.innerHTML = html;
  dom.window.document.body.replaceChildren(container);

  const root = container.querySelector('[data-quiz]');
  const report = verifyQuizMarkup(root, definition, classes);

  for (const problem of report.problems) {
    problems.push(`round-trip: [${problem.kind}] ${problem.detail}`);
  }
  for (const finding of report.lint?.findings ?? []) {
    if (finding.severity === 'error') problems.push(`lint: ${finding.message}`);
  }

  if (problems.length > 0) {
    failed += 1;
    console.error(`✗ ${path}`);
    for (const problem of problems) console.error(`    ${problem}`);
  } else {
    const { steps, questions, answers } = report.counts;
    console.log(
      `✓ ${path} — ${steps} steps, ${questions} questions, ${answers} answers, ${classes.length} classes`,
    );
  }
}

console.log('');
console.log(
  failed === 0
    ? `all ${entries.length} definition(s) round-trip cleanly`
    : `${failed} of ${entries.length} definition(s) failed`,
);

process.exit(failed === 0 ? 0 : 1);
