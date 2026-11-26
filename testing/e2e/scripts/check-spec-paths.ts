// Fails if any file under cypress/tests/ breaks the `tests/<area>/<actor>/<name>.cy.ts`
// convention, which decides who each spec logs in as. Run via `npm run lint`.
import * as fs from 'fs';
import * as path from 'path';
import { parseSpecPath } from '../cypress/support/shared/specPath';

const E2E_ROOT = path.resolve(__dirname, '..');
const TESTS_DIR = path.join(E2E_ROOT, 'cypress', 'tests');

const files = fs
  .readdirSync(TESTS_DIR, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => path.relative(E2E_ROOT, path.join(entry.parentPath, entry.name)));

const errors = files.flatMap((file) => {
  const result = parseSpecPath(file);
  return 'error' in result ? [result.error] : [];
});

if (errors.length > 0) {
  console.error(`Spec path check failed:\n  ${errors.join('\n  ')}\nSee README "Conventions".`);
  process.exit(1);
}
console.log(`Spec path check passed (${files.length} specs).`);
