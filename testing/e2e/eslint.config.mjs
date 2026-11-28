// @ts-check
// Beyond the recommended sets, rules here only guard against real bugs (silent breakage,
// brittle selectors, shared names). Each has a sanctioned escape for unusual cases:
//   // eslint-disable-next-line no-restricted-syntax -- <why this case is different>
import js from '@eslint/js';
import pluginCypress from 'eslint-plugin-cypress';
import tseslint from 'typescript-eslint';

const DESCRIBE =
  ':matches(CallExpression[callee.name=/^(describe|context)$/], CallExpression[callee.object.name=/^(describe|context)$/])';
const DESCRIBE_BODY = `${DESCRIBE} > :function > BlockStatement`;
const ONCE_PER_TEST =
  'CallExpression:matches([callee.name="uniqueName"], [callee.property.name=/^(create|createFromSample|track)$/])';
const FILESYSTEM_IMPORT_MESSAGE = 'Browser code: use a cy.task() (Tier 4) for filesystem access.';

export default tseslint.config(
  { ignores: ['node_modules/', 'cypress/videos/', 'cypress/screenshots/', 'cypress/downloads/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['cypress/**/*.ts'],
    ...pluginCypress.configs.recommended,
  },
  {
    // Browser bundle (everything except the Node-side plugin): Node APIs don't exist there,
    // and Cypress shims `process.env` to `{}`, so code "works" but silently ignores overrides.
    files: ['cypress/**/*.ts'],
    ignores: ['cypress/support/plugin/**'],
    rules: {
      // The TypeScript variant, so `import type` from @kubernetes/client-node is allowed (erased at build).
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'fs',
              message: FILESYSTEM_IMPORT_MESSAGE,
            },
            {
              name: 'path',
              message: FILESYSTEM_IMPORT_MESSAGE,
            },
            {
              name: '@kubernetes/client-node',
              allowTypeImports: true,
              message:
                'Browser code: use cy.k8s* commands or a model instead (`import type` is fine).',
            },
          ],
          patterns: [
            {
              group: ['**/plugin', '**/plugin/**'],
              message:
                'support/plugin/ runs in Node only. Use its tasks via cy.task()/cy.k8s* commands, ' +
                'or move shared, context-agnostic code to support/shared/.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message: 'Browser code: read configuration from `environment` instead.',
        },
      ],
    },
  },
  {
    files: ['cypress/tests/**/*.ts', 'cypress/pages/**/*.ts', 'cypress/models/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `${DESCRIBE_BODY} > VariableDeclaration > VariableDeclarator > ${ONCE_PER_TEST}`,
          message:
            'Runs once per spec file, so every test and retry would share the same object/name. ' +
            'Call it inside it() or a hook.',
        },
        {
          selector: `${DESCRIBE_BODY} > ExpressionStatement > ${ONCE_PER_TEST}`,
          message: 'Runs once per spec file, outside any test. Call it inside it() or a hook.',
        },
        {
          selector: 'Literal[value=/pf-v\\d/], TemplateElement[value.raw=/pf-v\\d/]',
          message:
            'PatternFly class names change between major versions. Use a data-testid ' +
            '(add one to the frontend if missing) or a role/label query.',
        },
        {
          selector:
            'CallExpression[callee.property.name=/^(get|find)$/] > Literal[value=/^#/], ' +
            'CallExpression[callee.property.name=/^(get|find)$/] > TemplateLiteral > TemplateElement[value.raw=/^#/]',
          message:
            'Element ids are often generated or reused. Use a data-testid or a role/label query.',
        },
      ],
    },
  },
);
