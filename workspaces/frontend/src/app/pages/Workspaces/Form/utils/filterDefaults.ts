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
