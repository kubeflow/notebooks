import { ApiErrorEnvelope } from '~/generated/data-contracts';
import { ApiConfig, HttpClient } from '~/generated/http-client';

export type RemoveHttpClient<T> = Omit<T, keyof HttpClient<unknown>>;

export type WithExperimental<TBase, TExperimental> = TBase & {
  experimental: TExperimental;
};

export type ApiClass = abstract new (config?: ApiConfig) => object;
export type ApiInstance<T extends ApiClass> = RemoveHttpClient<InstanceType<T>>;
export type ApiCallResult<T> =
  | { ok: true; result: T }
  | { ok: false; errorEnvelope: ApiErrorEnvelope };
