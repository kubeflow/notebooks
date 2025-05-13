import { Workspace } from '~/shared/api/backendApiTypes';

export const formatRam = (valueInKb: number): string => {
  const units = ['KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let value = valueInKb;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(2)} ${units[index]}`;
};

// Helper function to format UNIX timestamps
export const formatTimestamp = (timestamp: number): string =>
  timestamp && timestamp > 0 ? new Date(timestamp * 1000).toLocaleString() : '-';

export const extractCpuValue = (workspace: Workspace): string =>
  workspace.podTemplate.options.podConfig.current.labels.find((label) => label.key === 'cpu')
    ?.value || 'N/A';

export const extractMemoryValue = (workspace: Workspace): string =>
  workspace.podTemplate.options.podConfig.current.labels.find((label) => label.key === 'memory')
    ?.value || 'N/A';
