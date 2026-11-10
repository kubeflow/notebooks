import yaml from 'js-yaml';
import {
  getDraftRedirectError,
  validateOptionRedirects,
  validateRedirects,
  validateYamlRedirects,
} from '~/app/pages/WorkspaceKinds/Form/redirectValidation';

const values = [
  { id: 'A', redirect: { to: 'B' } },
  { id: 'B', redirect: { to: 'C' } },
  { id: 'C' },
];

describe.each(['imageConfig', 'podConfig'] as const)('%s redirect validation', (optionType) => {
  it('accepts a valid chain and newly added targets', () => {
    expect(validateOptionRedirects({ values, optionType })).toEqual([]);
    expect(
      validateOptionRedirects({ values: values.slice(0, 2), optionType })[0].message,
    ).toContain('"C" does not exist');
  });
  it.each(['rename', 'delete'])(
    'reports affected sources after target %s and clears after removal',
    (action) => {
      const changed =
        action === 'rename' ? [...values.slice(0, 2), { id: 'D' }] : values.slice(0, 2);
      expect(validateOptionRedirects({ values: changed, optionType })).toEqual([
        expect.objectContaining({
          sourceId: 'B',
          index: 1,
          message: expect.stringContaining('"C" does not exist'),
        }),
      ]);
      expect(validateOptionRedirects({ values: [values[0], { id: 'B' }], optionType })).toEqual([]);
    },
  );
  it.each([
    ['A', 'A'],
    ['B', 'A', 'B'],
    ['C', 'A', 'B', 'C'],
  ])('blocks a cycle starting at %s', (...cycle) => {
    const draft = { id: cycle[0], redirect: { to: 'A' } };
    const index = values.findIndex((option) => option.id === draft.id);
    expect(getDraftRedirectError({ values, draft, editIndex: index, optionType })).toContain(
      cycle.join(' → '),
    );
  });
  it('does not prevent repairing one option when another cycle remains', () => {
    const invalid = [
      { id: 'A', redirect: { to: 'A' } },
      { id: 'B', redirect: { to: 'B' } },
    ];
    expect(
      getDraftRedirectError({ values: invalid, draft: { id: 'A' }, editIndex: 0, optionType }),
    ).toBeUndefined();
  });
  it('uses the new ID and redirects when validating a modal draft', () => {
    expect(
      getDraftRedirectError({
        values,
        draft: { id: 'D', redirect: { to: 'C' } },
        editIndex: 2,
        optionType,
      }),
    ).toContain('"C" does not exist');
    expect(
      getDraftRedirectError({
        values,
        draft: { id: 'D', redirect: { to: 'D' } },
        editIndex: null,
        optionType,
      }),
    ).toContain('D → D');
  });
});

it('does not resolve image targets against pod IDs', () => {
  expect(
    validateRedirects({
      imageConfig: { values: [values[0]] },
      podConfig: { values: [{ id: 'B' }] },
    }),
  ).toHaveLength(1);
});

it.each([false, true])('validates YAML option graphs (create=%s)', (isCreate) => {
  const spec = {
    podTemplate: {
      options: {
        imageConfig: { values: [{ id: 'A', redirect: { to: 'A' } }] },
        podConfig: { values: [] },
      },
    },
  };
  const value = yaml.dump(isCreate ? { spec } : spec);
  expect(validateYamlRedirects({ value, isCreate }).errors[0].cycle).toEqual(['A', 'A']);
});

it.each([
  '[',
  'podTemplate: {}',
  'podTemplate: { options: { imageConfig: { values: [null] }, podConfig: { values: [] } } }',
])('rejects malformed YAML options: %s', (value) => {
  expect(validateYamlRedirects({ value, isCreate: false }).parseError).toBeDefined();
});
