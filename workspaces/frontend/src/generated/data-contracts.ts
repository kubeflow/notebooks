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

export enum WorkspacesWorkspaceState {
  WorkspaceStateRunning = 'Running',
  WorkspaceStateTerminating = 'Terminating',
  WorkspaceStatePaused = 'Paused',
  WorkspaceStatePending = 'Pending',
  WorkspaceStateError = 'Error',
  WorkspaceStateUnknown = 'Unknown',
}

export enum WorkspacesRedirectMessageLevel {
  RedirectMessageLevelInfo = 'Info',
  RedirectMessageLevelWarning = 'Warning',
  RedirectMessageLevelDanger = 'Danger',
}

export enum WorkspacesProbeResult {
  ProbeResultSuccess = 'Success',
  ProbeResultFailure = 'Failure',
  ProbeResultTimeout = 'Timeout',
}

export enum WorkspacekindsRedirectMessageLevel {
  RedirectMessageLevelInfo = 'Info',
  RedirectMessageLevelWarning = 'Warning',
  RedirectMessageLevelDanger = 'Danger',
}

export enum HealthCheckServiceStatus {
  ServiceStatusHealthy = 'Healthy',
  ServiceStatusUnhealthy = 'Unhealthy',
}

export enum FieldErrorType {
  ErrorTypeNotFound = 'FieldValueNotFound',
  ErrorTypeRequired = 'FieldValueRequired',
  ErrorTypeDuplicate = 'FieldValueDuplicate',
  ErrorTypeInvalid = 'FieldValueInvalid',
  ErrorTypeNotSupported = 'FieldValueNotSupported',
  ErrorTypeForbidden = 'FieldValueForbidden',
  ErrorTypeTooLong = 'FieldValueTooLong',
  ErrorTypeTooMany = 'FieldValueTooMany',
  ErrorTypeInternal = 'InternalError',
  ErrorTypeTypeInvalid = 'FieldValueTypeInvalid',
}

export enum ApiErrorCauseOrigin {
  OriginInternal = 'INTERNAL',
  OriginKubernetes = 'KUBERNETES',
}

export interface ActionsWorkspaceActionPause {
  paused: boolean;
}

export interface ApiConflictError {
  /**
   * A human-readable description of the cause of the error.
   * This field may be presented as-is to a reader.
   */
  message?: string;
  /**
   * Origin indicates where the conflict error originated.
   * If value is empty, the origin is unknown.
   */
  origin?: ApiErrorCauseOrigin;
}

export interface ApiErrorCause {
  /** ConflictCauses contains details about conflict errors that caused the request to fail. */
  conflict_cause?: ApiConflictError[];
  /** ValidationErrors contains details about validation errors that caused the request to fail. */
  validation_errors?: ApiValidationError[];
}

export interface ApiErrorEnvelope {
  error: ApiHTTPError;
}

export interface ApiHTTPError {
  /** Cause contains detailed information about the cause of the error. */
  cause?: ApiErrorCause;
  /** Code is a string representation of the HTTP status code. */
  code: string;
  /** Message is a human-readable description of the error. */
  message: string;
}

export interface ApiNamespaceListEnvelope {
  data: NamespacesNamespace[];
}

export interface ApiSecretCreateEnvelope {
  data: SecretsSecretCreate;
}

export interface ApiSecretEnvelope {
  data: SecretsSecretUpdate;
}

export interface ApiSecretListEnvelope {
  data: SecretsSecretListItem[];
}

export interface ApiValidationError {
  /**
   * The field of the resource that has caused this error, as named by its JSON serialization.
   * May include dot and postfix notation for nested attributes.
   * Arrays are zero-indexed.
   * Fields may appear more than once in an array of causes due to fields having multiple errors.
   *
   * Examples:
   *   "name" - the field "name" on the current resource
   *   "items[0].name" - the field "name" on the first array entry in "items"
   */
  field?: string;
  /**
   * A human-readable description of the cause of the error.
   * This field may be presented as-is to a reader.
   */
  message?: string;
  /**
   * Origin indicates where the validation error originated.
   * If value is empty, the origin is unknown.
   */
  origin?: ApiErrorCauseOrigin;
  /**
   * A machine-readable description of the cause of the error.
   * If value is empty, there is no information available.
   */
  type?: FieldErrorType;
}

export interface ApiWorkspaceActionPauseEnvelope {
  data: ActionsWorkspaceActionPause;
}

