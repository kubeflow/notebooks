import * as k8s from '@kubernetes/client-node';
import * as fs from 'fs';
import { environment } from '../environment';
import { controllerSampleYaml } from './paths';
import { isConflictError, isNotFoundError } from './k8sErrors';

const E2E_NAMESPACE = environment.namespace;

function getClients() {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  return {
    core: kc.makeApiClient(k8s.CoreV1Api),
    rbac: kc.makeApiClient(k8s.RbacAuthorizationV1Api),
    custom: kc.makeApiClient(k8s.CustomObjectsApi),
  };
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
  await createIfNotExists(`Namespace/${E2E_NAMESPACE}`, () =>
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
            name: environment.identities.admin,
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
              name: environment.identities.user,
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
            name: environment.identities.user,
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
  await createIfNotExists(`PVC/${environment.baselinePvc}`, () =>
    core.createNamespacedPersistentVolumeClaim({
      namespace: E2E_NAMESPACE,
      body: {
        metadata: {
          name: environment.baselinePvc,
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

  // 7. Baseline WorkspaceKind (from controller sample)
  const baselineKindYaml = fs.readFileSync(
    controllerSampleYaml(`${environment.baselineWorkspaceKind}_v1beta1_workspacekind.yaml`),
    'utf-8',
  );
  const baselineKind = k8s.loadYaml<Record<string, unknown>>(baselineKindYaml);

  await createIfNotExists(`WorkspaceKind/${environment.baselineWorkspaceKind}`, () =>
    custom.createClusterCustomObject({
      group: 'kubeflow.org',
      version: 'v1beta1',
      plural: 'workspacekinds',
      body: baselineKind,
    }),
  );

  console.log('E2E test environment ready');
  return null;
}

async function teardownE2e(): Promise<null> {
  console.log('Tearing down e2e test environment...');
  const { core, rbac, custom } = getClients();

  // Delete in reverse order; namespace deletion cascades namespaced resources

  await deleteIfExists(`WorkspaceKind/${environment.baselineWorkspaceKind}`, () =>
    custom.deleteClusterCustomObject({
      group: 'kubeflow.org',
      version: 'v1beta1',
      plural: 'workspacekinds',
      name: environment.baselineWorkspaceKind,
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

  await deleteIfExists(`Namespace/${E2E_NAMESPACE}`, () =>
    core.deleteNamespace({ name: E2E_NAMESPACE }),
  );

  console.log('E2E test environment torn down');
  return null;
}

// Reads a controller sample WorkspaceKind YAML's contents. This must run as a task (Node
// context) rather than be called directly from spec/page-object code: `controllerSampleYaml()`
// resolves a real filesystem path via `__dirname`, which webpack shims to `/` when bundling
// spec code for the browser, silently breaking the path if called from there.
async function readControllerSampleYaml(fileName: string): Promise<string> {
  return fs.readFileSync(controllerSampleYaml(fileName), 'utf-8');
}

export function registerSetupTasks(on: Cypress.PluginEvents): void {
  on('task', {
    setupE2e,
    teardownE2e,
    readControllerSampleYaml,
  });
}
