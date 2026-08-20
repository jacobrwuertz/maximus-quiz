#!/usr/bin/env node
// Verify a published quiz against the definition it was built from.
//
//   node scripts/verify-quiz.mjs --def ./quizzes/finder.json \
//                                --url https://page.maximustribe.com/quiz
//
// Reads the live page, compares every step, question, answer and class against
// the definition, runs the engine's linter over what shipped, and exits 1 on
// any failure — so this works as a build gate, not just a report.
//
// Use `--html <file>` instead of `--url` to check a saved page, and `--json`
// for machine-readable output.
//
// Requires a build first (`npm run build`), which emits dist/authoring.mjs.

import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { formatVerifyReport, verifyQuizMarkup } from '../dist/authoring.mjs';

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

function usage(message) {
  if (message) console.error(`error: ${message}\n`);
  console.error(
    [
      'Usage: node scripts/verify-quiz.mjs --def <file.json> (--url <url> | --html <file>)',
      '',
      '  --def   <path>  Quiz definition JSON the page was generated from (required)',
      '  --url   <url>   Published page to fetch and check',
      '  --html  <path>  Saved HTML file to check instead of fetching',
      '  --json          Emit the report as JSON',
      '',
      'Exits 1 when anything is missing or the linter reports an error.',
    ].join('\n'),
  );
  process.exit(2);
}

const args = parseArgs(process.argv.slice(2));
if (!args.def) usage('--def is required');
if (!args.url && !args.html) usage('one of --url or --html is required');

const definition = JSON.parse(await readFile(args.def, 'utf8'));

let html;
if (args.url) {
  const response = await fetch(args.url);
  if (!response.ok) {
    console.error(`error: fetching ${args.url} returned ${response.status} ${response.statusText}`);
    process.exit(2);
  }
  html = await response.text();
} else {
  html = await readFile(args.html, 'utf8');
}

// The published page never re-runs its scripts here — this reads static markup,
// which is exactly the surface Webflow may have altered.
const dom = new JSDOM(html);
const { document } = dom.window;

// The engine's DOM type guards check against the window that owns the node, so
// hand jsdom's globals to the shared code before it runs.
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;

const root =
  document.querySelector(`[data-quiz="${definition.id}"]`) ?? document.querySelector('[data-quiz]');

// Regenerating is the only way to know which classes SHOULD be present, but the
// definition may already carry a recorded list from the build that shipped.
const expectedClasses = Array.isArray(definition.classes) ? definition.classes : [];

const report = verifyQuizMarkup(root, definition, expectedClasses);

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`source: ${args.url ?? args.html}`);
  console.log(formatVerifyReport(report));
  if (expectedClasses.length === 0) {
    console.log(
      'note: no "classes" array in the definition — the dropped-class check was skipped.',
    );
  }
}

process.exit(report.ok ? 0 : 1);
