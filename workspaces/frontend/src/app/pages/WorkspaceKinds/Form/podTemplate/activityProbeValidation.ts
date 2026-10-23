export const getActivityProbeDependencyError = (config: unknown): string | null => {
  if (!config || typeof config !== 'object' || !('activityRules' in config)) {
    return null;
  }
  const hasPauseRule =
    Array.isArray(config.activityRules) &&
    config.activityRules.some(
      (rule: unknown) =>
        rule !== null &&
        typeof rule === 'object' &&
        'effect' in rule &&
        rule.effect !== null &&
        typeof rule.effect === 'object' &&
        'pauseWorkspace' in rule.effect &&
        rule.effect.pauseWorkspace === true,
    );
  if (!hasPauseRule) {
    return null;
  }
  if (
    'podTemplate' in config &&
    config.podTemplate !== null &&
    typeof config.podTemplate === 'object' &&
    'activityProbe' in config.podTemplate &&
    config.podTemplate.activityProbe != null
  ) {
    return null;
  }
  return 'Activity rules that pause workspaces require an enabled Activity Probe. Enable the probe or remove the Pause workspace effect from these rules.';
};
