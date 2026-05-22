import * as k8s from '@kubernetes/client-node';

interface K8sResourceParams {
  group: string;
  version: string;
  plural: string;
  namespace?: string;
  name: string;
}

interface K8sWaitParams extends K8sResourceParams {
  timeoutMs?: number;
}

function getClient(): k8s.CustomObjectsApi {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  return kc.makeApiClient(k8s.CustomObjectsApi);
}

function isNotFoundError(err: unknown): boolean {
  if (err instanceof Error && err.message.includes('HTTP-Code: 404')) {
    return true;
  }
  const httpErr = err as { statusCode?: number };
  return httpErr.statusCode === 404;
}

async function k8sGet(params: K8sResourceParams): Promise<object> {
  const api = getClient();
  if (params.namespace) {
    const resp = await api.getNamespacedCustomObject({
      group: params.group,
      version: params.version,
      namespace: params.namespace,
      plural: params.plural,
      name: params.name,
    });
    return resp;
  }
  const resp = await api.getClusterCustomObject({
    group: params.group,
    version: params.version,
    plural: params.plural,
    name: params.name,
  });
  return resp;
}

async function k8sDelete(params: K8sResourceParams): Promise<null> {
  const api = getClient();
  try {
    if (params.namespace) {
      await api.deleteNamespacedCustomObject({
        group: params.group,
        version: params.version,
        namespace: params.namespace,
        plural: params.plural,
        name: params.name,
      });
    } else {
      await api.deleteClusterCustomObject({
        group: params.group,
        version: params.version,
        plural: params.plural,
        name: params.name,
      });
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

async function k8sWaitForResource(params: K8sWaitParams): Promise<object> {
  const timeoutMs = params.timeoutMs ?? 60_000;
  const pollInterval = 2_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      return await k8sGet(params);
    } catch (err: unknown) {
      if (!isNotFoundError(err)) {
        throw err;
      }
    }
    await sleep(pollInterval);
  }

  throw new Error(
    `Timed out waiting for ${params.plural}/${params.name}` +
      (params.namespace ? ` in namespace ${params.namespace}` : '') +
      ` after ${timeoutMs}ms`,
  );
}

export function registerK8sTasks(
  on: Cypress.PluginEvents,
): void {
  on('task', {
    k8sGet,
    k8sDelete,
    k8sWaitForResource,
  });
}
