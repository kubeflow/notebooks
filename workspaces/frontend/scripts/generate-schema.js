#!/usr/bin/env node

/**
 * Extracts a self-contained JSON Schema for WorkspaceKindUpdate from the
 * backend's Swagger spec. Used by monaco-yaml in the YAML editor for
 * autocompletion and validation.
 *
 * Usage: node scripts/generate-schema.js <swagger.json> <output.json>
 */

const fs = require('fs');

const [swaggerPath, outputPath] = process.argv.slice(2);

if (!swaggerPath || !outputPath) {
  console.error('Usage: node generate-schema.js <swagger.json> <output.json>');
  process.exit(1);
}

const ROOT_DEFINITION = 'workspacekinds.WorkspaceKindUpdate';

const swagger = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));
const definitions = swagger.definitions;

const needed = new Set();

function collect(name) {
  if (needed.has(name)) {
    return;
  }
  needed.add(name);
  const def = definitions[name];
  if (!def) {
    return;
  }
  const refs = [...JSON.stringify(def).matchAll(/"\$ref":\s*"#\/definitions\/([^"]+)"/g)];
  for (const match of refs) {
    collect(match[1]);
  }
}

collect(ROOT_DEFINITION);

const defs = {};
for (const name of needed) {
  const rewritten = JSON.stringify(definitions[name]).replace(/"#\/definitions\//g, '"#/$defs/');
  defs[name] = JSON.parse(rewritten);
}

const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $ref: `#/$defs/${ROOT_DEFINITION}`,
  $defs: defs,
};

fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2) + '\n');
console.log(`Generated ${ROOT_DEFINITION} JSON Schema (${needed.size} definitions)`);
