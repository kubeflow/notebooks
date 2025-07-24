/**
 * -----------------------------------------------------------------------------
 * Experimental API Extensions
 * -----------------------------------------------------------------------------
 *
 * This file contains manually implemented API endpoints that are not yet
 * available in the official Swagger specification provided by the backend.
 *
 * The structure, naming, and typing follow the same conventions as the
 * `swagger-typescript-api` generated clients (HttpClient, RequestParams, etc.)
 * under `src/generated` folder to ensure consistency across the codebase
 * and future compatibility.
 *
 * These endpoints are "experimental" in the sense that they either:
 * - Reflect endpoints that exist but are not documented in the Swagger spec.
 * - Represent planned or internal APIs not yet formalized by the backend.
 *
 * Once the backend Swagger specification includes these endpoints, this file
 * should be removed, and the corresponding generated modules should be used
 * instead.
 */

import { ApiErrorEnvelope } from '~/generated/data-contracts';
import { ContentType, HttpClient, RequestParams } from '~/generated/http-client';

export interface WorkspacePauseState {
  paused: boolean;
}

export interface ApiWorkspacePauseStateEnvelope {
  data: WorkspacePauseState;
}

export class ExperimentalWorkspaces<
  SecurityDataType = unknown,
> extends HttpClient<SecurityDataType> {
  workspacePause = (
    namespace: string,
    workspaceName: string,
    body: ApiWorkspacePauseStateEnvelope,
    params: RequestParams = {},
  ): Promise<ApiWorkspacePauseStateEnvelope> =>
    this.request<ApiWorkspacePauseStateEnvelope, ApiErrorEnvelope>({
      path: `/workspaces/${namespace}/${workspaceName}/actions/pause`,
      method: 'POST',
      body,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
}
