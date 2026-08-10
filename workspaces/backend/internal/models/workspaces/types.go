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
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"

	commonCore "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	commonAssets "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common/assets"
)

// WorkspaceListItem represents a workspace in the system, and is returned by LIST operations.
// NOTE: this type is not used for GET, CREATE or UPDATE operations, see WorkspaceUpdate and WorkspaceCreate
// TODO: we need to validate which fields should actually be returned in the response
//   - should only be returning fields relevant to the list view in the UI
type WorkspaceListItem struct {
	Name string `json:"name"`
	// DisplayName is an optional human-readable name for the workspace.
	DisplayName     string                            `json:"displayName,omitempty"`
	Namespace       string                            `json:"namespace"`
	WorkspaceKind   WorkspaceKindInfo                 `json:"workspaceKind"`
	Paused          bool                              `json:"paused"`
	PausedTime      int64                             `json:"pausedTime"`      // Unix Epoch time in milliseconds
	LastRunningTime int64                             `json:"lastRunningTime"` // Unix Epoch time in milliseconds
	State           kubefloworgv1beta1.WorkspaceState `json:"state"`
	StateMessage    string                            `json:"stateMessage"`
	PodTemplate     PodTemplate                       `json:"podTemplate"`
	Activity        Activity                          `json:"activity"`
	Services        []Service                         `json:"services"`
	Audit           commonCore.Audit                  `json:"audit"`
}

type WorkspaceKindInfo struct {
	Name    string                `json:"name"`
	Missing bool                  `json:"missing"`
	Icon    commonAssets.ImageRef `json:"icon"`
	Logo    commonAssets.ImageRef `json:"logo"`
}

type PodTemplate struct {
	Options PodTemplateOptions `json:"options"`
}

type PodTemplateOptions struct {
	ImageConfig ImageConfig `json:"imageConfig"`
	PodConfig   PodConfig   `json:"podConfig"`
}

type ImageConfig struct {
	Current       OptionInfo     `json:"current"`
	RedirectChain []RedirectStep `json:"redirectChain,omitempty"`
}

type PodConfig struct {
	Current       OptionInfo     `json:"current"`
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
	Source  OptionInfo       `json:"source"`
	Target  OptionInfo       `json:"target"`
	Message *RedirectMessage `json:"message,omitempty"`
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
	LastActivity int64          `json:"lastActivity"` // Unix Epoch time in milliseconds
	LastUpdate   int64          `json:"lastUpdate"`   // Unix Epoch time in milliseconds
	LastProbe    *LastProbeInfo `json:"lastProbe,omitempty"`
	Rules        *ActivityRules `json:"rules,omitempty"`
}

type LastProbeInfo struct {
	StartTime int64       `json:"startTime"` // Unix Epoch time in milliseconds
	EndTime   int64       `json:"endTime"`   // Unix Epoch time in milliseconds
	Result    ProbeResult `json:"result"`
	Message   string      `json:"message"`
}

type ProbeResult string

const (
	ProbeResultSuccess ProbeResult = "Success"
	ProbeResultFailure ProbeResult = "Failure"
	ProbeResultTimeout ProbeResult = "Timeout"
)

type ActivityRules struct {
	PauseWorkspace *ActivityPauseRule `json:"pauseWorkspace,omitempty"`
}

type ActivityPauseRule struct {
	EligibleAfter int64 `json:"eligibleAfter"` // Unix Epoch time in milliseconds
}

type Service struct {
	HttpService *HttpService `json:"httpService,omitempty"`
}

type HttpService struct {
	DisplayName string `json:"displayName"`
	HttpPath    string `json:"httpPath"`
}
