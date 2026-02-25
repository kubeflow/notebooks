import { Healthcheck } from '~/generated/Healthcheck';
import { Namespaces } from '~/generated/Namespaces';
import { Persistentvolumeclaims } from '~/generated/Persistentvolumeclaims';
import { Secrets } from '~/generated/Secrets';
import { Storageclasses } from '~/generated/Storageclasses';
import { Workspacekinds } from '~/generated/Workspacekinds';
import { Workspaces } from '~/generated/Workspaces';
import { ApiInstance } from '~/shared/api/types';

export interface NotebookApis {
  healthCheck: ApiInstance<typeof Healthcheck>;
  namespaces: ApiInstance<typeof Namespaces>;
  workspaces: ApiInstance<typeof Workspaces>;
  workspaceKinds: ApiInstance<typeof Workspacekinds>;
  secrets: ApiInstance<typeof Secrets>;
  pvc: ApiInstance<typeof Persistentvolumeclaims>;
  storageClasses: ApiInstance<typeof Storageclasses>;
}

export const notebookApisImpl = (path: string): NotebookApis => {
  const commonConfig = { baseURL: path };

  return {
    healthCheck: new Healthcheck(commonConfig),
    namespaces: new Namespaces(commonConfig),
    workspaces: new Workspaces(commonConfig),
    workspaceKinds: new Workspacekinds(commonConfig),
    secrets: new Secrets(commonConfig),
    pvc: new Persistentvolumeclaims(commonConfig),
    storageClasses: new Storageclasses(commonConfig),
  };
};
