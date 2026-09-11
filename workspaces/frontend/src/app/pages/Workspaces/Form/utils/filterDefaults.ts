type OptionWithHiddenAndRedirect = {
  id: string;
  hidden: boolean;
  redirect?: unknown;
};

export const computeDefaultFilterValues = <T extends OptionWithHiddenAndRedirect>(
  options: T[],
  defaultId?: string,
): { showHidden: boolean; showRedirected: boolean } => {
  if (!defaultId) {
    return { showHidden: false, showRedirected: false };
  }

  const defaultOption = options.find((opt) => opt.id === defaultId);

  if (!defaultOption) {
    return { showHidden: false, showRedirected: false };
  }

  return {
    showHidden: defaultOption.hidden,
    showRedirected: defaultOption.redirect !== undefined,
  };
};

type OptionWithHidden = {
  id: string;
  hidden: boolean;
};

/**
 * Resolves whether the configured default remains valid in the current context.
 *
 * Preserves defaults that are already hidden in the unfiltered configuration,
 * but rejects defaults that become hidden or are removed by contextual filtering.
 */
export const resolveContextualDefaultId = <T extends OptionWithHidden>(
  allOptions: T[],
  contextualOptions: T[],
  defaultId?: string,
): string | undefined => {
  if (!defaultId) {
    return undefined;
  }

  const configuredDefault = allOptions.find((option) => option.id === defaultId);
  const contextualDefault = contextualOptions.find((option) => option.id === defaultId);

  if (!configuredDefault || !contextualDefault) {
    return undefined;
  }

  // It was visible in the unfiltered configuration, but became hidden in the current context.
  if (!configuredDefault.hidden && contextualDefault.hidden) {
    return undefined;
  }

  return defaultId;
};
