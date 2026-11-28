// Context-agnostic: arguments/results of the `loadSample` task (see plugin/samples.ts).
import type { K8sObject } from './k8s';

export interface LoadSampleArgs {
  /** File under workspaces/controller/manifests/kustomize/samples, e.g. `rstudio_v1beta1_workspacekind.yaml`. */
  file: string;
  /** Replaces `metadata.name`, so tests never collide on a sample's fixed name. */
  name?: string;
  /** Adds the managed label (default true) so the startup sweep can find leftovers. */
  managed?: boolean;
}

export interface LoadedSample {
  object: K8sObject;
  /** `object` serialized back to YAML (e.g. for UI upload). Comments are not preserved. */
  yaml: string;
}

/** WorkspaceKind samples shipped in workspaces/controller/manifests/kustomize/samples. */
export type WorkspaceKindSample = 'jupyterlab' | 'rstudio' | 'codeserver';

/** The controller sample file for a WorkspaceKind, e.g. `jupyterlab` → `jupyterlab_v1beta1_workspacekind.yaml`. */
export function workspaceKindSampleFile(sample: string): string {
  return `${sample}_v1beta1_workspacekind.yaml`;
}
