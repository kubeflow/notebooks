import {
  OptionsImageConfigValue,
  OptionsPodConfigValue,
  OptionsRedirectMessageLevel,
  WorkspacesRedirectMessageLevel,
  WorkspacesRedirectStep,
} from '~/generated/data-contracts';

export type OptionValue = OptionsImageConfigValue | OptionsPodConfigValue;

export interface RedirectChainResult {
  chain: WorkspacesRedirectStep[];
  finalTarget: OptionValue | undefined;
  cycleDetected: boolean;
}

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

const toOptionInfo = (option: OptionValue) => ({
  id: option.id,
  displayName: option.displayName,
  description: option.description,
  labels: (option.labels ?? []).map((label) => ({ key: label.key, value: label.value })),
});

const toNotFoundInfo = (id: string) => ({
  id,
  displayName: `${id} (not found)`,
  description: '',
  labels: [],
});

export const resolveRedirectChain = (
  option: OptionValue,
  allOptions: OptionValue[],
): RedirectChainResult => {
  if (!option.redirect) {
    return { chain: [], finalTarget: undefined, cycleDetected: false };
  }

  const optionsMap = new Map(allOptions.map((opt) => [opt.id, opt]));
  const visited = new Set<string>([option.id]);
  const chain: WorkspacesRedirectStep[] = [];
  let current = option;
  let cycleDetected = false;

  while (current.redirect) {
    const targetId = current.redirect.to;

    if (visited.has(targetId)) {
      cycleDetected = true;
      break;
    }
    visited.add(targetId);

    const targetOption = optionsMap.get(targetId);

    const step: WorkspacesRedirectStep = {
      source: toOptionInfo(current),
      target: targetOption ? toOptionInfo(targetOption) : toNotFoundInfo(targetId),
    };

    if (current.redirect.message) {
      step.message = {
        level: transformRedirectMessageLevel(current.redirect.message.level),
        text: current.redirect.message.text,
      };
    }

    chain.push(step);

    if (!targetOption) {
      break;
    }

    current = targetOption;
  }

  if (chain.length === 0) {
    return { chain, finalTarget: undefined, cycleDetected };
  }

  const finalTarget = cycleDetected ? undefined : optionsMap.get(chain[chain.length - 1].target.id);

  return { chain, finalTarget, cycleDetected };
};
