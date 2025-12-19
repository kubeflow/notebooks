/*
Copyright 2024.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package workspaces

import (
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
)

// WorkspaceListItem represents a workspace in the system, and is returned by LIST operations.
// NOTE: this type is not used for GET, CREATE or UPDATE operations, see WorkspaceUpdate and WorkspaceCreate
// TODO: we need to validate which fields should actually be returned in the response
//   - should only be returning fields relevant to the list view in the UI
type WorkspaceListItem struct {
	Name           string            `json:"name"`
	Namespace      string            `json:"namespace"`
	WorkspaceKind  WorkspaceKindInfo `json:"workspaceKind"`
	Paused         bool              `json:"paused"`
	PausedTime     int64             `json:"pausedTime"`
	PendingRestart bool              `json:"pendingRestart"`
	State          WorkspaceState    `json:"state"`
	StateMessage   string            `json:"stateMessage"`
	PodTemplate    PodTemplate       `json:"podTemplate"`
	Activity       Activity          `json:"activity"`
	Services       []Service         `json:"services"`
	Audit          common.Audit      `json:"audit"`
}

type WorkspaceState string

const (
	WorkspaceStateRunning     WorkspaceState = "Running"
	WorkspaceStateTerminating WorkspaceState = "Terminating"
	WorkspaceStatePaused      WorkspaceState = "Paused"
	WorkspaceStatePending     WorkspaceState = "Pending"
	WorkspaceStateError       WorkspaceState = "Error"
	WorkspaceStateUnknown     WorkspaceState = "Unknown"
)

type WorkspaceKindInfo struct {
	Name    string   `json:"name"`
	Missing bool     `json:"missing"`
	Icon    ImageRef `json:"icon"`
	Logo    ImageRef `json:"logo"`
}

type ImageRef struct {
	URL string `json:"url"`
}

type PodTemplate struct {
	PodMetadata PodMetadata        `json:"podMetadata"`
	Volumes     PodVolumes         `json:"volumes"`
	Options     PodTemplateOptions `json:"options"`
}

type PodMetadata struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}

type PodVolumes struct {
	Home    *PodVolumeInfo  `json:"home,omitempty"`
	Data    []PodVolumeInfo `json:"data"`
	Secrets []PodSecretInfo `json:"secrets,omitempty"`
}

type PodVolumeInfo struct {
	PVCName   string `json:"pvcName"`
	MountPath string `json:"mountPath"`
	ReadOnly  bool   `json:"readOnly"`
}

type PodSecretInfo struct {
	SecretName  string `json:"secretName"`
	MountPath   string `json:"mountPath"`
	DefaultMode int32  `json:"defaultMode,omitempty"`
}

type PodTemplateOptions struct {
	ImageConfig ImageConfig `json:"imageConfig"`
	PodConfig   PodConfig   `json:"podConfig"`
}

type ImageConfig struct {
	Current       OptionInfo     `json:"current"`
	Desired       *OptionInfo    `json:"desired,omitempty"`
	RedirectChain []RedirectStep `json:"redirectChain,omitempty"`
}

type PodConfig struct {
	Current       OptionInfo     `json:"current"`
	Desired       *OptionInfo    `json:"desired,omitempty"`
	RedirectChain []RedirectStep `json:"redirectChain,omitempty"`
}

type OptionInfo struct {
	Id          string        `json:"id"`
	DisplayName string        `json:"displayName"`
	Description string        `json:"description"`
	Labels      []OptionLabel `json:"labels"`
}

type OptionLabel struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type RedirectStep struct {
	SourceId string           `json:"sourceId"`
	TargetId string           `json:"targetId"`
	Message  *RedirectMessage `json:"message,omitempty"`
}

type RedirectMessage struct {
	Text  string               `json:"text"`
	Level RedirectMessageLevel `json:"level"`
}

type RedirectMessageLevel string

const (
	RedirectMessageLevelInfo    RedirectMessageLevel = "Info"
	RedirectMessageLevelWarning RedirectMessageLevel = "Warning"
	RedirectMessageLevelDanger  RedirectMessageLevel = "Danger"
)

type Activity struct {
	LastActivity int64          `json:"lastActivity"` // Unix Epoch time
	LastUpdate   int64          `json:"lastUpdate"`   // Unix Epoch time
	LastProbe    *LastProbeInfo `json:"lastProbe,omitempty"`
}

type LastProbeInfo struct {
	StartTimeMs int64       `json:"startTimeMs"` // Unix Epoch time in milliseconds
	EndTimeMs   int64       `json:"endTimeMs"`   // Unix Epoch time in milliseconds
	Result      ProbeResult `json:"result"`
	Message     string      `json:"message"`
}

type ProbeResult string

const (
	ProbeResultSuccess ProbeResult = "Success"
	ProbeResultFailure ProbeResult = "Failure"
	ProbeResultTimeout ProbeResult = "Timeout"
)

type Service struct {
	HttpService *HttpService `json:"httpService,omitempty"`
}

type HttpService struct {
	DisplayName string `json:"displayName"`
	HttpPath    string `json:"httpPath"`
}
