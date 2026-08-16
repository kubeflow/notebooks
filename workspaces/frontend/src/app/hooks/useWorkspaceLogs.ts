import { useCallback, useEffect, useMemo, useState } from 'react';
import { FetchState, FetchStateCallbackPromise, useFetchState, NotReadyError } from 'mod-arch-core';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { DetailsWorkspaceDetails, WorkspacesWorkspaceListItem } from '~/generated/data-contracts';

export type WorkspaceLogsOptions = {
  /** Target container name. Defaults to the primary (main) container when omitted. */
  container?: string;
  /** Number of lines to return from the end of the log. The backend defaults to 1000. */
  tailLines?: number;
  /**
   * Size of the trailing time window, in milliseconds. The concrete `sinceTime`
   * timestamp is derived from this at fetch time, so a refresh always uses a
   * window relative to "now" rather than to when the option was selected.
   */
  sinceWindowMs?: number;
  /** Return logs of the previous terminated container instance. */
  previous?: boolean;
};

export const useWorkspaceLogs = (
  namespace: string | undefined,
  name: string | undefined,
  { container, tailLines, sinceWindowMs, previous }: WorkspaceLogsOptions = {},
): FetchState<string | null> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<FetchStateCallbackPromise<string | null>>(async () => {
    if (!apiAvailable) {
      return Promise.reject(new Error('API not yet available'));
    }
    if (!namespace || !name) {
      return Promise.reject(new NotReadyError('Workspace not yet selected'));
    }
    // Derive the absolute timestamp here, at fetch time, so that refreshing without
    // touching the time-range dropdown re-anchors the window to the current moment.
    const sinceTime = sinceWindowMs
      ? new Date(Date.now() - sinceWindowMs).toISOString()
      : undefined;
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
  }, [
    api.workspaces,
    apiAvailable,
    namespace,
    name,
    container,
    tailLines,
    sinceWindowMs,
    previous,
  ]);

  return useFetchState(call, null);
};

// The backend validates `tailLines` as a positive integer, so there is no "all lines" option.
export const TAIL_LINES_OPTIONS = [100, 500, 1000, 5000];

export const SINCE_OPTIONS: { label: string; windowMs?: number }[] = [
  { label: 'All time' },
  { label: '15 minutes', windowMs: 15 * 60 * 1000 },
  { label: '1 hour', windowMs: 60 * 60 * 1000 },
  { label: '24 hours', windowMs: 24 * 60 * 60 * 1000 },
];

export type ContainerOption = {
  /** Unique key used as the select value; disambiguates regular vs init containers. */
  key: string;
  /** Bare container name sent to the backend. */
  name: string;
  isInit: boolean;
};

export type WorkspaceLogsController = {
  hasPod: boolean;
  /** Resolved bare container name for the current request (and downloads). */
  container: string | undefined;
  containerOptions: ContainerOption[];
  /** Unique key of the currently selected container. */
  activeContainerKey: string | undefined;
  selectContainer: (key: string) => void;
  tailLines: number;
  setTailLines: (lines: number) => void;
  sinceLabel: string;
  setSinceLabel: (label: string) => void;
  previous: boolean;
  setPrevious: (previous: boolean) => void;
  isTextWrapped: boolean;
  setIsTextWrapped: (wrapped: boolean) => void;
  scrollToRow: number | undefined;
  setScrollToRow: (row: number | undefined) => void;
  logs: string | null;
  logsLoaded: boolean;
  logsError: Error | undefined;
  refreshLogs: () => void;
};

/**
 * Owns all of the Logs-tab UI state (container selection, tail lines, time range,
 * previous/wrap toggles, scroll position) and the derived container options, and
 * drives the underlying `useWorkspaceLogs` fetch. Keeping this out of the component
 * keeps the view mostly presentational.
 */
export const useWorkspaceLogsController = (
  workspace: WorkspacesWorkspaceListItem,
  details: DetailsWorkspaceDetails | null,
): WorkspaceLogsController => {
  const { namespace, name } = workspace;

  const containerOptions = useMemo<ContainerOption[]>(
    () => [
      ...(details?.pod?.containers ?? []).map((c) => ({
        key: `container/${c.name}`,
        name: c.name,
        isInit: false,
      })),
      ...(details?.pod?.initContainers ?? []).map((c) => ({
        key: `init/${c.name}`,
        name: c.name,
        isInit: true,
      })),
    ],
    [details?.pod?.containers, details?.pod?.initContainers],
  );

  const [selectedContainerKey, setSelectedContainerKey] = useState<string | undefined>();
  const [tailLines, setTailLines] = useState<number>(1000);
  const [sinceLabel, setSinceLabel] = useState<string>(SINCE_OPTIONS[0].label);
  const [previous, setPrevious] = useState(false);
  const [isTextWrapped, setIsTextWrapped] = useState(false);
  const [scrollToRow, setScrollToRow] = useState<number | undefined>();

  // Default to the primary (first) container of the pod.
  const activeContainerKey = selectedContainerKey ?? containerOptions.at(0)?.key;
  const container = containerOptions.find((o) => o.key === activeContainerKey)?.name;

  // When the drawer stays open across a workspace switch, drop any container that was
  // picked on the previous workspace (it may not exist on the new pod, which would 400)
  // and reset the scroll position.
  useEffect(() => {
    setSelectedContainerKey(undefined);
    setScrollToRow(undefined);
  }, [namespace, name]);

  // Keep the scroll position clean: a row index from a previous snapshot is meaningless
  // after anything that swaps the fetched logs (container, tail count, time range, or
  // the previous-instance toggle) changes.
  useEffect(() => {
    setScrollToRow(undefined);
  }, [activeContainerKey, tailLines, sinceLabel, previous]);

  const sinceWindowMs = useMemo(
    () => SINCE_OPTIONS.find((option) => option.label === sinceLabel)?.windowMs,
    [sinceLabel],
  );

  // Only workspaces that currently have a pod can serve logs.
  const hasPod = !!details?.pod;

  const [logs, logsLoaded, logsError, refreshLogs] = useWorkspaceLogs(
    hasPod ? namespace : undefined,
    hasPod ? name : undefined,
    { container, tailLines, sinceWindowMs, previous },
  );

  return {
    hasPod,
    container,
    containerOptions,
    activeContainerKey,
    selectContainer: setSelectedContainerKey,
    tailLines,
    setTailLines,
    sinceLabel,
    setSinceLabel,
    previous,
    setPrevious,
    isTextWrapped,
    setIsTextWrapped,
    scrollToRow,
    setScrollToRow,
    logs,
    logsLoaded,
    logsError,
    refreshLogs,
  };
};
