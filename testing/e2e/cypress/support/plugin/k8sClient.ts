// Node.js process only (see README "Architecture"). Generic tasks behind the `cy.k8s*`
// commands; they work for any kind because KubernetesObjectApi resolves kinds via discovery.
import * as k8s from '@kubernetes/client-node';
import { planCleanup } from '../shared/cleanupPlan';
import {
  type ApplyTaskArgs,
  conditionMet,
  DEFAULT_WAIT_TIMEOUT_MS,
  describeCondition,
  describeRef,
  type K8sListQuery,
  type K8sObject,
  type K8sRef,
  readPath,
  refOf,
  type WaitCondition,
  type WaitForDeletionTaskArgs,
  type WaitForTaskArgs,
} from '../shared/k8s';
import { isNotFoundError, toApiError } from './k8sErrors';
import { getObjectApi } from './kubeConfig';

const FIELD_MANAGER = 'kubeflow-notebooks-e2e';
const POLL_INTERVAL_MS = 1_000;
const CLEANUP_WAIT_TIMEOUT_MS = 120_000;

function header(ref: K8sRef): {
  apiVersion: string;
  kind: string;
  metadata: { name: string; namespace?: string };
} {
  return {
    apiVersion: ref.apiVersion,
    kind: ref.kind,
    metadata: { name: ref.name, ...(ref.namespace ? { namespace: ref.namespace } : {}) },
  };
}

function strip<T extends k8s.KubernetesObject>(obj: T): T {
  if (obj.metadata) {
    delete obj.metadata.managedFields;
  }
  return obj;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Server-side apply: creates the object, or updates the fields this suite owns. */
export async function apply(object: K8sObject): Promise<K8sObject> {
  const applied = await getObjectApi().patch(
    object as k8s.KubernetesObject,
    undefined,
    undefined,
    FIELD_MANAGER,
    true,
    k8s.PatchStrategy.ServerSideApply,
  );
  return strip(applied) as K8sObject;
}

async function tryGet(ref: K8sRef): Promise<K8sObject | undefined> {
  try {
    return strip(await getObjectApi().read(header(ref))) as K8sObject;
  } catch (err) {
    if (isNotFoundError(err)) {
      return undefined;
    }
    throw err;
  }
}

/** Deletes an object; "already gone" is success. */
export async function remove(ref: K8sRef): Promise<null> {
  try {
    await getObjectApi().delete(header(ref));
  } catch (err) {
    if (!isNotFoundError(err)) {
      throw err;
    }
  }
  return null;
}

export async function list(query: K8sListQuery): Promise<K8sObject[]> {
  const result = await getObjectApi().list(
    query.apiVersion,
    query.kind,
    query.namespace,
    undefined,
    undefined,
    undefined,
    undefined,
    query.labelSelector,
  );
  // List items omit apiVersion/kind; restore them so items can be turned into refs.
  return result.items.map(
    (item) => ({ ...strip(item), apiVersion: query.apiVersion, kind: query.kind }) as K8sObject,
  );
}

export async function waitFor(
  ref: K8sRef,
  condition?: WaitCondition,
  timeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
): Promise<K8sObject> {
  const deadline = Date.now() + timeoutMs;
  let last: K8sObject | undefined;
  while (Date.now() < deadline) {
    last = await tryGet(ref);
    if (last && conditionMet(last, condition)) {
      return last;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  const wanted = condition ? describeCondition(condition) : 'to exist';
  const observed = !last
    ? 'the object does not exist'
    : condition
      ? `last observed ${JSON.stringify(readPath(last, condition.path))}`
      : '';
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for ${describeRef(ref)}: ${wanted} (${observed})`,
  );
}

export async function waitForDeletion(
  ref: K8sRef,
  timeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
): Promise<null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await tryGet(ref))) {
      return null;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${describeRef(ref)} to be deleted`);
}

/**
 * Deletes registered objects in dependency-safe order (see `planCleanup`) and
 * waits for each batch to be gone before starting the next. Keeps going after a
 * failure so one stuck object doesn't leak everything else, and reports all failures.
 */
export async function cleanup(refs: K8sRef[]): Promise<{ failures: string[] }> {
  const failures: string[] = [];
  for (const batch of planCleanup(refs)) {
    const results = await Promise.allSettled(
      batch.map(async (ref) => {
        await remove(ref);
        await waitForDeletion(ref, CLEANUP_WAIT_TIMEOUT_MS);
      }),
    );
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        failures.push(formatApiFailure('Deleting', describeRef(batch[i]), result.reason).message);
      }
    });
  }
  return { failures };
}

function formatApiFailure(action: string, ref: string, err: unknown): Error {
  if (err instanceof k8s.ApiException) {
    const { code, reason, message } = toApiError(err);
    return new Error(`${action} ${ref} failed (${code}${reason ? ` ${reason}` : ''}): ${message}`);
  }
  return err instanceof Error ? err : new Error(String(err));
}

export function registerK8sTasks(on: Cypress.PluginEvents): void {
  on('task', {
    async k8sApply({ object, expectFailure }: ApplyTaskArgs) {
      const name = describeRef({
        ...object,
        name: object.metadata.name ?? '<unnamed>',
        namespace: object.metadata.namespace,
      });
      let applied: K8sObject;
      try {
        applied = await apply(object);
      } catch (err) {
        if (expectFailure && err instanceof k8s.ApiException) {
          return toApiError(err);
        }
        throw formatApiFailure('Applying', name, err);
      }
      if (expectFailure) {
        // Don't leak the object that should never have been created.
        await remove(refOf(applied));
        throw new Error(`Expected applying ${name} to fail, but it succeeded`);
      }
      return applied;
    },
    async k8sGet(ref: K8sRef) {
      const obj = await tryGet(ref);
      if (!obj) {
        throw new Error(`${describeRef(ref)} not found`);
      }
      return obj;
    },
    k8sList: (query: K8sListQuery) => list(query),
    k8sDelete: (ref: K8sRef) => remove(ref),
    k8sWaitFor: ({ ref, condition, timeoutMs }: WaitForTaskArgs) =>
      waitFor(ref, condition, timeoutMs),
    k8sWaitForDeletion: ({ ref, timeoutMs }: WaitForDeletionTaskArgs) =>
      waitForDeletion(ref, timeoutMs),
    k8sCleanup: (refs: K8sRef[]) => cleanup(refs),
  });
}
