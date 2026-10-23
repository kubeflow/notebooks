import { getActivityProbeDependencyError } from '~/app/pages/WorkspaceKinds/Form/podTemplate/activityProbeValidation';

const pauseRule = { config: { secondsSinceActive: 3600 }, effect: { pauseWorkspace: true } };
const probe = { podExec: { script: '#!/bin/sh\nexit 0' } };

describe('activity probe dependency validation', () => {
  it.each([
    undefined,
    null,
    '',
    {},
    { activityRules: [] },
    { activityRules: [{ effect: { pauseWorkspace: false } }] },
  ])('does not require a probe when no pause rule exists: %p', (config) =>
    expect(getActivityProbeDependencyError(config)).toBeNull(),
  );

  it.each([undefined, null])(
    'requires a probe for pause rules when probe is %p',
    (activityProbe) => {
      expect(
        getActivityProbeDependencyError({
          activityRules: [pauseRule],
          podTemplate: { activityProbe },
        }),
      ).toContain('require an enabled Activity Probe');
    },
  );

  it('accepts a pause rule when a probe is configured', () => {
    expect(
      getActivityProbeDependencyError({
        activityRules: [pauseRule],
        podTemplate: { activityProbe: probe },
      }),
    ).toBeNull();
  });

  it('requires a probe if any rule pauses, regardless of rule order', () => {
    expect(
      getActivityProbeDependencyError({
        activityRules: [{ effect: { pauseWorkspace: false } }, pauseRule],
      }),
    ).not.toBeNull();
  });

  it('clears the error when the last pause effect is removed', () => {
    expect(
      getActivityProbeDependencyError({
        activityRules: [{ ...pauseRule, effect: { pauseWorkspace: false } }],
      }),
    ).toBeNull();
  });
});
