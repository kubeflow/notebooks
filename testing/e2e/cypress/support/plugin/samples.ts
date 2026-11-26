// Node.js process only (see README "Architecture").
import * as fs from 'fs';
import * as k8s from '@kubernetes/client-node';
import type { K8sObject } from '../shared/k8s';
import { MANAGED_LABELS } from '../shared/labels';
import type { LoadedSample, LoadSampleArgs } from '../shared/samples';
import { controllerSampleYaml } from './paths';

/** Loads a controller sample so tests reuse the manifests the project ships, not copies. */
export function loadSample({ file, name, managed = true }: LoadSampleArgs): LoadedSample {
  const object = k8s.loadYaml<K8sObject>(fs.readFileSync(controllerSampleYaml(file), 'utf-8'));
  if (name) {
    object.metadata.name = name;
  }
  if (managed) {
    object.metadata.labels = { ...object.metadata.labels, ...MANAGED_LABELS };
  }
  return { object, yaml: k8s.dumpYaml(object) };
}

export function registerSampleTasks(on: Cypress.PluginEvents): void {
  on('task', { loadSample });
}
