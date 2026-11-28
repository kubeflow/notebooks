// Node.js process only (see README "Architecture").
import * as k8s from '@kubernetes/client-node';
import { environment } from './environment';

let kubeConfig: k8s.KubeConfig | undefined;
let objectApi: k8s.KubernetesObjectApi | undefined;

function getKubeConfig(): k8s.KubeConfig {
  if (!kubeConfig) {
    kubeConfig = new k8s.KubeConfig();
    kubeConfig.loadFromDefault();
  }
  return kubeConfig;
}

/** One client per Node process; works for any kind (CRDs and core) via discovery. */
export function getObjectApi(): k8s.KubernetesObjectApi {
  if (!objectApi) {
    objectApi = k8s.KubernetesObjectApi.makeApiClient(getKubeConfig());
  }
  return objectApi;
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/**
 * Refuses to touch a cluster unless the current kube context is explicitly
 * allowed, because setup creates cluster-scoped RBAC and sweeps labeled
 * objects. Runs before any task that talks to the cluster.
 */
export function assertAllowedContext(): string {
  const context = getKubeConfig().getCurrentContext();
  const allowed = environment.allowedContexts;
  if (!allowed.some((pattern) => globToRegExp(pattern).test(context))) {
    throw new Error(
      `Refusing to run e2e setup against kube context "${context}". ` +
        `Allowed: ${allowed.join(', ')}. Switch context (kubectl config use-context ...) or set ` +
        `E2E_ALLOWED_CONTEXTS (comma-separated, "*" wildcard), e.g. E2E_ALLOWED_CONTEXTS=kind-tilt.`,
    );
  }
  return context;
}
