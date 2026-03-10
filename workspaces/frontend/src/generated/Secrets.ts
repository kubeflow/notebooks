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
  ApiSecretCreateEnvelope,
  ApiSecretEnvelope,
  ApiSecretListEnvelope,
  SecretsSecretUpdate,
} from './data-contracts';
import { ContentType, HttpClient, RequestParams } from './http-client';

export class Secrets<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {
  /**
   * @description Returns a list of secrets in a specific namespace.
   *
   * @tags secrets
   * @name ListSecrets
   * @summary List secrets by namespace
   * @request GET:/secrets/{namespace}
   * @response `200` `ApiSecretListEnvelope` Successful secrets response
   * @response `401` `ApiErrorEnvelope` Unauthorized
   * @response `403` `ApiErrorEnvelope` Forbidden
   * @response `422` `ApiErrorEnvelope` Unprocessable Entity. Validation error.
   * @response `500` `ApiErrorEnvelope` Internal server error
   */
  listSecrets = (namespace: string, params: RequestParams = {}) =>
    this.request<ApiSecretListEnvelope, ApiErrorEnvelope>({
      path: `/secrets/${namespace}`,
      method: 'GET',
      format: 'json',
      ...params,
    });
  /**
   * @description Creates a new secret in the specified namespace.
   *
   * @tags secrets
   * @name CreateSecret
   * @summary Create secret
   * @request POST:/secrets/{namespace}
   * @response `201` `ApiSecretCreateEnvelope` Secret created successfully
   * @response `400` `ApiErrorEnvelope` Bad request
   * @response `401` `ApiErrorEnvelope` Unauthorized
   * @response `403` `ApiErrorEnvelope` Forbidden
   * @response `409` `ApiErrorEnvelope` Secret already exists
   * @response `413` `ApiErrorEnvelope` Request Entity Too Large. The request body is too large.
   * @response `415` `ApiErrorEnvelope` Unsupported Media Type. Content-Type header is not correct.
   * @response `422` `ApiErrorEnvelope` Unprocessable Entity. Validation error.
   * @response `500` `ApiErrorEnvelope` Internal server error
   */
  createSecret = (namespace: string, secret: ApiSecretCreateEnvelope, params: RequestParams = {}) =>
    this.request<ApiSecretCreateEnvelope, ApiErrorEnvelope>({
      path: `/secrets/${namespace}`,
      method: 'POST',
      body: secret,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
   * @description Returns the current state of a specific secret identified by namespace and name. This endpoint is intended for retrieving the secret state before updating it.
   *
   * @tags secrets
   * @name GetSecret
   * @summary Get secret
   * @request GET:/secrets/{namespace}/{name}
   * @response `200` `ApiSecretEnvelope` Successful secret response
   * @response `401` `ApiErrorEnvelope` Unauthorized
   * @response `403` `ApiErrorEnvelope` Forbidden
   * @response `404` `ApiErrorEnvelope` Secret not found
   * @response `422` `ApiErrorEnvelope` Unprocessable Entity. Validation error.
   * @response `500` `ApiErrorEnvelope` Internal server error
   */
  getSecret = (namespace: string, name: string, params: RequestParams = {}) =>
    this.request<ApiSecretEnvelope, ApiErrorEnvelope>({
      path: `/secrets/${namespace}/${name}`,
      method: 'GET',
      format: 'json',
      ...params,
    });
  /**
   * @description Updates an existing secret.
   *
   * @tags secrets
   * @name UpdateSecret
   * @summary Update secret
   * @request PUT:/secrets/{namespace}/{name}
   * @response `200` `ApiSecretEnvelope` Secret updated successfully
   * @response `400` `ApiErrorEnvelope` Bad request
   * @response `401` `ApiErrorEnvelope` Unauthorized
   * @response `403` `ApiErrorEnvelope` Forbidden
   * @response `404` `ApiErrorEnvelope` Secret not found
   * @response `413` `ApiErrorEnvelope` Request Entity Too Large. The request body is too large.
   * @response `415` `ApiErrorEnvelope` Unsupported Media Type. Content-Type header is not correct.
   * @response `422` `ApiErrorEnvelope` Unprocessable Entity. Validation error.
   * @response `500` `ApiErrorEnvelope` Internal server error
   */
  updateSecret = (
    namespace: string,
    name: string,
    secret: SecretsSecretUpdate,
    params: RequestParams = {},
  ) =>
    this.request<ApiSecretEnvelope, ApiErrorEnvelope>({
      path: `/secrets/${namespace}/${name}`,
      method: 'PUT',
      body: secret,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
   * @description Deletes a specific secret identified by namespace and name.
   *
   * @tags secrets
   * @name DeleteSecret
   * @summary Delete secret
   * @request DELETE:/secrets/{namespace}/{name}
   * @response `204` `void` No Content
   * @response `401` `ApiErrorEnvelope` Unauthorized
   * @response `403` `ApiErrorEnvelope` Forbidden
   * @response `404` `ApiErrorEnvelope` Secret not found
   * @response `500` `ApiErrorEnvelope` Internal server error
   */
  deleteSecret = (namespace: string, name: string, params: RequestParams = {}) =>
    this.request<void, ApiErrorEnvelope>({
      path: `/secrets/${namespace}/${name}`,
      method: 'DELETE',
      type: ContentType.Json,
      ...params,
    });
}
