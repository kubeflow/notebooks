import { WorkspacesWorkspaceListItem, V1Beta1WorkspaceState } from '~/generated/data-contracts';

export type CullingWarningLevel = 'warning' | 'critical' | null;

export const WARNING_THRESHOLD_MS = 15 * 60 * 1000;
export const CRITICAL_THRESHOLD_MS = 5 * 60 * 1000;

export function getMsUntilCull(workspace: WorkspacesWorkspaceListItem): number | null {
  if (workspace.state !== V1Beta1WorkspaceState.WorkspaceStateRunning) {
    return null;
  }
  const maxInactiveMs = (workspace.workspaceKind.cullingConfig?.maxInactiveSeconds ?? 0) * 1000;
  if (!maxInactiveMs) {
    return null;
  }
  // NOTE: activity.lastActivity is in milliseconds (consistent with the rest of the frontend,
  // e.g. the "Last activity" column passes it directly to `new Date()`).
  const lastActivityMs = workspace.activity.lastActivity;
  return maxInactiveMs - (Date.now() - lastActivityMs);
}

export function getCullingWarningLevel(
  workspace: WorkspacesWorkspaceListItem,
): CullingWarningLevel {
  const msUntilCull = getMsUntilCull(workspace);
  if (msUntilCull === null) {
    return null;
  }
  if (msUntilCull <= CRITICAL_THRESHOLD_MS) {
    return 'critical';
  }
  if (msUntilCull <= WARNING_THRESHOLD_MS) {
    return 'warning';
  }
  return null;
}

export function formatTimeUntilCull(workspace: WorkspacesWorkspaceListItem): string {
  const msUntilCull = getMsUntilCull(workspace);
  if (msUntilCull === null) {
    return '';
  }
  const minutes = Math.ceil(Math.max(0, msUntilCull) / 60_000);
  return `${minutes} min`;
}
