import { useEffect, useRef } from 'react';
import { useNotification } from 'mod-arch-core';
import { WorkspacesWorkspaceListItem } from '~/generated/data-contracts';
import {
  ActivityWarningLevel,
  getActivityStatus,
  formatTimeRemaining,
} from '~/shared/utilities/WorkspaceUtils';

const workspaceKey = (ws: WorkspacesWorkspaceListItem): string => `${ws.namespace}/${ws.name}`;

const useActivityNotifications = (workspaces: WorkspacesWorkspaceListItem[]): void => {
  const notification = useNotification();
  const prevLevelsRef = useRef<Map<string, ActivityWarningLevel>>(new Map());
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    const currentLevels = new Map<string, ActivityWarningLevel>();

    const statusByKey = new Map<string, ReturnType<typeof getActivityStatus>>();

    for (const ws of workspaces) {
      const status = getActivityStatus(ws);
      const key = workspaceKey(ws);
      statusByKey.set(key, status);
      if (status.warningLevel !== ActivityWarningLevel.None) {
        currentLevels.set(key, status.warningLevel);
      }
    }

    if (!isFirstRenderRef.current) {
      for (const ws of workspaces) {
        const key = workspaceKey(ws);
        const status = statusByKey.get(key)!;
        const currentLevel = currentLevels.get(key) ?? ActivityWarningLevel.None;
        const prevLevel = prevLevelsRef.current.get(key) ?? ActivityWarningLevel.None;

        if (currentLevel === ActivityWarningLevel.None || currentLevel === prevLevel) {
          continue;
        }

        const isEscalation =
          prevLevel === ActivityWarningLevel.None || prevLevel === ActivityWarningLevel.Warning;

        if (isEscalation) {
          const timeStr =
            status.timeRemainingMs != null ? formatTimeRemaining(status.timeRemainingMs) : 'soon';
          const action = status.actionMessage ?? 'paused';
          notification.warning(`Workspace "${ws.name}" will be ${action} in ${timeStr}`);
        }
      }
    }

    isFirstRenderRef.current = false;
    prevLevelsRef.current = currentLevels;
  }, [workspaces, notification]);
};

export default useActivityNotifications;
