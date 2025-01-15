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

package models

type WorkspaceModel struct {
	Name          string        `json:"name"`
	Namespace     string        `json:"namespace"`
	WorkspaceKind WorkspaceKind `json:"workspace_kind"`
	DeferUpdates  bool          `json:"defer_updates"`
	Paused        bool          `json:"paused"`
	PausedTime    int64         `json:"paused_time"`
	State         string        `json:"state"`
	StateMessage  string        `json:"state_message"`
	PodTemplate   PodTemplate   `json:"pod_template"`
	Activity      Activity      `json:"activity"`
}
type PodTemplate struct {
	PodMetadata *PodMetadata `json:"pod_metadata"`
	Volumes     *Volumes     `json:"volumes"`
	ImageConfig *ImageConfig `json:"image_config"`
	PodConfig   *PodConfig   `json:"pod_config"`
}

type PodMetadata struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}
type Volumes struct {
	Home *DataVolumeModel  `json:"home"`
	Data []DataVolumeModel `json:"data"`
}

type ImageConfig struct {
	Current       string           `json:"current"`
	Desired       string           `json:"desired"`
	RedirectChain []*RedirectChain `json:"redirect_chain"`
}

type PodConfig struct {
	Current       string           `json:"current"`
	Desired       string           `json:"desired"`
	RedirectChain []*RedirectChain `json:"redirect_chain"`
}

type RedirectChain struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type Activity struct {
	LastActivity int64  `json:"last_activity"` // Unix Epoch time
	LastUpdate   int64  `json:"last_update"`   // Unix Epoch time
	LastProbe    *Probe `json:"last_probe"`
}

type Probe struct {
	StartTimeMs int64  `json:"start_time_ms"` // Unix Epoch time in milliseconds
	EndTimeMs   int64  `json:"end_time_ms"`   // Unix Epoch time in milliseconds
	Result      string `json:"result"`
	Message     string `json:"message"`
}

type WorkspaceKind struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type DataVolumeModel struct {
	PvcName   string `json:"pvc_name"`
	MountPath string `json:"mount_path"`
	ReadOnly  bool   `json:"read_only"`
}
