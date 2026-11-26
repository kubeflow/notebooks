// Node.js process only (see README "Architecture").
//
// The baseline is the small set of objects every spec may rely on. Everything else is created
// by the test that needs it (see models/). Keep this list short: shared state couples tests.
import { describeRef, type K8sObject, type K8sRef, readPath, refOf } from '../shared/k8s';
import { type EnvironmentVariable } from '../shared/environment';
import { KINDS, type TypeMeta } from '../shared/kinds';
import { BASELINE_LABELS, MANAGED_SELECTOR } from '../shared/labels';
import { environment } from './environment';
import { apply, cleanup, list, remove, waitForDeletion } from './k8sClient';
import { assertAllowedContext } from './kubeConfig';
import { workspaceKindSampleFile } from '../shared/samples';
import { loadSample } from './samples';

const RBAC_GROUP = 'rbac.authorization.k8s.io';

// ClusterRoles shipped by the controller manifests.
const WORKSPACES_ADMIN_ROLE = 'kubeflow-workspaces-admin';
const WORKSPACES_EDIT_ROLE = 'kubeflow-workspaces-edit';
// ClusterRoles defined by the baseline below.
const CLUSTER_READER_ROLE = 'e2e-cluster-reader';
const VOLUME_EDITOR_ROLE = 'e2e-volume-editor';

const user = (name: string) => ({ kind: 'User', apiGroup: RBAC_GROUP, name });
const clusterRoleRef = (name: string) => ({
  apiGroup: RBAC_GROUP,
  kind: KINDS.clusterRole.kind,
  name,
});

function clusterRoleBinding(name: string, role: string, subjects: string[]): K8sObject {
  return {
    ...KINDS.clusterRoleBinding,
    metadata: { name, labels: { ...BASELINE_LABELS } },
    subjects: subjects.map(user),
    roleRef: clusterRoleRef(role),
  };
}

function roleBinding(name: string, role: string, subjects: string[]): K8sObject {
  return {
    ...KINDS.roleBinding,
    metadata: { name, namespace: environment.namespace, labels: { ...BASELINE_LABELS } },
    subjects: subjects.map(user),
    roleRef: clusterRoleRef(role),
  };
}

/** In apply order; teardown deletes in reverse. */
function baselineObjects(): K8sObject[] {
  const { admin, user: regularUser } = environment.identities;
  const workspaceKind = loadSample({
    file: workspaceKindSampleFile(environment.baseline.workspaceKind),
    managed: false,
  }).object;
  workspaceKind.metadata.labels = { ...workspaceKind.metadata.labels, ...BASELINE_LABELS };

  return [
    {
      ...KINDS.namespace,
      metadata: {
        name: environment.namespace,
        // Workspace pods are reached through the Istio gateway, so they need a sidecar
        // (same as the controller's own e2e setup: controller/test/utils/istio.go).
        labels: { ...BASELINE_LABELS, 'istio-injection': 'enabled' },
      },
    },
    // Gap: the shipped kubeflow-workspaces-* roles grant nothing cluster-scoped, but the UI
    // lists namespaces (namespace selector) and storage classes (volume forms).
    {
      ...KINDS.clusterRole,
      metadata: { name: CLUSTER_READER_ROLE, labels: { ...BASELINE_LABELS } },
      rules: [
        { apiGroups: [''], resources: ['namespaces'], verbs: ['get', 'list'] },
        { apiGroups: ['storage.k8s.io'], resources: ['storageclasses'], verbs: ['get', 'list'] },
      ],
    },
    // Gap: in a full Kubeflow install, PVC/Secret access comes from kubeflow-edit, which this
    // cluster doesn't have. The Workspace form lists/creates both.
    {
      ...KINDS.clusterRole,
      metadata: { name: VOLUME_EDITOR_ROLE, labels: { ...BASELINE_LABELS } },
      rules: [
        {
          apiGroups: [''],
          resources: ['persistentvolumeclaims', 'secrets'],
          verbs: ['get', 'list', 'create', 'update', 'delete'],
        },
      ],
    },
    clusterRoleBinding(CLUSTER_READER_ROLE, CLUSTER_READER_ROLE, [admin, regularUser]),
    // admin: manages WorkspaceKinds (shipped role, cluster-wide).
    clusterRoleBinding('e2e-admin', WORKSPACES_ADMIN_ROLE, [admin]),
    // user: manages Workspaces in the test namespace only (shipped role).
    roleBinding('e2e-user', WORKSPACES_EDIT_ROLE, [regularUser]),
    roleBinding('e2e-user-volumes', VOLUME_EDITOR_ROLE, [regularUser]),
    workspaceKind,
  ];
}

