import * as k8s from '@kubernetes/client-node';
import * as fs from 'fs';
import * as path from 'path';

const E2E_NAMESPACE = 'e2e-test';
const CONTROLLER_SAMPLES = path.resolve(
  __dirname,
  '../../../../../workspaces/controller/manifests/kustomize/samples',
);

function getClients() {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  return {
    core: kc.makeApiClient(k8s.CoreV1Api),
    rbac: kc.makeApiClient(k8s.RbacAuthorizationV1Api),
    custom: kc.makeApiClient(k8s.CustomObjectsApi),
  };
}

function isConflictError(err: unknown): boolean {
  if (err instanceof Error && err.message.includes('HTTP-Code: 409')) {
    return true;
  }
  const httpErr = err as { statusCode?: number };
  return httpErr.statusCode === 409;
}

function isNotFoundError(err: unknown): boolean {
  if (err instanceof Error && err.message.includes('HTTP-Code: 404')) {
    return true;
  }
  const httpErr = err as { statusCode?: number };
  return httpErr.statusCode === 404;
}

async function createIfNotExists<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<void> {
  try {
    await fn();
    console.log(`  Created ${name}`);
  } catch (err) {
    if (isConflictError(err)) {
      console.log(`  ${name} already exists, skipping`);
    } else {
      throw err;
    }
  }
}

async function deleteIfExists<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<void> {
  try {
    await fn();
    console.log(`  Deleted ${name}`);
  } catch (err) {
    if (isNotFoundError(err)) {
      console.log(`  ${name} not found, skipping`);
    } else {
      throw err;
    }
  }
}

async function setupE2e(): Promise<null> {
  console.log('Setting up e2e test environment...');
  const { core, rbac, custom } = getClients();

  // 1. Namespace
  await createIfNotExists('Namespace/e2e-test', () =>
    core.createNamespace({
      body: {
        metadata: {
          name: E2E_NAMESPACE,
          labels: { 'istio-injection': 'enabled' },
        },
      },
    }),
  );

  // 2. ClusterRoles
  await createIfNotExists('ClusterRole/e2e-admin', () =>
    rbac.createClusterRole({
      body: {
        metadata: { name: 'e2e-admin' },
        rules: [
          {
            apiGroups: ['kubeflow.org'],
            resources: ['workspacekinds'],
            verbs: ['create', 'delete', 'get', 'list', 'patch', 'update'],
          },
          {
            apiGroups: ['kubeflow.org'],
            resources: ['workspaces'],
            verbs: ['get', 'list'],
          },
          {
            apiGroups: [''],
            resources: ['namespaces'],
            verbs: ['get', 'list'],
          },
        ],
      },
    }),
  );

  await createIfNotExists('ClusterRole/e2e-user-cluster-reader', () =>
    rbac.createClusterRole({
      body: {
        metadata: { name: 'e2e-user-cluster-reader' },
        rules: [
          {
            apiGroups: ['kubeflow.org'],
            resources: ['workspacekinds'],
            verbs: ['get', 'list'],
          },
          {
            apiGroups: [''],
            resources: ['namespaces'],
            verbs: ['get', 'list'],
          },
          {
            apiGroups: ['storage.k8s.io'],
            resources: ['storageclasses'],
            verbs: ['get', 'list'],
          },
        ],
      },
    }),
  );

  await createIfNotExists('ClusterRole/e2e-user-namespaced', () =>
    rbac.createClusterRole({
      body: {
        metadata: { name: 'e2e-user-namespaced' },
        rules: [
          {
            apiGroups: ['kubeflow.org'],
            resources: ['workspaces'],
            verbs: ['create', 'delete', 'get', 'list', 'patch', 'update'],
          },
          {
            apiGroups: [''],
            resources: ['persistentvolumeclaims'],
            verbs: ['get', 'list', 'create', 'delete'],
          },
          {
            apiGroups: [''],
            resources: ['secrets'],
            verbs: ['get', 'list', 'create', 'update', 'delete'],
          },
        ],
      },
    }),
  );

  // 3. ClusterRoleBindings
  await createIfNotExists('ClusterRoleBinding/e2e-admin-binding', () =>
    rbac.createClusterRoleBinding({
      body: {
        metadata: { name: 'e2e-admin-binding' },
        subjects: [
          {
            kind: 'User',
            name: 'admin@e2e.test',
            apiGroup: 'rbac.authorization.k8s.io',
          },
        ],
        roleRef: {
          kind: 'ClusterRole',
          name: 'e2e-admin',
          apiGroup: 'rbac.authorization.k8s.io',
        },
      },
    }),
  );

  await createIfNotExists(
    'ClusterRoleBinding/e2e-user-cluster-reader-binding',
    () =>
      rbac.createClusterRoleBinding({
        body: {
          metadata: { name: 'e2e-user-cluster-reader-binding' },
          subjects: [
            {
              kind: 'User',
              name: 'user@e2e.test',
              apiGroup: 'rbac.authorization.k8s.io',
            },
          ],
          roleRef: {
            kind: 'ClusterRole',
            name: 'e2e-user-cluster-reader',
            apiGroup: 'rbac.authorization.k8s.io',
          },
        },
      }),
  );

  // 4. RoleBinding (namespaced)
  await createIfNotExists('RoleBinding/e2e-user-binding', () =>
    rbac.createNamespacedRoleBinding({
      namespace: E2E_NAMESPACE,
      body: {
        metadata: { name: 'e2e-user-binding', namespace: E2E_NAMESPACE },
        subjects: [
          {
            kind: 'User',
            name: 'user@e2e.test',
            apiGroup: 'rbac.authorization.k8s.io',
          },
        ],
        roleRef: {
          kind: 'ClusterRole',
          name: 'e2e-user-namespaced',
          apiGroup: 'rbac.authorization.k8s.io',
        },
      },
    }),
  );

  // 5. ServiceAccount
  await createIfNotExists('ServiceAccount/default-editor', () =>
    core.createNamespacedServiceAccount({
      namespace: E2E_NAMESPACE,
      body: {
        metadata: { name: 'default-editor', namespace: E2E_NAMESPACE },
      },
    }),
  );

  // 6. PVC
  await createIfNotExists('PVC/home-volume', () =>
    core.createNamespacedPersistentVolumeClaim({
      namespace: E2E_NAMESPACE,
      body: {
        metadata: {
          name: 'home-volume',
          namespace: E2E_NAMESPACE,
          labels: { 'notebooks.kubeflow.org/can-mount': 'true' },
        },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } },
        },
      },
    }),
  );

  // 7. JupyterLab WorkspaceKind (from controller sample)
  const jupyterlabYaml = fs.readFileSync(
    path.join(CONTROLLER_SAMPLES, 'jupyterlab_v1beta1_workspacekind.yaml'),
    'utf-8',
  );
  const jupyterlabWk = k8s.loadYaml<Record<string, unknown>>(jupyterlabYaml);

  await createIfNotExists('WorkspaceKind/jupyterlab', () =>
    custom.createClusterCustomObject({
      group: 'kubeflow.org',
      version: 'v1beta1',
      plural: 'workspacekinds',
      body: jupyterlabWk,
    }),
  );

  console.log('E2E test environment ready');
  return null;
}

