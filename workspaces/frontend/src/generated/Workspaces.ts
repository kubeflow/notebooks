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
  ApiWorkspaceActionPauseEnvelope,
  ApiWorkspaceCreateEnvelope,
  ApiWorkspaceEnvelope,
  ApiWorkspaceListEnvelope,
} from './data-contracts';
import { ContentType, HttpClient, RequestParams } from './http-client';

export class Workspaces<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {
  /**
   * @description Returns a list of all workspaces across all namespaces.
   *
   * @tags workspaces
   * @name ListAllWorkspaces
   * @summary List all workspaces
   * @request GET:/workspaces
   * @response `200` `ApiWorkspaceListEnvelope` Successful operation. Returns a list of all workspaces.
   * @response `401` `ApiErrorEnvelope` Unauthorized. Authentication is required.
   * @response `403` `ApiErrorEnvelope` Forbidden. User does not have permission to list workspaces.
   * @response `500` `ApiErrorEnvelope` Internal server error. An unexpected error occurred on the server.
   */
  listAllWorkspaces = (params: RequestParams = {}) =>
    this.request<ApiWorkspaceListEnvelope, ApiErrorEnvelope>({
      path: `/workspaces`,
      method: 'GET',
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
   * @description Returns a list of workspaces in a specific namespace.
   *
   * @tags workspaces
   * @name ListWorkspacesByNamespace
   * @summary List workspaces by namespace
   * @request GET:/workspaces/{namespace}
   * @response `200` `ApiWorkspaceListEnvelope` Successful operation. Returns a list of workspaces in the specified namespace.
   * @response `400` `ApiErrorEnvelope` Bad Request. Invalid namespace format.
   * @response `401` `ApiErrorEnvelope` Unauthorized. Authentication is required.
   * @response `403` `ApiErrorEnvelope` Forbidden. User does not have permission to list workspaces.
   * @response `500` `ApiErrorEnvelope` Internal server error. An unexpected error occurred on the server.
   */
  listWorkspacesByNamespace = (namespace: string, params: RequestParams = {}) =>
    this.request<ApiWorkspaceListEnvelope, ApiErrorEnvelope>({
      path: `/workspaces/${namespace}`,
      method: 'GET',
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
   * @description Creates a new workspace in the specified namespace.
   *
   * @tags workspaces
   * @name CreateWorkspace
   * @summary Create workspace
   * @request POST:/workspaces/{namespace}
   * @response `201` `ApiWorkspaceEnvelope` Workspace created successfully
   * @response `400` `ApiErrorEnvelope` Bad Request. Invalid request body or namespace format.
   * @response `401` `ApiErrorEnvelope` Unauthorized. Authentication is required.
   * @response `403` `ApiErrorEnvelope` Forbidden. User does not have permission to create workspace.
   * @response `409` `ApiErrorEnvelope` Conflict. Workspace with the same name already exists.
   * @response `413` `ApiErrorEnvelope` Request Entity Too Large. The request body is too large.
   * @response `415` `ApiErrorEnvelope` Unsupported Media Type. Content-Type header is not correct.
   * @response `500` `ApiErrorEnvelope` Internal server error. An unexpected error occurred on the server.
   */
  createWorkspace = (
    namespace: string,
    body: ApiWorkspaceCreateEnvelope,
    params: RequestParams = {},
  ) =>
    this.request<ApiWorkspaceEnvelope, ApiErrorEnvelope>({
      path: `/workspaces/${namespace}`,
      method: 'POST',
      body: body,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
   * @description Pauses or unpauses a workspace, stopping or resuming all associated pods.
   *
   * @tags workspaces
   * @name UpdateWorkspacePauseState
   * @summary Pause or unpause a workspace
   * @request POST:/workspaces/{namespace}/{workspaceName}/actions/pause
   * @response `200` `ApiWorkspaceActionPauseEnvelope` Successful action. Returns the current pause state.
   * @response `400` `ApiErrorEnvelope` Bad Request.
   * @response `401` `ApiErrorEnvelope` Unauthorized. Authentication is required.
   * @response `403` `ApiErrorEnvelope` Forbidden. User does not have permission to access the workspace.
   * @response `404` `ApiErrorEnvelope` Not Found. Workspace does not exist.
   * @response `413` `ApiErrorEnvelope` Request Entity Too Large. The request body is too large.
   * @response `415` `ApiErrorEnvelope` Unsupported Media Type. Content-Type header is not correct.
   * @response `422` `ApiErrorEnvelope` Unprocessable Entity. Workspace is not in appropriate state.
   * @response `500` `ApiErrorEnvelope` Internal server error. An unexpected error occurred on the server.
   */
  updateWorkspacePauseState = (
    namespace: string,
    workspaceName: string,
    body: ApiWorkspaceActionPauseEnvelope,
    params: RequestParams = {},
  ) =>
    this.request<ApiWorkspaceActionPauseEnvelope, ApiErrorEnvelope>({
      path: `/workspaces/${namespace}/${workspaceName}/actions/pause`,
      method: 'POST',
      body: body,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
   * @description Returns details of a specific workspace identified by namespace and workspace name.
   *
   * @tags workspaces
   * @name GetWorkspace
   * @summary Get workspace
   * @request GET:/workspaces/{namespace}/{workspace_name}
   * @response `200` `ApiWorkspaceEnvelope` Successful operation. Returns the requested workspace details.
   * @response `400` `ApiErrorEnvelope` Bad Request. Invalid namespace or workspace name format.
   * @response `401` `ApiErrorEnvelope` Unauthorized. Authentication is required.
   * @response `403` `ApiErrorEnvelope` Forbidden. User does not have permission to access the workspace.
   * @response `404` `ApiErrorEnvelope` Not Found. Workspace does not exist.
   * @response `500` `ApiErrorEnvelope` Internal server error. An unexpected error occurred on the server.
   */
  getWorkspace = (namespace: string, workspaceName: string, params: RequestParams = {}) =>
    this.request<ApiWorkspaceEnvelope, ApiErrorEnvelope>({
      path: `/workspaces/${namespace}/${workspaceName}`,
      method: 'GET',
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
   * @description Deletes a specific workspace identified by namespace and workspace name.
   *
   * @tags workspaces
   * @name DeleteWorkspace
   * @summary Delete workspace
   * @request DELETE:/workspaces/{namespace}/{workspace_name}
   * @response `204` `void` Workspace deleted successfully
   * @response `400` `ApiErrorEnvelope` Bad Request. Invalid namespace or workspace name format.
   * @response `401` `ApiErrorEnvelope` Unauthorized. Authentication is required.
   * @response `403` `ApiErrorEnvelope` Forbidden. User does not have permission to delete the workspace.
   * @response `404` `ApiErrorEnvelope` Not Found. Workspace does not exist.
   * @response `500` `ApiErrorEnvelope` Internal server error. An unexpected error occurred on the server.
   */
  deleteWorkspace = (namespace: string, workspaceName: string, params: RequestParams = {}) =>
    this.request<void, ApiErrorEnvelope>({
      path: `/workspaces/${namespace}/${workspaceName}`,
      method: 'DELETE',
      type: ContentType.Json,
      ...params,
    });
}
