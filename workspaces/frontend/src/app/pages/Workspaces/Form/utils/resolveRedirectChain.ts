import { traceRedirects } from '~/app/utils/redirectGraph';
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
  // The selected option can contain an unsaved redirect.
  optionsMap.set(option.id, option);
  const trace = traceRedirects({ startId: option.id, options: optionsMap });
  const cycleDetected = Boolean(trace.cycle);
  const chain: WorkspacesRedirectStep[] = trace.edges.map(({ sourceId, targetId }) => {
    const source = optionsMap.get(sourceId)!;
    const target = optionsMap.get(targetId);
    return {
      source: toOptionInfo(source),
      target: target ? toOptionInfo(target) : toNotFoundInfo(targetId),
      ...(source.redirect?.message && {
        message: {
          level: transformRedirectMessageLevel(source.redirect.message.level),
          text: source.redirect.message.text,
        },
      }),
    };
  });

  if (chain.length === 0) {
    return { chain, finalTarget: undefined, cycleDetected };
  }

  const finalTarget = cycleDetected ? undefined : optionsMap.get(chain[chain.length - 1].target.id);

  return { chain, finalTarget, cycleDetected };
};
