import { Healthcheck } from '~/generated/Healthcheck';
import { Namespaces } from '~/generated/Namespaces';
import { Workspacekinds } from '~/generated/Workspacekinds';
import { Workspaces } from '~/generated/Workspaces';
import { ExperimentalWorkspaces } from '~/shared/api/experimental';
import { ApiInstance, WithExperimental } from '~/shared/api/types';

export interface NotebookApis {
  healthCheck: ApiInstance<typeof Healthcheck>;
  namespaces: ApiInstance<typeof Namespaces>;
  workspaces: WithExperimental<
    ApiInstance<typeof Workspaces>,
    ApiInstance<typeof ExperimentalWorkspaces>
  >;
  workspaceKinds: ApiInstance<typeof Workspacekinds>;
}

export const notebookApisImpl = (path: string): NotebookApis => {
  const commonConfig = { baseURL: path };

  return {
    healthCheck: new Healthcheck(commonConfig),
    namespaces: new Namespaces(commonConfig),
    workspaces: {
      ...new Workspaces(commonConfig),
      experimental: new ExperimentalWorkspaces(commonConfig),
    },
    workspaceKinds: new Workspacekinds(commonConfig),
  };
};
