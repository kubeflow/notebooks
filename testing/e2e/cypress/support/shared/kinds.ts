// Context-agnostic: the apiVersion/kind of every Kubernetes type the suite touches.
// Spread one into an object or model (`{ ...KINDS.namespace, metadata: … }`) instead of
// spelling out the strings; add a type here when a test needs a new one.

const WORKSPACES_API = 'kubeflow.org/v1beta1';
const RBAC_API = 'rbac.authorization.k8s.io/v1';

export interface TypeMeta {
  apiVersion: string;
  kind: string;
}

export const KINDS = {
  workspace: { apiVersion: WORKSPACES_API, kind: 'Workspace' },
  workspaceKind: { apiVersion: WORKSPACES_API, kind: 'WorkspaceKind' },
  namespace: { apiVersion: 'v1', kind: 'Namespace' },
  persistentVolumeClaim: { apiVersion: 'v1', kind: 'PersistentVolumeClaim' },
  secret: { apiVersion: 'v1', kind: 'Secret' },
  configMap: { apiVersion: 'v1', kind: 'ConfigMap' },
  clusterRole: { apiVersion: RBAC_API, kind: 'ClusterRole' },
  clusterRoleBinding: { apiVersion: RBAC_API, kind: 'ClusterRoleBinding' },
  roleBinding: { apiVersion: RBAC_API, kind: 'RoleBinding' },
} as const satisfies Record<string, TypeMeta>;
