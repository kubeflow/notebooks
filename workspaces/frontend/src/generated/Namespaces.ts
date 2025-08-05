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

import { ApiErrorEnvelope, ApiNamespaceListEnvelope } from './data-contracts';
import { HttpClient, RequestParams } from './http-client';

export class Namespaces<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {
  /**
   * @description Provides a list of all namespaces that the user has access to
   *
   * @tags namespaces
   * @name ListNamespaces
   * @summary Returns a list of all namespaces
   * @request GET:/namespaces
   * @response `200` `ApiNamespaceListEnvelope` Successful namespaces response
   * @response `401` `ApiErrorEnvelope` Unauthorized
   * @response `403` `ApiErrorEnvelope` Forbidden
   * @response `500` `ApiErrorEnvelope` Internal server error
   */
  listNamespaces = (params: RequestParams = {}) =>
    this.request<ApiNamespaceListEnvelope, ApiErrorEnvelope>({
      path: `/namespaces`,
      method: 'GET',
      format: 'json',
      ...params,
    });
}
