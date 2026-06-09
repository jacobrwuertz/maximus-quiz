// Build script — emits two JS bundles + the theme CSS.
//  - ESM module  (dist/maximus-quiz.mjs)      → for bundler/Next.js consumers
//  - IIFE bundle (dist/maximus-quiz.iife.js)  → drop-in <script> for Unbounce / Sanity / any CMS
// Zero runtime dependencies; nothing is marked external.
import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';

const shared = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  sourcemap: true,
  target: ['es2019'], // wide browser support for embeds
  logLevel: 'info',
};

mkdirSync('dist', { recursive: true });

await Promise.all([
  build({ ...shared, format: 'esm', outfile: 'dist/maximus-quiz.mjs' }),
  build({
    ...shared,
    format: 'iife',
    globalName: 'MaximusQuiz',
    outfile: 'dist/maximus-quiz.iife.js',
  }),
]);

// Ship the brand theme alongside the bundles.
cpSync('src/theme/maximus.css', 'dist/maximus-quiz.css');

console.log('Build complete: dist/maximus-quiz.mjs, dist/maximus-quiz.iife.js, dist/maximus-quiz.css');
