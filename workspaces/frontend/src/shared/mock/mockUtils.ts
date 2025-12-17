import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import yaml from 'js-yaml';
import { ApiErrorEnvelope, WorkspacesWorkspaceCreate } from '~/generated/data-contracts';

// For testing purposes, a YAML string is considered invalid if it contains a specific pattern in the metadata name.
export function isInvalidYaml(yamlString: string): boolean {
  const parsed = yaml.load(yamlString) as { metadata?: { name?: string } };
  return parsed.metadata?.name?.includes('-invalid') ?? false;
}

// For testing purposes, a workspace is considered invalid if the name contains a specific pattern.
export function isInvalidWorkspace(workspaceCreate: WorkspacesWorkspaceCreate): boolean {
  return workspaceCreate.name.includes('-invalid');
}

export function buildAxiosError(
  envelope: ApiErrorEnvelope,
  status = 400,
  configOverrides: Partial<AxiosResponse['config']> = {},
): AxiosError<ApiErrorEnvelope> {
  const config = {
    url: '',
    method: 'GET',
    headers: new AxiosHeaders(),
    ...configOverrides,
  };

  const response: AxiosResponse<ApiErrorEnvelope> = {
    data: envelope,
    status,
    statusText: 'Bad Request',
    headers: {},
    config,
  };

  return new AxiosError<ApiErrorEnvelope>(
    envelope.error.message,
    envelope.error.code,
    config,
    undefined,
    response,
  );
}
