// Context-agnostic. Decides the order the cleanup task deletes registered objects in.
// TODO: add Node unit tests (node --test) as the framework grows.
import type { K8sRef } from './k8s';

const keyOf = (ref: K8sRef): string =>
  [ref.apiVersion, ref.kind, ref.namespace ?? '', ref.name].join('|');

/**
 * Returns batches to delete one after another. Objects are deleted in reverse
 * registration order, because later objects usually depend on earlier ones
 * (e.g. the WorkspaceKind webhook rejects deleting a kind that Workspaces
 * still use). Consecutive objects of the same kind form one batch, deleted
 * concurrently, so tests with many objects of one kind stay fast.
 *
 * An object registered more than once is deleted at its latest position.
 */
export function planCleanup(registered: K8sRef[]): K8sRef[][] {
  const seen = new Set<string>();
  const ordered: K8sRef[] = [];
  for (const ref of [...registered].reverse()) {
    const key = keyOf(ref);
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(ref);
    }
  }

  const batches: K8sRef[][] = [];
  for (const ref of ordered) {
    const last = batches[batches.length - 1];
    if (last && last[0].apiVersion === ref.apiVersion && last[0].kind === ref.kind) {
      last.push(ref);
    } else {
      batches.push([ref]);
    }
  }
  return batches;
}