// Kinds the startup sweep looks for, dependents first. Add a kind here if tests create it
// and it should be swept when a previous run was interrupted.
const SWEEP_KINDS: TypeMeta[] = [
  KINDS.workspace,
  KINDS.workspaceKind,
  KINDS.persistentVolumeClaim,
  KINDS.secret,
  KINDS.configMap,
  KINDS.roleBinding,
  KINDS.clusterRoleBinding,
  KINDS.namespace,
];

/**
 * Deletes test objects left behind by an interrupted run. Assumes one e2e run
 * per cluster at a time.
 */
async function sweepLeftovers(): Promise<void> {
  const leftovers: K8sRef[] = [];
  for (const { apiVersion, kind } of SWEEP_KINDS) {
    const items = await list({ apiVersion, kind, labelSelector: MANAGED_SELECTOR });
    leftovers.push(...items.map(refOf));
  }
  if (leftovers.length === 0) {
    return;
  }
  console.log(
    `  Sweeping ${leftovers.length} leftover object(s): ${leftovers.map(describeRef).join(', ')}`,
  );
  // cleanup() deletes in reverse registration order; SWEEP_KINDS is already dependents-first.
  const { failures } = await cleanup([...leftovers].reverse());
  if (failures.length > 0) {
    throw new Error(`Could not sweep leftovers from a previous run:\n  ${failures.join('\n  ')}`);
  }
}

// The variable that selects each baseline option, named in the error when it's missing.
const BASELINE_OPTION_VARIABLES = {
  imageConfig: 'E2E_BASELINE_IMAGE_CONFIG',
  podConfig: 'E2E_BASELINE_POD_CONFIG',
} as const satisfies Record<string, EnvironmentVariable>;

function assertBaselineOption(
  workspaceKind: K8sObject,
  option: keyof typeof BASELINE_OPTION_VARIABLES,
  id: string,
): void {
  const values = readPath(workspaceKind, ['spec', 'podTemplate', 'options', option, 'values']);
  const ids = Array.isArray(values) ? values.map((v: { id?: string }) => v.id) : [];
  if (!ids.includes(id)) {
    throw new Error(
      `Baseline WorkspaceKind "${workspaceKind.metadata.name}" has no ${option} "${id}" ` +
        `(available: ${ids.join(', ')}). Set ${BASELINE_OPTION_VARIABLES[option]}.`,
    );
  }
}

let baselineReady = false;

/** Idempotent (server-side apply), so edits to this file take effect on existing clusters. */
export async function applyBaseline(): Promise<null> {
  if (baselineReady) {
    return null;
  }
  const context = assertAllowedContext();
  console.log(`Preparing e2e baseline in kube context "${context}"...`);
  await sweepLeftovers();
  for (const object of baselineObjects()) {
    const applied = await apply(object);
    console.log(`  Applied ${describeRef(refOf(applied))}`);
    if (applied.kind === KINDS.workspaceKind.kind) {
      assertBaselineOption(applied, 'imageConfig', environment.baseline.imageConfig);
      assertBaselineOption(applied, 'podConfig', environment.baseline.podConfig);
    }
  }
  baselineReady = true;
  return null;
}

/** Removes the baseline. Runs after the whole run only when E2E_TEARDOWN=true. */
export async function teardownBaseline(): Promise<void> {
  assertAllowedContext();
  console.log('Tearing down e2e baseline...');
  for (const object of baselineObjects().reverse()) {
    const ref = refOf(object);
    await remove(ref);
    await waitForDeletion(ref, 180_000);
    console.log(`  Deleted ${describeRef(ref)}`);
  }
  baselineReady = false;
}

export function registerBaselineTasks(on: Cypress.PluginEvents): void {
  on('task', { applyBaseline });
}
