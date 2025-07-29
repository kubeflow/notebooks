export enum WorkspaceServiceStatus {
  ServiceStatusHealthy = 'Healthy',
  ServiceStatusUnhealthy = 'Unhealthy',
}

export interface WorkspaceSystemInfo {
  version: string;
}

export interface HealthCheckResponse {
  status: WorkspaceServiceStatus;
  systemInfo: WorkspaceSystemInfo;
}

export interface Namespace {
  name: string;
}

export interface WorkspaceImageRef {
  url: string;
}

export interface WorkspacePodConfigValue {
  id: string;
  displayName: string;
  description: string;
  labels: WorkspaceOptionLabel[];
  hidden: boolean;
  redirect?: WorkspaceOptionRedirect;
  clusterMetrics?: WorkspaceKindClusterMetrics;
}

export interface WorkspaceKindPodConfig {
  default: string;
  values: WorkspacePodConfigValue[];
}

export interface WorkspaceKindPodMetadata {
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

export interface WorkspacePodVolumeMounts {
  home: string;
}

export interface WorkspaceOptionLabel {
  key: string;
  value: string;
}

export enum WorkspaceRedirectMessageLevel {
  RedirectMessageLevelInfo = 'Info',
  RedirectMessageLevelWarning = 'Warning',
  RedirectMessageLevelDanger = 'Danger',
}

export interface WorkspaceRedirectMessage {
  text: string;
  level: WorkspaceRedirectMessageLevel;
}

export interface WorkspaceOptionRedirect {
  to: string;
  message?: WorkspaceRedirectMessage;
}

export interface WorkspaceImageConfigValue {
  id: string;
  displayName: string;
  description: string;
  labels: WorkspaceOptionLabel[];
  hidden: boolean;
  redirect?: WorkspaceOptionRedirect;
  clusterMetrics?: WorkspaceKindClusterMetrics;
}

export interface WorkspaceKindImageConfig {
  default: string;
  values: WorkspaceImageConfigValue[];
}

export interface WorkspaceKindPodTemplateOptions {
  imageConfig: WorkspaceKindImageConfig;
  podConfig: WorkspaceKindPodConfig;
}

export interface WorkspaceKindPodTemplate {
  podMetadata: WorkspaceKindPodMetadata;
  volumeMounts: WorkspacePodVolumeMounts;
  options: WorkspaceKindPodTemplateOptions;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type WorkspaceKindCreate = string;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkspaceKindUpdate {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkspaceKindPatch {}

export interface WorkspaceKind {
  name: string;
  displayName: string;
  description: string;
  deprecated: boolean;
  deprecationMessage: string;
  hidden: boolean;
  icon: WorkspaceImageRef;
  logo: WorkspaceImageRef;
  clusterMetrics?: WorkspaceKindClusterMetrics;
  podTemplate: WorkspaceKindPodTemplate;
}

export interface WorkspaceKindClusterMetrics {
  workspacesCount: number;
}

export enum WorkspaceState {
  WorkspaceStateRunning = 'Running',
  WorkspaceStateTerminating = 'Terminating',
  WorkspaceStatePaused = 'Paused',
  WorkspaceStatePending = 'Pending',
  WorkspaceStateError = 'Error',
  WorkspaceStateUnknown = 'Unknown',
}

export interface WorkspaceKindInfo {
  name: string;
  missing: boolean;
  icon: WorkspaceImageRef;
  logo: WorkspaceImageRef;
}

export interface WorkspacePodMetadata {
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

export interface WorkspacePodVolumeInfo {
  pvcName: string;
  mountPath: string;
  readOnly: boolean;
}

export interface WorkspacePodSecretInfo {
  secretName: string;
  mountPath: string;
  defaultMode?: number;
}

export interface WorkspaceOptionInfo {
  id: string;
  displayName: string;
  description: string;
  labels: WorkspaceOptionLabel[];
}

export interface WorkspaceRedirectStep {
  sourceId: string;
  targetId: string;
  message?: WorkspaceRedirectMessage;
}

export interface WorkspaceImageConfig {
  current: WorkspaceOptionInfo;
  desired?: WorkspaceOptionInfo;
  redirectChain?: WorkspaceRedirectStep[];
}

export interface WorkspacePodConfig {
  current: WorkspaceOptionInfo;
  desired?: WorkspaceOptionInfo;
  redirectChain?: WorkspaceRedirectStep[];
}

export interface WorkspacePodTemplateOptions {
  imageConfig: WorkspaceImageConfig;
  podConfig: WorkspacePodConfig;
}

export interface WorkspacePodVolumes {
  home?: WorkspacePodVolumeInfo;
  data: WorkspacePodVolumeInfo[];
  secrets?: WorkspacePodSecretInfo[];
}

export interface WorkspacePodTemplate {
  podMetadata: WorkspacePodMetadata;
  volumes: WorkspacePodVolumes;
  options: WorkspacePodTemplateOptions;
}

export enum WorkspaceProbeResult {
  ProbeResultSuccess = 'Success',
  ProbeResultFailure = 'Failure',
  ProbeResultTimeout = 'Timeout',
}

export interface WorkspaceLastProbeInfo {
  startTimeMs: number;
  endTimeMs: number;
  result: WorkspaceProbeResult;
  message: string;
}

export interface WorkspaceActivity {
  lastActivity: number;
  lastUpdate: number;
  lastProbe?: WorkspaceLastProbeInfo;
}

export interface WorkspaceHttpService {
  displayName: string;
  httpPath: string;
}

export interface WorkspaceService {
  httpService?: WorkspaceHttpService;
}

export interface WorkspacePodMetadataMutate {
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

export interface WorkspacePodVolumeMount {
  pvcName: string;
  mountPath: string;
  readOnly?: boolean;
}

export interface WorkspacePodSecretMount {
  secretName: string;
  mountPath: string;
  defaultMode?: number;
}

export interface WorkspacePodVolumesMutate {
  home?: string;
  data?: WorkspacePodVolumeMount[];
  secrets?: WorkspacePodSecretMount[];
}

export interface WorkspacePodTemplateOptionsMutate {
  imageConfig: string;
  podConfig: string;
}

export interface WorkspacePodTemplateMutate {
  podMetadata: WorkspacePodMetadataMutate;
  volumes: WorkspacePodVolumesMutate;
  options: WorkspacePodTemplateOptionsMutate;
}

export interface Workspace {
  name: string;
  namespace: string;
  workspaceKind: WorkspaceKindInfo;
  deferUpdates: boolean;
  paused: boolean;
  pausedTime: number;
  pendingRestart: boolean;
  state: WorkspaceState;
  stateMessage: string;
  podTemplate: WorkspacePodTemplate;
  activity: WorkspaceActivity;
  services: WorkspaceService[];
}

export interface WorkspaceCreate {
  name: string;
  kind: string;
  paused: boolean;
  deferUpdates: boolean;
  podTemplate: WorkspacePodTemplateMutate;
}

// TODO: Update this type when applicable; meanwhile, it inherits from WorkspaceCreate
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkspaceUpdate extends WorkspaceCreate {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkspacePatch {}

export interface WorkspacePauseState {
  paused: boolean;
}

export enum FieldErrorType {
  FieldValueRequired = 'FieldValueRequired',
  FieldValueInvalid = 'FieldValueInvalid',
  FieldValueNotSupported = 'FieldValueNotSupported',
  FieldValueDuplicate = 'FieldValueDuplicate',
  FieldValueTooLong = 'FieldValueTooLong',
  FieldValueForbidden = 'FieldValueForbidden',
  FieldValueNotFound = 'FieldValueNotFound',
  FieldValueConflict = 'FieldValueConflict',
  FieldValueTooShort = 'FieldValueTooShort',
  FieldValueUnknown = 'FieldValueUnknown',
}

export interface ValidationError {
  type: FieldErrorType;
  field: string;
  message: string;
}

export interface ErrorCause {
  validation_errors?: ValidationError[]; // TODO: backend is not using camelCase for this field
}

export type HTTPError = {
  code: string;
  message: string;
  cause?: ErrorCause;
};

export type ErrorEnvelope = {
  error: HTTPError | null;
};
