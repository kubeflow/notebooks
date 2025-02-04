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

type Workspace struct {
	Name          string            `json:"name"`
	Namespace     string            `json:"namespace"`
	WorkspaceKind WorkspaceKindInfo `json:"workspace_kind"`
	DeferUpdates  bool              `json:"defer_updates"`
	Paused        bool              `json:"paused"`
	PausedTime    int64             `json:"paused_time"`
	State         WorkspaceState    `json:"state"`
	StateMessage  string            `json:"state_message"`
	PodTemplate   PodTemplate       `json:"pod_template"`
	Activity      Activity          `json:"activity"`
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
	PodMetadata PodMetadata        `json:"pod_metadata"`
	Volumes     PodVolumes         `json:"volumes"`
	Options     PodTemplateOptions `json:"options"`
}

type PodMetadata struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}

type PodVolumes struct {
	Home *PodVolumeInfo  `json:"home,omitempty"`
	Data []PodVolumeInfo `json:"data"`
}

type PodVolumeInfo struct {
	PvcName   string `json:"pvc_name"`
	MountPath string `json:"mount_path"`
	ReadOnly  bool   `json:"read_only"`
}

type PodTemplateOptions struct {
	ImageConfig ImageConfig `json:"image_config"`
	PodConfig   PodConfig   `json:"pod_config"`
}

type ImageConfig struct {
	Current       OptionInfo     `json:"current"`
	Desired       *OptionInfo    `json:"desired,omitempty"`
	RedirectChain []RedirectStep `json:"redirect_chain,omitempty"`
}

type PodConfig struct {
	Current       OptionInfo     `json:"current"`
	Desired       *OptionInfo    `json:"desired,omitempty"`
	RedirectChain []RedirectStep `json:"redirect_chain,omitempty"`
}

type OptionInfo struct {
	Id          string        `json:"id"`
	DisplayName string        `json:"display_name"`
	Description string        `json:"description"`
	Labels      []OptionLabel `json:"labels"`
}

type OptionLabel struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type RedirectStep struct {
	SourceId string           `json:"source_id"`
	TargetId string           `json:"target_id"`
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
	LastActivity int64          `json:"last_activity"` // Unix Epoch time
	LastUpdate   int64          `json:"last_update"`   // Unix Epoch time
	LastProbe    *LastProbeInfo `json:"last_probe,omitempty"`
}

type LastProbeInfo struct {
	StartTimeMs int64       `json:"start_time_ms"` // Unix Epoch time in milliseconds
	EndTimeMs   int64       `json:"end_time_ms"`   // Unix Epoch time in milliseconds
	Result      ProbeResult `json:"result"`
	Message     string      `json:"message"`
}

type ProbeResult string

const (
	ProbeResultSuccess ProbeResult = "Success"
	ProbeResultFailure ProbeResult = "Failure"
	ProbeResultTimeout ProbeResult = "Timeout"
)
