import {
  WorkspacesOptionLabel,
  WorkspacesWorkspaceListItem,
  V1Beta1WorkspaceState,
} from '~/generated/data-contracts';
import {
  CPU_UNITS,
  MEMORY_UNITS_FOR_PARSING,
  OTHER,
  STORAGE_UNITS_FOR_SELECTION,
  splitValueUnit,
} from '~/shared/utilities/valueUnits';

export type ResourceType = 'cpu' | 'memory' | 'storage' | 'gpu';

export enum YesNoValue {
  Yes = 'Yes',
  No = 'No',
}

const RESOURCE_UNIT_CONFIG = {
  cpu: CPU_UNITS,
  memory: MEMORY_UNITS_FOR_PARSING,
  storage: STORAGE_UNITS_FOR_SELECTION,
  gpu: OTHER,
};

export const parseResourceValue = (
  value: string,
  resourceType: ResourceType,
): [number | undefined, { name: string; unit: string } | undefined] => {
  const units = RESOURCE_UNIT_CONFIG[resourceType];
  return splitValueUnit(value, units);
};

export const extractResourceValue = (
  workspace: WorkspacesWorkspaceListItem,
  resourceType: ResourceType,
): string | undefined =>
  workspace.podTemplate.options.podConfig.current.labels.find((label) => label.key === resourceType)
    ?.value;

export const formatResourceValue = (v: string | undefined, resourceType?: ResourceType): string => {
  if (v === undefined) {
    return '-';
  }

  if (!resourceType) {
    return v;
  }

  const [value, unit] = parseResourceValue(v, resourceType);
  return `${value || ''} ${unit?.name || ''}`.trim();
};

export const formatResourceFromWorkspace = (
  workspace: WorkspacesWorkspaceListItem,
  resourceType: ResourceType,
): string => formatResourceValue(extractResourceValue(workspace, resourceType), resourceType);

export const formatWorkspaceIdleState = (workspace: WorkspacesWorkspaceListItem): string =>
  workspace.state !== V1Beta1WorkspaceState.WorkspaceStateRunning ? YesNoValue.Yes : YesNoValue.No;

export type LabelColor = 'green' | 'orange' | 'purple' | 'red' | 'grey' | 'yellow';

export const WORKSPACE_STATE_COLORS: Record<V1Beta1WorkspaceState, LabelColor> = {
  [V1Beta1WorkspaceState.WorkspaceStateRunning]: 'green',
  [V1Beta1WorkspaceState.WorkspaceStatePending]: 'orange',
  [V1Beta1WorkspaceState.WorkspaceStateTerminating]: 'yellow',
  [V1Beta1WorkspaceState.WorkspaceStateError]: 'red',
  [V1Beta1WorkspaceState.WorkspaceStatePaused]: 'purple',
  [V1Beta1WorkspaceState.WorkspaceStateUnknown]: 'grey',
};

export const extractWorkspaceStateColor = (state: V1Beta1WorkspaceState): LabelColor =>
  WORKSPACE_STATE_COLORS[state];

export const isWorkspaceWithGpu = (workspace: WorkspacesWorkspaceListItem): boolean =>
  workspace.podTemplate.options.podConfig.current.labels.some((label) => label.key === 'gpu');

export const isWorkspaceIdle = (workspace: WorkspacesWorkspaceListItem): boolean =>
  workspace.state !== V1Beta1WorkspaceState.WorkspaceStateRunning;

export const filterWorkspacesWithGpu = (
  workspaces: WorkspacesWorkspaceListItem[],
): WorkspacesWorkspaceListItem[] => workspaces.filter(isWorkspaceWithGpu);

export const filterIdleWorkspaces = (
  workspaces: WorkspacesWorkspaceListItem[],
): WorkspacesWorkspaceListItem[] => workspaces.filter(isWorkspaceIdle);

export const filterRunningWorkspaces = (
  workspaces: WorkspacesWorkspaceListItem[],
): WorkspacesWorkspaceListItem[] =>
  workspaces.filter((workspace) => workspace.state === V1Beta1WorkspaceState.WorkspaceStateRunning);

export const filterIdleWorkspacesWithGpu = (
  workspaces: WorkspacesWorkspaceListItem[],
): WorkspacesWorkspaceListItem[] => filterIdleWorkspaces(filterWorkspacesWithGpu(workspaces));

export type WorkspaceGpuCountRecord = {
  workspaces: WorkspacesWorkspaceListItem[];
  gpuCount: number;
};

export const groupWorkspacesByNamespaceAndGpu = (
  workspaces: WorkspacesWorkspaceListItem[],
  order: 'ASC' | 'DESC' = 'DESC',
): Record<string, WorkspaceGpuCountRecord> => {
  const grouped: Record<string, WorkspaceGpuCountRecord> = {};

  for (const workspace of workspaces) {
    const [gpuValueRaw] = splitValueUnit(extractResourceValue(workspace, 'gpu') || '0', OTHER);
    const gpuValue = Number(gpuValueRaw) || 0;

    grouped[workspace.namespace] ??= { gpuCount: 0, workspaces: [] };
    grouped[workspace.namespace].gpuCount += gpuValue;
    grouped[workspace.namespace].workspaces.push(workspace);
  }

  return Object.fromEntries(
    Object.entries(grouped).sort(([, a], [, b]) =>
      order === 'ASC' ? a.gpuCount - b.gpuCount : b.gpuCount - a.gpuCount,
    ),
  );
};

export const countGpusFromWorkspaces = (workspaces: WorkspacesWorkspaceListItem[]): number =>
  workspaces.reduce((total, workspace) => {
    const [gpuValue] = splitValueUnit(extractResourceValue(workspace, 'gpu') || '0', OTHER);
    return total + (gpuValue ?? 0);
  }, 0);

// For now, label keys will be showed as they are in the backend.
export const formatLabelKey = (key: string): string => key;

// Check if a label represents version/package information
export const isPackageLabel = (key: string): boolean => key.endsWith('Version');

// Extract package labels from workspace image config
export const extractPackageLabels = (
  workspace: WorkspacesWorkspaceListItem,
): WorkspacesOptionLabel[] =>
  workspace.podTemplate.options.imageConfig.current.labels.filter((label) =>
    isPackageLabel(label.key),
  );
