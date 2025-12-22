import { LabelColor } from '~/shared/utilities/WorkspaceUtils';

export type WorkspaceKindStatus = 'Active' | 'Deprecated';

export const WORKSPACE_KIND_STATUS_COLORS: Record<WorkspaceKindStatus, LabelColor> = {
  Active: 'green',
  Deprecated: 'red',
};

export const extractWorkspaceKindStatusColor = (status: WorkspaceKindStatus): LabelColor =>
  WORKSPACE_KIND_STATUS_COLORS[status];
