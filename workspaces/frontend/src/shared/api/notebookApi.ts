import { Healthcheck } from '~/generated/Healthcheck';
import { Namespaces } from '~/generated/Namespaces';
import { Persistentvolumeclaims } from '~/generated/Persistentvolumeclaims';
import { Secrets } from '~/generated/Secrets';
import { Storageclasses } from '~/generated/Storageclasses';
import { Workspacekinds } from '~/generated/Workspacekinds';
import { Workspaces } from '~/generated/Workspaces';
import { ApiInstance } from '~/shared/api/types';
import { DEV_MODE } from '~/shared/utilities/const';
import { registerDevAuthInterceptor } from '~/shared/utilities/devAuth';

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

  const healthCheck = new Healthcheck(commonConfig);
  const namespaces = new Namespaces(commonConfig);
  const workspaces = new Workspaces(commonConfig);
  const workspaceKinds = new Workspacekinds(commonConfig);
  const secrets = new Secrets(commonConfig);
  const pvc = new Persistentvolumeclaims(commonConfig);
  const storageClasses = new Storageclasses(commonConfig);

  if (DEV_MODE) {
    [healthCheck, namespaces, workspaces, workspaceKinds, secrets, pvc, storageClasses].forEach(
      (api) => registerDevAuthInterceptor(api.instance),
    );
  }

  return { healthCheck, namespaces, workspaces, workspaceKinds, secrets, pvc, storageClasses };
};
