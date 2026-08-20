#!/usr/bin/env node
// Generate a Webflow-ready quiz from a definition file.
//
//   node scripts/generate-quiz.mjs --def ./quizzes/finder.json --out ./build/
//
// Emits three things:
//   <id>.html      the single HTML block to insert with data_whtml_builder
//   <id>.classes   the class names to create as styles FIRST
//   <id>.built.json  the definition plus the recorded class list, for verify
//
// Insert the HTML in ONE call. Never re-apply the data-quiz-* attributes
// afterwards element by element — that is the path that drops them.
//
// Requires a build first (`npm run build`), which emits dist/authoring.mjs.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generateWebflowQuiz } from '../dist/authoring.mjs';

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
if (!args.def) {
  console.error(
    [
      'Usage: node scripts/generate-quiz.mjs --def <file.json> [--out <dir>] [--strict]',
      '',
      '  --def    <path>  Quiz definition JSON (required)',
      '  --out    <dir>   Output directory. Defaults to printing the HTML to stdout.',
      '  --strict         Exit 1 if the definition produced any warnings.',
    ].join('\n'),
  );
  process.exit(2);
}

const definition = JSON.parse(await readFile(args.def, 'utf8'));
const { html, classes, warnings } = generateWebflowQuiz(definition);

for (const warning of warnings) console.error(`warning: ${warning}`);

if (!args.out) {
  console.log(html);
} else {
  await mkdir(args.out, { recursive: true });
  const base = definition.id;

  await writeFile(join(args.out, `${base}.html`), `${html}\n`, 'utf8');
  await writeFile(join(args.out, `${base}.classes`), `${classes.join('\n')}\n`, 'utf8');
  // Record the classes alongside the definition so verify can check for the
  // ones Webflow silently drops.
  await writeFile(
    join(args.out, `${base}.built.json`),
    `${JSON.stringify({ ...definition, classes }, null, 2)}\n`,
    'utf8',
  );

  console.error(`wrote ${base}.html (${classes.length} classes) to ${args.out}`);
  console.error('');
  console.error('Next: create these styles in Webflow BEFORE inserting the HTML —');
  console.error('Webflow drops class names that have no matching style.');
  for (const name of classes) console.error(`  ${name}`);
}

if (args.strict && warnings.length > 0) process.exit(1);
