import { Workspace, WorkspaceState } from '~/shared/api/backendApiTypes';
import {
  CPU_UNITS,
  MEMORY_UNITS_FOR_PARSING,
  OTHER,
  splitValueUnit,
} from '~/shared/utilities/valueUnits';

// Helper function to format UNIX timestamps
export const formatTimestamp = (timestamp: number): string =>
  timestamp && timestamp > 0 ? new Date(timestamp * 1000).toLocaleString() : '-';

export type ResourceType = 'cpu' | 'memory' | 'gpu';

export const extractResourceValue = (
  workspace: Workspace,
  resourceType: ResourceType,
): string | undefined =>
  workspace.podTemplate.options.podConfig.current.labels.find((label) => label.key === resourceType)
    ?.value;

export const formatResourceValue = (
  v: string | number | undefined,
  resourceType?: ResourceType,
): string | number => {
  if (v === undefined) {
    return '-';
  }
  const valueStr = typeof v === 'number' ? v.toString() : v;
  switch (resourceType) {
    case 'cpu': {
      const [cpuValue, cpuUnit] = splitValueUnit(valueStr, CPU_UNITS);
      return `${cpuValue ?? ''} ${cpuUnit.name}`;
    }
    case 'memory': {
      const [memoryValue, memoryUnit] = splitValueUnit(valueStr, MEMORY_UNITS_FOR_PARSING);
      return `${memoryValue ?? ''} ${memoryUnit.name}`;
    }
    default:
      return v;
  }
};

export const formatResourceFromWorkspace = (
  workspace: Workspace,
  resourceType: ResourceType,
): string | number =>
  formatResourceValue(extractResourceValue(workspace, resourceType), resourceType);

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
