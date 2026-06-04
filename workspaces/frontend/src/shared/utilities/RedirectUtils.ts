import {
  OptionsImageConfigValue,
  OptionsPodConfigValue,
  WorkspacesRedirectStep,
  WorkspacesRedirectMessageLevel,
  OptionsRedirectMessageLevel,
} from '~/generated/data-contracts';

export type OptionValue = OptionsImageConfigValue | OptionsPodConfigValue;

export const getMessageLevelColor = (
  level?: WorkspacesRedirectMessageLevel,
): 'blue' | 'orange' | 'red' => {
  switch (level) {
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelInfo:
      return 'blue';
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning:
      return 'orange';
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelDanger:
      return 'red';
    default:
      return 'blue';
  }
};

export const getMessageLevelText = (level?: WorkspacesRedirectMessageLevel): string => {
  switch (level) {
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelInfo:
      return 'Info';
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning:
      return 'Warning';
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelDanger:
      return 'Danger';
    default:
      return 'Info';
  }
};

export const transformRedirectMessageLevel = (
  level?: OptionsRedirectMessageLevel,
): WorkspacesRedirectMessageLevel => {
  switch (level) {
    case OptionsRedirectMessageLevel.RedirectMessageLevelInfo:
      return WorkspacesRedirectMessageLevel.RedirectMessageLevelInfo;
    case OptionsRedirectMessageLevel.RedirectMessageLevelWarning:
      return WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning;
    case OptionsRedirectMessageLevel.RedirectMessageLevelDanger:
      return WorkspacesRedirectMessageLevel.RedirectMessageLevelDanger;
    default:
      return WorkspacesRedirectMessageLevel.RedirectMessageLevelInfo;
  }
};

export const transformRedirectToChain = (
  option: OptionValue,
  allOptions: OptionValue[],
): WorkspacesRedirectStep[] | undefined => {
  if (!option.redirect) {
    return undefined;
  }

  const targetOption = allOptions.find((opt) => opt.id === option.redirect?.to);

  const targetInfo = targetOption
    ? {
        id: targetOption.id,
        displayName: targetOption.displayName,
        description: targetOption.description,
        labels: (targetOption.labels ?? []).map((label) => ({
          key: label.key,
          value: label.value,
        })),
      }
    : {
        id: option.redirect.to,
        displayName: `${option.redirect.to} (not found)`,
        description: '',
        labels: [],
      };

  const step: WorkspacesRedirectStep = {
    source: {
      id: option.id,
      displayName: option.displayName,
      description: option.description,
      labels: (option.labels ?? []).map((label) => ({ key: label.key, value: label.value })),
    },
    target: targetInfo,
  };

  if (option.redirect.message) {
    step.message = {
      level: transformRedirectMessageLevel(option.redirect.message.level),
      text: option.redirect.message.text,
    };
  }

  return [step];
};
