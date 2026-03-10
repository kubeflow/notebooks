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

import { ApiErrorEnvelope, ApiStorageClassListEnvelope } from './data-contracts';
import { HttpClient, RequestParams } from './http-client';

export class Storageclasses<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {
  /**
   * @description Returns a list of all storage classes in the cluster.
   *
   * @tags storageclasses
   * @name ListStorageClasses
   * @summary List storage classes
   * @request GET:/storageclasses
   * @response `200` `ApiStorageClassListEnvelope` Successful storage classes response
   * @response `401` `ApiErrorEnvelope` Unauthorized
   * @response `403` `ApiErrorEnvelope` Forbidden
   * @response `500` `ApiErrorEnvelope` Internal server error
   */
  listStorageClasses = (params: RequestParams = {}) =>
    this.request<ApiStorageClassListEnvelope, ApiErrorEnvelope>({
      path: `/storageclasses`,
      method: 'GET',
      format: 'json',
      ...params,
    });
}