async function teardownE2e(): Promise<null> {
  console.log('Tearing down e2e test environment...');
  const { core, rbac, custom } = getClients();

  // Delete in reverse order; namespace deletion cascades namespaced resources

  await deleteIfExists('WorkspaceKind/jupyterlab', () =>
    custom.deleteClusterCustomObject({
      group: 'kubeflow.org',
      version: 'v1beta1',
      plural: 'workspacekinds',
      name: 'jupyterlab',
    }),
  );

  await deleteIfExists('RoleBinding/e2e-user-binding', () =>
    rbac.deleteNamespacedRoleBinding({
      namespace: E2E_NAMESPACE,
      name: 'e2e-user-binding',
    }),
  );

  await deleteIfExists('ClusterRoleBinding/e2e-user-cluster-reader-binding', () =>
    rbac.deleteClusterRoleBinding({ name: 'e2e-user-cluster-reader-binding' }),
  );

  await deleteIfExists('ClusterRoleBinding/e2e-admin-binding', () =>
    rbac.deleteClusterRoleBinding({ name: 'e2e-admin-binding' }),
  );

  await deleteIfExists('ClusterRole/e2e-user-namespaced', () =>
    rbac.deleteClusterRole({ name: 'e2e-user-namespaced' }),
  );

  await deleteIfExists('ClusterRole/e2e-user-cluster-reader', () =>
    rbac.deleteClusterRole({ name: 'e2e-user-cluster-reader' }),
  );

  await deleteIfExists('ClusterRole/e2e-admin', () =>
    rbac.deleteClusterRole({ name: 'e2e-admin' }),
  );

  await deleteIfExists('Namespace/e2e-test', () =>
    core.deleteNamespace({ name: E2E_NAMESPACE }),
  );

  console.log('E2E test environment torn down');
  return null;
}

export function registerSetupTasks(on: Cypress.PluginEvents): void {
  on('task', {
    setupE2e,
    teardownE2e,
  });
}
