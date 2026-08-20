// Load the built authoring toolkit, with a useful message when it is missing.
//
// The CLIs run against dist/ rather than src/ so they need no TypeScript
// runtime. The cost is that `npm run build` has to have run — and "Cannot find
// module '../dist/authoring.mjs'" is an unhelpful way to learn that.

export async function loadAuthoring() {
  try {
    return await import('../dist/authoring.mjs');
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') {
      console.error('error: dist/authoring.mjs is missing. Run `npm run build` first.');
      process.exit(2);
    }
    throw error;
  }
}
