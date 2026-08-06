import { useCallback } from 'react';
import { FetchState, FetchStateCallbackPromise, useFetchState, NotReadyError } from 'mod-arch-core';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';

export type WorkspaceLogsOptions = {
  /** Target container name. Defaults to the primary (main) container when omitted. */
  container?: string;
  /** Number of lines to return from the end of the log. The backend defaults to 1000. */
  tailLines?: number;
  /** Only return logs after this RFC3339 timestamp. */
  sinceTime?: string;
  /** Return logs of the previous terminated container instance. */
  previous?: boolean;
};

export const useWorkspaceLogs = (
  namespace: string | undefined,
  name: string | undefined,
  { container, tailLines, sinceTime, previous }: WorkspaceLogsOptions = {},
): FetchState<string | null> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<FetchStateCallbackPromise<string | null>>(async () => {
    if (!apiAvailable) {
      return Promise.reject(new Error('API not yet available'));
    }
    if (!namespace || !name) {
      return Promise.reject(new NotReadyError('Workspace not yet selected'));
    }
    // The logs endpoint returns a raw text/plain stream, so there is no envelope to unwrap.
    // The response format is left as JSON so that error responses (which *are* JSON envelopes)
    // stay parsed; axios hands back the raw string whenever the body is not valid JSON.
    const logs = await api.workspaces.getWorkspacePodTemplateLogsBatch(namespace, name, {
      container,
      tailLines,
      sinceTime,
      previous,
    });
    // Guard against a log body that happens to be valid JSON and was therefore parsed.
    return typeof logs === 'string' ? logs : JSON.stringify(logs);
  }, [api.workspaces, apiAvailable, namespace, name, container, tailLines, sinceTime, previous]);

  return useFetchState(call, null);
};
