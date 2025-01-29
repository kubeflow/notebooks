import { WorkspaceKind } from '~/shared/types';

type KindLogoDict = Record<string, string>;

/**
 * Builds a dictionary of kind names to logos, and returns it.
 * @param {WorkspaceKind[]} workspaceKinds - The list of workspace kinds.
 * @returns {KindLogoDict} A dictionary with kind names as keys and logo URLs as values.
 */
export function buildKindLogoDictionary(workspaceKinds: WorkspaceKind[] | []): KindLogoDict {
  const kindLogoDict: KindLogoDict = {};

  for (const workspaceKind of workspaceKinds) {
    try {
      kindLogoDict[workspaceKind.name] = workspaceKind.logo.url;
    } catch {
      kindLogoDict[workspaceKind.name] = '';
    }
  }
  return kindLogoDict;
}
