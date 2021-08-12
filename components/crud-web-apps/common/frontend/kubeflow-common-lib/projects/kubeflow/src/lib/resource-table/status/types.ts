export enum STATUS_TYPE {
  READY = 'ready',
  WAITING = 'waiting',
  WARNING = 'warning',
  ERROR = 'error',
  UNAVAILABLE = 'unavailable',
  UNINITIALIZED = 'uninitialized',
  TERMINATING = 'terminating',
  STOPPED = 'stopped',
}

export interface Status {
  phase: string;
  state: string;
  message: string;
}
