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
   * @response `201` `ApiWorkspaceKindEnvelope` WorkspaceKind created successfully
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
    this.request<ApiWorkspaceKindEnvelope, ApiErrorEnvelope>({
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
   * @response `200` `ApiWorkspaceKindEnvelope` Successful operation. Returns the requested workspace kind details.
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
}
