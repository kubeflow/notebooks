// Context-agnostic: shared by browser commands/models and plugin tasks so both sides agree on
// the shapes crossing the `cy.task` boundary.
import type { KubernetesObject, V1ObjectMeta } from '@kubernetes/client-node';

/**
 * Any Kubernetes object: client-node's `KubernetesObject` with the fields every object we
 * send or receive has. Models narrow `metadata` to what they guarantee,
 * e.g. `metadata: V1ObjectMeta & { name: string; namespace: string }`.
 */
export interface K8sObject extends KubernetesObject {
  apiVersion: string;
  kind: string;
  metadata: V1ObjectMeta;
  [key: string]: unknown;
}

/** Identifies one object. Omit `namespace` for cluster-scoped kinds. */
export interface K8sRef {
  apiVersion: string;
  kind: string;
  name: string;
  namespace?: string;
}

export interface K8sListQuery {
  apiVersion: string;
  kind: string;
  namespace?: string;
  labelSelector?: string;
}

/**
 * A field path: `'status.state'`, or an array of keys when a key itself
 * contains dots (e.g. `['metadata', 'labels', 'workspaces.kubeflow.org/can-mount']`).
 */
export type FieldPath = string | string[];

/** What `k8sWaitFor` polls for. Omit it to wait until the object exists. */
export type WaitCondition =
  | { path: FieldPath; equals: unknown }
  | { path: FieldPath; oneOf: unknown[] }
  | { path: FieldPath; exists: boolean };

/** A failed API call, as yielded by `expectFailure` applies. */
export interface K8sApiError {
  /** HTTP status, e.g. 403, 409, 422. */
  code: number;
  /** Kubernetes `Status.reason`, e.g. `Invalid`, `Forbidden`, `AlreadyExists`. */
  reason?: string;
  /** Kubernetes `Status.message` (includes webhook/validation messages). */
  message: string;
}

// Arguments of the `k8s*` tasks (see plugin/k8sClient.ts).

export interface ApplyTaskArgs {
  object: K8sObject;
  expectFailure?: boolean;
}

export interface WaitForTaskArgs {
  ref: K8sRef;
  condition?: WaitCondition;
  timeoutMs?: number;
}

export interface WaitForDeletionTaskArgs {
  ref: K8sRef;
  timeoutMs?: number;
}

/** Default for `k8sWaitFor`/`k8sWaitForDeletion` when no `timeoutMs` is given. */
export const DEFAULT_WAIT_TIMEOUT_MS = 60_000;

export function refOf(obj: K8sObject): K8sRef {
  if (!obj.metadata.name) {
    throw new Error(`${obj.kind} has no metadata.name`);
  }
  return {
    apiVersion: obj.apiVersion,
    kind: obj.kind,
    name: obj.metadata.name,
    ...(obj.metadata.namespace ? { namespace: obj.metadata.namespace } : {}),
  };
}

export function describeRef(ref: K8sRef): string {
  return `${ref.kind} ${ref.namespace ? `${ref.namespace}/` : ''}${ref.name}`;
}

export function toPathKeys(path: FieldPath): string[] {
  return Array.isArray(path) ? path : path.split('.');
}

export function readPath(obj: unknown, path: FieldPath): unknown {
  return toPathKeys(path).reduce<unknown>(
    (value, key) =>
      value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
    obj,
  );
}

export function conditionMet(obj: unknown, condition?: WaitCondition): boolean {
  if (!condition) {
    return true;
  }
  const value = readPath(obj, condition.path);
  if ('equals' in condition) {
    return value === condition.equals;
  }
  if ('oneOf' in condition) {
    return condition.oneOf.includes(value);
  }
  return (value !== undefined) === condition.exists;
}

export function describeCondition(condition: WaitCondition): string {
  const path = toPathKeys(condition.path).join('.');
  if ('equals' in condition) {
    return `${path} == ${JSON.stringify(condition.equals)}`;
  }
  if ('oneOf' in condition) {
    return `${path} in ${JSON.stringify(condition.oneOf)}`;
  }
  return `${path} ${condition.exists ? 'exists' : 'is absent'}`;
}
