/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import {
  ApiErrorEnvelope,
  ApiPodTemplateOptionsEnvelope,
  ApiPodTemplateOptionsListValuesRequestEnvelope,
  ApiWorkspaceKindCreateEnvelope,
  ApiWorkspaceKindEnvelope,
  ApiWorkspaceKindListEnvelope,
  CreateWorkspaceKindPayload,
} from './data-contracts';
import { ContentType, HttpClient, RequestParams } from './http-client';

export class Workspacekinds<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {
  /**
   * @description Returns a list of all workspace kinds in the cluster. When namespaceFilter is provided, authorization checks whether the user can create workspaces in that namespace instead of requiring workspace kind list permission.
   *
   * @tags workspacekinds
   * @name ListWorkspaceKinds
   * @summary List workspace kinds
   * @request GET:/workspacekinds
   * @response `200` `ApiWorkspaceKindListEnvelope` Successful operation. Returns a list of all available workspace kinds.
   * @response `401` `ApiErrorEnvelope` Unauthorized. Authentication is required.
   * @response `403` `ApiErrorEnvelope` Forbidden. User does not have permission to list workspace kinds.
   * @response `422` `ApiErrorEnvelope` Unprocessable Entity. Validation error.
   * @response `500` `ApiErrorEnvelope` Internal server error. An unexpected error occurred on the server.
   */
  listWorkspaceKinds = (
    query?: {
      /** Namespace used for workspace creation authorization */
      namespaceFilter?: string;
    },
    params: RequestParams = {},
  ) =>
    this.request<ApiWorkspaceKindListEnvelope, ApiErrorEnvelope>({
      path: `/workspacekinds`,
      method: 'GET',
      query: query,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
   * @description Creates a new workspace kind.
   *
   * @tags workspacekinds
   * @name CreateWorkspaceKind
   * @summary Create workspace kind
   * @request POST:/workspacekinds
   * @response `201` `ApiWorkspaceKindCreateEnvelope` WorkspaceKind created successfully
   * @response `400` `ApiErrorEnvelope` Bad Request.
   * @response `401` `ApiErrorEnvelope` Unauthorized. Authentication is required.
   * @response `403` `ApiErrorEnvelope` Forbidden. User does not have permission to create WorkspaceKind.
   * @response `409` `ApiErrorEnvelope` Conflict. WorkspaceKind with the same name already exists.
   * @response `413` `ApiErrorEnvelope` Request Entity Too Large. The request body is too large.
   * @response `415` `ApiErrorEnvelope` Unsupported Media Type. Content-Type header is not correct.
   * @response `422` `ApiErrorEnvelope` Unprocessable Entity. Validation error.
   * @response `500` `ApiErrorEnvelope` Internal server error. An unexpected error occurred on the server.
   */
  createWorkspaceKind = (body: CreateWorkspaceKindPayload, params: RequestParams = {}) =>
    this.request<ApiWorkspaceKindCreateEnvelope, ApiErrorEnvelope>({
      path: `/workspacekinds`,
      method: 'POST',
      body: body,
      format: 'json',
      ...params,
    });
  /**
   * @description Returns details of a specific workspace kind identified by its name.
   *
   * @tags workspacekinds
   * @name GetWorkspaceKind
   * @summary Get workspace kind
   * @request GET:/workspacekinds/{name}
   * @response `200` `ApiWorkspaceKindEnvelope` Successful operation. Returns the requested workspace kind details with new revision.
   * @response `400` `ApiErrorEnvelope` Bad Request. Invalid workspace kind name format.
   * @response `401` `ApiErrorEnvelope` Unauthorized. Authentication is required.
   * @response `403` `ApiErrorEnvelope` Forbidden. User does not have permission to access the workspace kind.
   * @response `404` `ApiErrorEnvelope` Not Found. Workspace kind does not exist.
   * @response `500` `ApiErrorEnvelope` Internal server error. An unexpected error occurred on the server.
   */
  getWorkspaceKind = (name: string, params: RequestParams = {}) =>
    this.request<ApiWorkspaceKindEnvelope, ApiErrorEnvelope>({
      path: `/workspacekinds/${name}`,
      method: 'GET',
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
   * @description Updates an existing workspace kind.
   *
   * @tags workspacekinds
   * @name UpdateWorkspaceKind
   * @summary Update workspace kind
   * @request PUT:/workspacekinds/{name}
   * @response `200` `ApiWorkspaceKindEnvelope` WorkspaceKind updated successfully
   * @response `400` `ApiErrorEnvelope` Bad Request.
   * @response `401` `ApiErrorEnvelope` Unauthorized. Authentication is required.
   * @response `403` `ApiErrorEnvelope` Forbidden. User does not have permission to update workspace kind.
   * @response `404` `ApiErrorEnvelope` Not Found. WorkspaceKind does not exist.
   * @response `409` `ApiErrorEnvelope` Conflict. Current workspace kind revision is newer than provided.
   * @response `413` `ApiErrorEnvelope` Request Entity Too Large. The request body is too large.
   * @response `415` `ApiErrorEnvelope` Unsupported Media Type. Content-Type header is not correct.
   * @response `422` `ApiErrorEnvelope` Unprocessable Entity. Validation error.
   * @response `500` `ApiErrorEnvelope` Internal server error. An unexpected error occurred on the server.
   */
  updateWorkspaceKind = (
    name: string,
    body: ApiWorkspaceKindEnvelope,
    params: RequestParams = {},
  ) =>
    this.request<ApiWorkspaceKindEnvelope, ApiErrorEnvelope>({
      path: `/workspacekinds/${name}`,
      method: 'PUT',
      body: body,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
   * @description Deletes a specific workspace kind identified by its name.
   *
   * @tags workspacekinds
   * @name DeleteWorkspaceKind
   * @summary Delete workspace kind
   * @request DELETE:/workspacekinds/{name}
   * @response `204` `void` Workspace kind deleted successfully
   * @response `401` `ApiErrorEnvelope` Unauthorized. Authentication is required.
   * @response `403` `ApiErrorEnvelope` Forbidden. User does not have permission to delete the workspace kind.
   * @response `404` `ApiErrorEnvelope` Not Found. Workspace kind does not exist.
   * @response `409` `ApiErrorEnvelope` Conflict. Workspace kind is in use by one or more workspaces.
   * @response `422` `ApiErrorEnvelope` Unprocessable Entity. Validation error.
   * @response `500` `ApiErrorEnvelope` Internal server error. An unexpected error occurred on the server.
   */
  deleteWorkspaceKind = (name: string, params: RequestParams = {}) =>
    this.request<void, ApiErrorEnvelope>({
      path: `/workspacekinds/${name}`,
      method: 'DELETE',
      type: ContentType.Json,
      ...params,
    });
  /**
   * @description Returns filtered imageConfig and podConfig options based on the provided context.
   *
   * @tags workspacekinds
   * @name PodTemplateOptionsListValues
   * @summary List options values for a pod template workspace kind
   * @request POST:/workspacekinds/{name}/podtemplate/options/listvalues
   * @response `200` `ApiPodTemplateOptionsEnvelope` Successful operation. Returns filtered options with ruleEffects.
   * @response `400` `ApiErrorEnvelope` Bad Request. Invalid workspace kind name or request body.
   * @response `401` `ApiErrorEnvelope` Unauthorized. Authentication is required.
   * @response `403` `ApiErrorEnvelope` Forbidden. User does not have permission to access the workspace kind.
   * @response `404` `ApiErrorEnvelope` Not Found. Workspace kind does not exist.
   * @response `413` `ApiErrorEnvelope` Request Entity Too Large. The request body is too large.
   * @response `415` `ApiErrorEnvelope` Unsupported Media Type. Content-Type header is not correct.
   * @response `422` `ApiErrorEnvelope` Unprocessable Entity. Validation error.
   * @response `500` `ApiErrorEnvelope` Internal server error. An unexpected error occurred on the server.
   */
  podTemplateOptionsListValues = (
    name: string,
    body: ApiPodTemplateOptionsListValuesRequestEnvelope,
    params: RequestParams = {},
  ) =>
    this.request<ApiPodTemplateOptionsEnvelope, ApiErrorEnvelope>({
      path: `/workspacekinds/${name}/podtemplate/options/listvalues`,
      method: 'POST',
      body: body,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
}
