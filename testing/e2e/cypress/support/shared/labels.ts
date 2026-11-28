// Context-agnostic: every label the suite reads or writes, in one place. Each label has its
// key and a ready-to-spread `*_LABELS` set, e.g. `labels: { ...labels, ...MANAGED_LABELS }`.

// Workspaces labels: owned by the product, mirrored here so tests set them the way users would.

/** Without it, the backend refuses to attach a PVC or Secret to a Workspace (and the UI hides it). */
export const CAN_MOUNT_LABEL = 'workspaces.kubeflow.org/can-mount';
export const CAN_MOUNT_LABELS = { [CAN_MOUNT_LABEL]: 'true' };

// e2e labels: owned by this suite.

/** Marks objects created by tests; cleaned up after each test and swept on startup. */
export const MANAGED_LABEL = 'e2e.kubeflow.org/managed';
export const MANAGED_LABELS = { [MANAGED_LABEL]: 'true' };
export const MANAGED_SELECTOR = `${MANAGED_LABEL}=true`;

/** Marks the shared baseline objects; removed only by an explicit teardown. */
export const BASELINE_LABEL = 'e2e.kubeflow.org/baseline';
export const BASELINE_LABELS = { [BASELINE_LABEL]: 'true' };
