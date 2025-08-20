import { Workspace, WorkspaceState, WorkspaceOptionLabel } from '~/shared/api/backendApiTypes';
import {
  CPU_UNITS,
  MEMORY_UNITS_FOR_PARSING,
  OTHER,
  splitValueUnit,
} from '~/shared/utilities/valueUnits';

export type ResourceType = 'cpu' | 'memory' | 'gpu';

export enum YesNoValue {
  Yes = 'Yes',
  No = 'No',
}

const RESOURCE_UNIT_CONFIG = {
  cpu: CPU_UNITS,
  memory: MEMORY_UNITS_FOR_PARSING,
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
  workspace: Workspace,
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
  workspace: Workspace,
  resourceType: ResourceType,
): string => formatResourceValue(extractResourceValue(workspace, resourceType), resourceType);

export const formatWorkspaceIdleState = (workspace: Workspace): string =>
  workspace.state !== WorkspaceState.WorkspaceStateRunning ? YesNoValue.Yes : YesNoValue.No;

export const isWorkspaceWithGpu = (workspace: Workspace): boolean =>
  workspace.podTemplate.options.podConfig.current.labels.some((label) => label.key === 'gpu');

export const isWorkspaceIdle = (workspace: Workspace): boolean =>
  workspace.state !== WorkspaceState.WorkspaceStateRunning;

export const filterWorkspacesWithGpu = (workspaces: Workspace[]): Workspace[] =>
  workspaces.filter(isWorkspaceWithGpu);

export const filterIdleWorkspaces = (workspaces: Workspace[]): Workspace[] =>
  workspaces.filter(isWorkspaceIdle);

export const filterRunningWorkspaces = (workspaces: Workspace[]): Workspace[] =>
  workspaces.filter((workspace) => workspace.state === WorkspaceState.WorkspaceStateRunning);

export const filterIdleWorkspacesWithGpu = (workspaces: Workspace[]): Workspace[] =>
  filterIdleWorkspaces(filterWorkspacesWithGpu(workspaces));

export type WorkspaceGpuCountRecord = { workspaces: Workspace[]; gpuCount: number };

export const groupWorkspacesByNamespaceAndGpu = (
  workspaces: Workspace[],
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

export const countGpusFromWorkspaces = (workspaces: Workspace[]): number =>
  workspaces.reduce((total, workspace) => {
    const [gpuValue] = splitValueUnit(extractResourceValue(workspace, 'gpu') || '0', OTHER);
    return total + (gpuValue ?? 0);
  }, 0);

// Helper function to format label keys into human-readable names
export const formatLabelKey = (key: string): string => {
  // Handle camelCase version labels (e.g., pythonVersion -> Python)
  if (key.endsWith('Version')) {
    const baseName = key.slice(0, -7); // Remove 'Version' suffix
    return baseName.charAt(0).toUpperCase() + baseName.slice(1);
  }

  // Handle standard infrastructure resource types
  if (key === 'cpu' || key === 'gpu') {
    return key.toLocaleUpperCase();
  }

  // Otherwise just capitalize the first letter
  return key.charAt(0).toUpperCase() + key.slice(1);
};

// Check if a label represents version/package information
export const isPackageLabel = (key: string): boolean => key.endsWith('Version');

// Extract package labels from workspace image config
export const extractPackageLabels = (workspace: Workspace): WorkspaceOptionLabel[] =>
  workspace.podTemplate.options.imageConfig.current.labels.filter((label) =>
    isPackageLabel(label.key),
  );