export interface ApiWorkspaceCreateEnvelope {
  data: WorkspacesWorkspaceCreate;
}

export interface ApiWorkspaceEnvelope {
  data: WorkspacesWorkspaceUpdate;
}

export interface ApiWorkspaceKindEnvelope {
  data: WorkspacekindsWorkspaceKind;
}

export interface ApiWorkspaceKindListEnvelope {
  data: WorkspacekindsWorkspaceKind[];
}

export interface ApiWorkspaceListEnvelope {
  data: WorkspacesWorkspaceListItem[];
}

export interface CommonAudit {
  createdAt: string;
  createdBy: string;
  deletedAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface HealthCheckHealthCheck {
  status: HealthCheckServiceStatus;
  systemInfo: HealthCheckSystemInfo;
}

export interface HealthCheckSystemInfo {
  version: string;
}

export interface NamespacesNamespace {
  name: string;
}

export interface SecretsSecretCreate {
  contents: SecretsSecretData;
  immutable: boolean;
  name: string;
  type: string;
}

export type SecretsSecretData = Record<string, SecretsSecretValue>;

export interface SecretsSecretListItem {
  audit: CommonAudit;
  canMount: boolean;
  canUpdate: boolean;
  immutable: boolean;
  mounts?: SecretsSecretMount[];
  name: string;
  type: string;
}

export interface SecretsSecretMount {
  group: string;
  kind: string;
  name: string;
}

export interface SecretsSecretUpdate {
  contents: SecretsSecretData;
  immutable: boolean;
  type: string;
}

export interface SecretsSecretValue {
  base64?: string;
}

export interface WorkspacekindsImageConfig {
  default: string;
  values: WorkspacekindsImageConfigValue[];
}

export interface WorkspacekindsImageConfigValue {
  clusterMetrics?: WorkspacekindsClusterMetrics;
  description: string;
  displayName: string;
  hidden: boolean;
  id: string;
  labels: WorkspacekindsOptionLabel[];
  redirect?: WorkspacekindsOptionRedirect;
}

export interface WorkspacekindsImageRef {
  url: string;
}

export interface WorkspacekindsOptionLabel {
  key: string;
  value: string;
}

export interface WorkspacekindsOptionRedirect {
  message?: WorkspacekindsRedirectMessage;
  to: string;
}

export interface WorkspacekindsPodConfig {
  default: string;
  values: WorkspacekindsPodConfigValue[];
}

export interface WorkspacekindsPodConfigValue {
  clusterMetrics?: WorkspacekindsClusterMetrics;
  description: string;
  displayName: string;
  hidden: boolean;
  id: string;
  labels: WorkspacekindsOptionLabel[];
  redirect?: WorkspacekindsOptionRedirect;
}

export interface WorkspacekindsPodMetadata {
  annotations: Record<string, string>;
  labels: Record<string, string>;
}

export interface WorkspacekindsPodTemplate {
  options: WorkspacekindsPodTemplateOptions;
  podMetadata: WorkspacekindsPodMetadata;
  volumeMounts: WorkspacekindsPodVolumeMounts;
}

export interface WorkspacekindsPodTemplateOptions {
  imageConfig: WorkspacekindsImageConfig;
  podConfig: WorkspacekindsPodConfig;
}

export interface WorkspacekindsPodVolumeMounts {
  home: string;
}

export interface WorkspacekindsRedirectMessage {
  level: WorkspacekindsRedirectMessageLevel;
  text: string;
}

export interface WorkspacekindsWorkspaceKind {
  clusterMetrics?: WorkspacekindsClusterMetrics;
  deprecated: boolean;
  deprecationMessage: string;
  description: string;
  displayName: string;
  hidden: boolean;
  icon: WorkspacekindsImageRef;
  logo: WorkspacekindsImageRef;
  name: string;
  podTemplate: WorkspacekindsPodTemplate;
}

export interface WorkspacekindsClusterMetrics {
  workspacesCount: number;
}

export interface WorkspacesActivity {
  /** Unix Epoch time */
  lastActivity: number;
  lastProbe?: WorkspacesLastProbeInfo;
  /** Unix Epoch time */
  lastUpdate: number;
}

export interface WorkspacesHttpService {
  displayName: string;
  httpPath: string;
}

export interface WorkspacesImageConfig {
  current: WorkspacesOptionInfo;
  desired?: WorkspacesOptionInfo;
  redirectChain?: WorkspacesRedirectStep[];
}

export interface WorkspacesImageRef {
  url: string;
}

export interface WorkspacesLastProbeInfo {
  /** Unix Epoch time in milliseconds */
  endTimeMs: number;
  message: string;
  result: WorkspacesProbeResult;
  /** Unix Epoch time in milliseconds */
  startTimeMs: number;
}

export interface WorkspacesOptionInfo {
  description: string;
  displayName: string;
  id: string;
  labels: WorkspacesOptionLabel[];
}

export interface WorkspacesOptionLabel {
  key: string;
  value: string;
}

export interface WorkspacesPodConfig {
  current: WorkspacesOptionInfo;
  desired?: WorkspacesOptionInfo;
  redirectChain?: WorkspacesRedirectStep[];
}

export interface WorkspacesPodMetadata {
  annotations: Record<string, string>;
  labels: Record<string, string>;
}

export interface WorkspacesPodMetadataMutate {
  annotations: Record<string, string>;
  labels: Record<string, string>;
}

export interface WorkspacesPodSecretInfo {
  defaultMode?: number;
  mountPath: string;
  secretName: string;
}

export interface WorkspacesPodSecretMount {
  defaultMode?: number;
  mountPath: string;
  secretName: string;
}

export interface WorkspacesPodTemplate {
  options: WorkspacesPodTemplateOptions;
  podMetadata: WorkspacesPodMetadata;
  volumes: WorkspacesPodVolumes;
}

export interface WorkspacesPodTemplateMutate {
  options: WorkspacesPodTemplateOptionsMutate;
  podMetadata: WorkspacesPodMetadataMutate;
  volumes: WorkspacesPodVolumesMutate;
}

export interface WorkspacesPodTemplateOptions {
  imageConfig: WorkspacesImageConfig;
  podConfig: WorkspacesPodConfig;
}

export interface WorkspacesPodTemplateOptionsMutate {
  imageConfig: string;
  podConfig: string;
}

export interface WorkspacesPodVolumeInfo {
  mountPath: string;
  pvcName: string;
  readOnly: boolean;
}

export interface WorkspacesPodVolumeMount {
  mountPath: string;
  pvcName: string;
  readOnly?: boolean;
}

export interface WorkspacesPodVolumes {
  data: WorkspacesPodVolumeInfo[];
  home?: WorkspacesPodVolumeInfo;
  secrets?: WorkspacesPodSecretInfo[];
}

export interface WorkspacesPodVolumesMutate {
  data: WorkspacesPodVolumeMount[];
  home?: string;
  secrets?: WorkspacesPodSecretMount[];
}

export interface WorkspacesRedirectMessage {
  level: WorkspacesRedirectMessageLevel;
  text: string;
}

export interface WorkspacesRedirectStep {
  message?: WorkspacesRedirectMessage;
  sourceId: string;
  targetId: string;
}

export interface WorkspacesService {
  httpService?: WorkspacesHttpService;
}

export interface WorkspacesWorkspaceCreate {
  deferUpdates: boolean;
  kind: string;
  name: string;
  paused: boolean;
  podTemplate: WorkspacesPodTemplateMutate;
}

export interface WorkspacesWorkspaceKindInfo {
  icon: WorkspacesImageRef;
  logo: WorkspacesImageRef;
  missing: boolean;
  name: string;
}

export interface WorkspacesWorkspaceListItem {
  activity: WorkspacesActivity;
  audit: CommonAudit;
  deferUpdates: boolean;
  name: string;
  namespace: string;
  paused: boolean;
  pausedTime: number;
  pendingRestart: boolean;
  podTemplate: WorkspacesPodTemplate;
  services: WorkspacesService[];
  state: WorkspacesWorkspaceState;
  stateMessage: string;
  workspaceKind: WorkspacesWorkspaceKindInfo;
}

export interface WorkspacesWorkspaceUpdate {
  /** TODO: remove `deferUpdates` once the controller is no longer applying redirects */
  deferUpdates: boolean;
  /** TODO: remove `paused` once we have an "actions" api for pausing workspaces */
  paused: boolean;
  podTemplate: WorkspacesPodTemplateMutate;
  /**
   * Revision is an opaque token that can be treated like an etag.
   * - Clients receive this value from GET requests and must include it
   *   in update requests to ensure they are updating the expected version.
   * - Clients must not parse, interpret, or compare revision values
   *   other than for equality, as the format is not guaranteed to be stable.
   */
  revision: string;
}

/** Kubernetes YAML manifest of a WorkspaceKind */
export type CreateWorkspaceKindPayload = string;
