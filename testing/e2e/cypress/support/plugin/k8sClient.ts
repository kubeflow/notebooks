import * as k8s from '@kubernetes/client-node';
import { isNotFoundError } from './k8sErrors';

interface K8sResourceParams {
  group: string;
  version: string;
  plural: string;
  namespace?: string;
  name: string;
}

/** A condition to poll for: the value at `path` (a sequence of object keys) must equal `value`. */
interface K8sFieldCondition {
  path: string[];
  value: unknown;
}

interface K8sWaitParams extends K8sResourceParams {
  timeoutMs?: number;
  condition?: K8sFieldCondition;
}

function getClient(): k8s.CustomObjectsApi {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  return kc.makeApiClient(k8s.CustomObjectsApi);
}

async function k8sGet(params: K8sResourceParams): Promise<object> {
  const api = getClient();
  const { namespace, ...gvr } = params;
  if (namespace) {
    return api.getNamespacedCustomObject({ ...gvr, namespace });
  }
  return api.getClusterCustomObject(gvr);
}

async function k8sDelete(params: K8sResourceParams): Promise<null> {
  const api = getClient();
  const { namespace, ...gvr } = params;
  try {
    if (namespace) {
      await api.deleteNamespacedCustomObject({ ...gvr, namespace });
    } else {
      await api.deleteClusterCustomObject(gvr);
    }
  } catch (err: unknown) {
    if (!isNotFoundError(err)) {
      throw err;
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readFieldPath(obj: object, path: string[]): unknown {
  return path.reduce<unknown>(
    (value, key) =>
      value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
    obj,
  );
}

function conditionMet(resource: object, condition?: K8sFieldCondition): boolean {
  if (!condition) {
    return true;
  }
  return readFieldPath(resource, condition.path) === condition.value;
}

// A bounded poll loop (rather than the K8s Watch API) is a deliberate, pragmatic choice here:
// it keeps the wait logic simple and self-contained for a handful of short-lived e2e waits,
// without pulling in watch/informer setup and teardown for what is otherwise a one-shot check.
async function pollUntil(
  check: () => Promise<{ done: boolean; value?: object }>,
  timeoutMs: number,
  describe: () => string,
): Promise<object> {
  const pollInterval = 2_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await check();
    if (result.done) {
      return result.value as object;
    }
    await sleep(pollInterval);
  }

  throw new Error(`Timed out waiting for ${describe()} after ${timeoutMs}ms`);
}

async function k8sWaitForResource(params: K8sWaitParams): Promise<object> {
  const timeoutMs = params.timeoutMs ?? 60_000;

  return pollUntil(
    async () => {
      try {
        const resource = await k8sGet(params);
        return { done: conditionMet(resource, params.condition), value: resource };
      } catch (err: unknown) {
        if (!isNotFoundError(err)) {
          throw err;
        }
        return { done: false };
      }
    },
    timeoutMs,
    () =>
      `${params.plural}/${params.name}` + (params.namespace ? ` in namespace ${params.namespace}` : ''),
  );
}

async function k8sWaitForDeletion(params: K8sResourceParams & { timeoutMs?: number }): Promise<null> {
  const timeoutMs = params.timeoutMs ?? 60_000;

  await pollUntil(
    async () => {
      try {
        await k8sGet(params);
        return { done: false };
      } catch (err: unknown) {
        if (!isNotFoundError(err)) {
          throw err;
        }
        return { done: true };
      }
    },
    timeoutMs,
    () =>
      `deletion of ${params.plural}/${params.name}` +
      (params.namespace ? ` in namespace ${params.namespace}` : ''),
  );

  return null;
}

export function registerK8sTasks(on: Cypress.PluginEvents): void {
  on('task', {
    k8sGet,
    k8sDelete,
    k8sWaitForResource,
    k8sWaitForDeletion,
  });
}
