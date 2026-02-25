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

import { ApiErrorEnvelope, ApiPVCCreateEnvelope, ApiPVCListEnvelope } from './data-contracts';
import { ContentType, HttpClient, RequestParams } from './http-client';

export class Persistentvolumeclaims<
  SecurityDataType = unknown,
> extends HttpClient<SecurityDataType> {
  /**
   * @description Provides a list of all persistent volume claims with comprehensive metadata in the specified namespace
   *
   * @tags persistentvolumeclaims
   * @name ListPvCs
   * @summary Returns a list of all PVCs in a namespace
   * @request GET:/persistentvolumeclaims/{namespace}
   * @response `200` `ApiPVCListEnvelope` Successful PVCs response
   * @response `401` `ApiErrorEnvelope` Unauthorized
   * @response `403` `ApiErrorEnvelope` Forbidden
   * @response `422` `ApiErrorEnvelope` Unprocessable Entity. Validation error.
   * @response `500` `ApiErrorEnvelope` Internal server error
   */
  listPvCs = (namespace: string, params: RequestParams = {}) =>
    this.request<ApiPVCListEnvelope, ApiErrorEnvelope>({
      path: `/persistentvolumeclaims/${namespace}`,
      method: 'GET',
      format: 'json',
      ...params,
    });
  /**
   * @description Creates a new persistent volume claim in the specified namespace
   *
   * @tags persistentvolumeclaims
   * @name CreatePvc
   * @summary Creates a new PVC
   * @request POST:/persistentvolumeclaims/{namespace}
   * @response `201` `ApiPVCCreateEnvelope` PVC created successfully
   * @response `400` `ApiErrorEnvelope` Bad request
   * @response `401` `ApiErrorEnvelope` Unauthorized
   * @response `403` `ApiErrorEnvelope` Forbidden
   * @response `409` `ApiErrorEnvelope` PVC already exists
   * @response `413` `ApiErrorEnvelope` Request Entity Too Large. The request body is too large.
   * @response `415` `ApiErrorEnvelope` Unsupported Media Type. Content-Type header is not correct.
   * @response `422` `ApiErrorEnvelope` Unprocessable Entity. Validation error.
   * @response `500` `ApiErrorEnvelope` Internal server error
   */
  createPvc = (namespace: string, pvc: ApiPVCCreateEnvelope, params: RequestParams = {}) =>
    this.request<ApiPVCCreateEnvelope, ApiErrorEnvelope>({
      path: `/persistentvolumeclaims/${namespace}`,
      method: 'POST',
      body: pvc,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
   * @description Deletes a persistent volume claim from the specified namespace
   *
   * @tags persistentvolumeclaims
   * @name DeletePvc
   * @summary Deletes a PVC
   * @request DELETE:/persistentvolumeclaims/{namespace}/{name}
   * @response `204` `void` No Content
   * @response `401` `ApiErrorEnvelope` Unauthorized
   * @response `403` `ApiErrorEnvelope` Forbidden
   * @response `404` `ApiErrorEnvelope` PVC not found
   * @response `409` `ApiErrorEnvelope` Conflict
   * @response `422` `ApiErrorEnvelope` Unprocessable Entity. Validation error.
   * @response `500` `ApiErrorEnvelope` Internal server error
   */
  deletePvc = (namespace: string, name: string, params: RequestParams = {}) =>
    this.request<void, ApiErrorEnvelope>({
      path: `/persistentvolumeclaims/${namespace}/${name}`,
      method: 'DELETE',
      ...params,
    });
}
