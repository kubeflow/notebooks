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

export interface ActionsWorkspaceActionPause {
  paused: boolean;
}

export interface ApiErrorCause {
  validation_errors?: ApiValidationError[];
}

export interface ApiErrorEnvelope {
  error: ApiHTTPError;
}

export interface ApiHTTPError {
  cause?: ApiErrorCause;
  code: string;
  message: string;
}

export interface ApiNamespaceListEnvelope {
  data: NamespacesNamespace[];
}

export interface ApiValidationError {
  field: string;
  message: string;
  type: FieldErrorType;
}

export interface ApiWorkspaceActionPauseEnvelope {
  data: ActionsWorkspaceActionPause;
}

export interface ApiWorkspaceCreateEnvelope {
  data: WorkspacesWorkspaceCreate;
}

export interface ApiWorkspaceEnvelope {
  data: WorkspacesWorkspace;
}

export interface ApiWorkspaceKindEnvelope {
  data: WorkspacekindsWorkspaceKind;
}

export interface ApiWorkspaceKindListEnvelope {
  data: WorkspacekindsWorkspaceKind[];
}

export interface ApiWorkspaceListEnvelope {
  data: WorkspacesWorkspace[];
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

export interface WorkspacesWorkspace {
  activity: WorkspacesActivity;
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

/** Kubernetes YAML manifest of a WorkspaceKind */
export type CreateWorkspaceKindPayload = string;
