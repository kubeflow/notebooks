export type APIOptions = {
  dryRun?: boolean;
  signal?: AbortSignal;
  parseJSON?: boolean;
  headers?: Record<string, string>;
};

export type APIState<T> = {
  /** If API will successfully call */
  apiAvailable: boolean;
  /** The available API functions */
  api: T;
};

export type ResponseBody<T> = {
  data: T;
  metadata?: Record<string, unknown>;
};

export type RequestData<T> = {
  data: T;
};
