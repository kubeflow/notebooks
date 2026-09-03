import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchEventSource, EventStreamContentType } from '@microsoft/fetch-event-source';
import { FetchState } from 'mod-arch-core';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { ApiWorkspaceListEnvelope } from '~/generated/data-contracts';
import { BFF_API_VERSION, DEV_MODE, URL_PREFIX } from '~/shared/utilities/const';
import { getDevAuthHeaders } from '~/shared/utilities/devAuth';

/**
 * Connection state of the workspaces live stream, surfaced to the UI so it can
 * show a "Live"/reconnecting indicator.
 */
export type StreamConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'error';

type WorkspaceList = ApiWorkspaceListEnvelope['data'];

/**
 * FatalStreamError marks a stream failure that will not be recovered by
 * reconnecting (e.g. 401/403). Thrown from onopen/onerror to stop
 * fetch-event-source from retrying.
 */
class FatalStreamError extends Error {}

const buildStreamUrl = (namespace: string): string => {
  const prefix = URL_PREFIX.replace(/\/$/, '');
  return `${prefix}/api/${BFF_API_VERSION}/workspaces/${namespace}?watch=true`;
};

/**
 * useWorkspacesByNamespaceLive streams the workspace list for a namespace over
 * Server-Sent Events, pushing a fresh full-list snapshot on every backend
 * change instead of polling. It returns a `FetchState` tuple identical in shape
 * to {@link useWorkspacesByNamespace} (so it is a drop-in replacement) alongside
 * the current stream connection status.
 */
export const useWorkspacesByNamespaceLive = (
  namespace: string,
): { fetchState: FetchState<WorkspaceList>; connectionStatus: StreamConnectionStatus } => {
  const { apiAvailable } = useNotebookAPI();
  const { namespacesLoaded, selectedNamespace } = useNamespaceSelectorWrapper();

  const [workspaces, setWorkspaces] = useState<WorkspaceList>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [connectionStatus, setConnectionStatus] = useState<StreamConnectionStatus>('connecting');
  // Bumped by refresh() to force the effect to tear down and reopen the stream.
  const [reconnectNonce, setReconnectNonce] = useState(0);

  // Holds the latest workspaces so refresh() can resolve with current data
  // without needing to be recreated on every snapshot.
  const workspacesRef = useRef<WorkspaceList>(workspaces);
  workspacesRef.current = workspaces;

  const ready = apiAvailable && namespacesLoaded && selectedNamespace !== '';

  useEffect(() => {
    if (!ready) {
      return undefined;
    }

    const controller = new AbortController();
    setConnectionStatus('connecting');

    fetchEventSource(buildStreamUrl(namespace), {
      signal: controller.signal,
      // In dev the userid/groups headers are set client-side (mirrors the axios
      // interceptor); in prod the gateway injects them, so this is empty.
      headers: DEV_MODE ? getDevAuthHeaders() : undefined,
      onopen: async (response) => {
        const contentType = response.headers.get('content-type') ?? '';
        if (response.ok && contentType.includes(EventStreamContentType)) {
          setConnectionStatus('live');
          setError(undefined);
          return;
        }
        // 4xx (auth/not-found/validation) won't succeed on retry — fail fast.
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new FatalStreamError(`workspace stream failed with status ${response.status}`);
        }
        // 5xx / 429 / unexpected: let the library retry with backoff.
        throw new Error(`workspace stream failed with status ${response.status}`);
      },
      onmessage: (msg) => {
        if (msg.event === 'error') {
          setError(new Error(msg.data || 'workspace stream error'));
          return;
        }
        if (!msg.data) {
          return;
        }
        try {
          const envelope: ApiWorkspaceListEnvelope = JSON.parse(msg.data);
          setWorkspaces(envelope.data);
          setLoaded(true);
          setError(undefined);
          setConnectionStatus('live');
        } catch {
          setError(new Error('failed to parse workspace stream payload'));
        }
      },
      onclose: () => {
        // Server ended the stream unexpectedly; throw so the library reconnects.
        throw new Error('workspace stream closed by server');
      },
      onerror: (err) => {
        if (err instanceof FatalStreamError) {
          setConnectionStatus('error');
          setError(err);
          throw err; // stop retrying
        }
        setConnectionStatus('reconnecting');
        return undefined; // retry with the library's default backoff
      },
    }).catch(() => {
      // Reaches here on abort (unmount/refresh) or a fatal error already
      // reflected in state; nothing further to do.
    });

    return () => controller.abort();
  }, [ready, namespace, reconnectNonce]);

  const refresh = useCallback<FetchState<WorkspaceList>[3]>(() => {
    setReconnectNonce((nonce) => nonce + 1);
    return Promise.resolve(workspacesRef.current);
  }, []);

  return { fetchState: [workspaces, loaded, error, refresh], connectionStatus };
};
