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

import { ApiErrorEnvelope, HealthCheckHealthCheck } from './data-contracts';
import { HttpClient, RequestParams } from './http-client';

export class Healthcheck<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {
  /**
   * @description Provides a healthcheck response indicating the status of key services.
   *
   * @tags healthcheck
   * @name GetHealthcheck
   * @summary Returns the health status of the application
   * @request GET:/healthcheck
   * @response `200` `HealthCheckHealthCheck` Successful healthcheck response
   * @response `500` `ApiErrorEnvelope` Internal server error
   */
  getHealthcheck = (params: RequestParams = {}) =>
    this.request<HealthCheckHealthCheck, ApiErrorEnvelope>({
      path: `/healthcheck`,
      method: 'GET',
      format: 'json',
      ...params,
    });
}
