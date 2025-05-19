import React from 'react';
import { NotebookAPIs } from '~/shared/api/notebookApi';
import {
  createWorkspace,
  createWorkspaceKind,
  deleteWorkspace,
  deleteWorkspaceKind,
  getHealthCheck,
  getWorkspace,
  getWorkspaceKind,
  listAllWorkspaces,
  listNamespaces,
  listWorkspaceKinds,
  listWorkspaces,
  patchWorkspace,
  patchWorkspaceKind,
  pauseWorkspace,
  startWorkspace,
  updateWorkspace,
  updateWorkspaceKind,
} from '~/shared/api/notebookService';
import { APIState } from '~/shared/api/types';
import useAPIState from '~/shared/api/useAPIState';
import {
  mockCreateWorkspace,
  mockCreateWorkspaceKind,
  mockDeleteWorkspace,
  mockDeleteWorkspaceKind,
  mockGetHealthCheck,
  mockGetWorkspace,
  mockGetWorkspaceKind,
  mockListAllWorkspaces,
  mockListNamespaces,
  mockListWorkspaceKinds,
  mockListWorkspaces,
  mockPatchWorkspace,
  mockPatchWorkspaceKind,
  mockPauseWorkspace,
  mockStartWorkspace,
  mockUpdateWorkspace,
  mockUpdateWorkspaceKind,
} from '~/shared/mock/mockNotebookService';

export type NotebookAPIState = APIState<NotebookAPIs>;

const MOCK_API_ENABLED = process.env.WEBPACK_REPLACE__mockApiEnabled === 'true';

const useNotebookAPIState = (
  hostPath: string | null,
): [apiState: NotebookAPIState, refreshAPIState: () => void] => {
  const createApi = React.useCallback(
    (path: string): NotebookAPIs => ({
      // Health
      getHealthCheck: getHealthCheck(path),
      // Namespace
      listNamespaces: listNamespaces(path),
      // Workspace
      listAllWorkspaces: listAllWorkspaces(path),
      listWorkspaces: listWorkspaces(path),
      createWorkspace: createWorkspace(path),
      getWorkspace: getWorkspace(path),
      updateWorkspace: updateWorkspace(path),
      patchWorkspace: patchWorkspace(path),
      deleteWorkspace: deleteWorkspace(path),
      pauseWorkspace: pauseWorkspace(path),
      startWorkspace: startWorkspace(path),
      // WorkspaceKind
      listWorkspaceKinds: listWorkspaceKinds(path),
      createWorkspaceKind: createWorkspaceKind(path),
      getWorkspaceKind: getWorkspaceKind(path),
      patchWorkspaceKind: patchWorkspaceKind(path),
      deleteWorkspaceKind: deleteWorkspaceKind(path),
      updateWorkspaceKind: updateWorkspaceKind(path),
    }),
    [],
  );

  const createMockApi = React.useCallback(
    (path: string): NotebookAPIs => ({
      // Health
      getHealthCheck: mockGetHealthCheck(path),
      // Namespace
      listNamespaces: mockListNamespaces(path),
      // Workspace
      listAllWorkspaces: mockListAllWorkspaces(path),
      listWorkspaces: mockListWorkspaces(path),
      createWorkspace: mockCreateWorkspace(path),
      getWorkspace: mockGetWorkspace(path),
      updateWorkspace: mockUpdateWorkspace(path),
      patchWorkspace: mockPatchWorkspace(path),
      deleteWorkspace: mockDeleteWorkspace(path),
      pauseWorkspace: mockPauseWorkspace(path),
      startWorkspace: mockStartWorkspace(path),
      // WorkspaceKind
      listWorkspaceKinds: mockListWorkspaceKinds(path),
      createWorkspaceKind: mockCreateWorkspaceKind(path),
      getWorkspaceKind: mockGetWorkspaceKind(path),
      patchWorkspaceKind: mockPatchWorkspaceKind(path),
      deleteWorkspaceKind: mockDeleteWorkspaceKind(path),
      updateWorkspaceKind: mockUpdateWorkspaceKind(path),
    }),
    [],
  );

  return useAPIState(hostPath, MOCK_API_ENABLED ? createMockApi : createApi);
};

export default useNotebookAPIState;
