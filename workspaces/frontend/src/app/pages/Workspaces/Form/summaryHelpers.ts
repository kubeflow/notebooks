import { WorkspacekindsOptionLabel } from '~/generated/data-contracts';

/**
 * Converts labels to a consistent key-value object format
 */
export const normalizeLabels = (
  labelData: WorkspacekindsOptionLabel[] | Record<string, string> | undefined,
): Record<string, string> | undefined => {
  if (!labelData) {
    return undefined;
  }
  if (Array.isArray(labelData)) {
    return labelData.reduce(
      (acc, label) => {
        acc[label.key] = label.value;
        return acc;
      },
      {} as Record<string, string>,
    );
  }
  return labelData;
};
