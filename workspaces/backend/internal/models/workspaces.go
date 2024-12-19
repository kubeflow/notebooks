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

import (
	"context"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

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

func NewWorkspaceModelFromWorkspace(ctx context.Context, cl client.Client, item *kubefloworgv1beta1.Workspace) WorkspaceModel {
	// t := time.Unix(item.Status.Activity.LastActivity, 0)
	// formattedLastActivity := t.Format("2006-01-02 15:04:05 MST")

	wsk := &kubefloworgv1beta1.WorkspaceKind{}
	if err := cl.Get(ctx, client.ObjectKey{Name: item.Spec.Kind}, wsk); err != nil {
		return WorkspaceModel{}
	}

	dataVolumes := make([]DataVolumeModel, len(item.Spec.PodTemplate.Volumes.Data))
	for i, volume := range item.Spec.PodTemplate.Volumes.Data {
		dataVolumes[i] = DataVolumeModel{
			PvcName:   volume.PVCName,
			MountPath: volume.MountPath,
			ReadOnly:  *volume.ReadOnly,
		}
	}

	imageConfigRedirectChain := make([]*RedirectChain, len(item.Status.PodTemplateOptions.ImageConfig.RedirectChain))
	for i, chain := range item.Status.PodTemplateOptions.ImageConfig.RedirectChain {
		imageConfigRedirectChain[i] = &RedirectChain{
			Source: chain.Source,
			Target: chain.Target,
		}
	}

	podConfigRedirectChain := make([]*RedirectChain, len(item.Status.PodTemplateOptions.PodConfig.RedirectChain))

	for i, chain := range item.Status.PodTemplateOptions.PodConfig.RedirectChain {
		podConfigRedirectChain[i] = &RedirectChain{
			Source: chain.Source,
			Target: chain.Target,
		}
	}

	podMetadataLabels := item.Spec.PodTemplate.PodMetadata.Labels
	if podMetadataLabels == nil {
		podMetadataLabels = map[string]string{}
	}

	podMetadataAnnotations := item.Spec.PodTemplate.PodMetadata.Annotations
	if podMetadataAnnotations == nil {
		podMetadataAnnotations = map[string]string{}
	}

	workspaceModel := WorkspaceModel{
		Name:      item.ObjectMeta.Name,
		Namespace: item.Namespace,
		WorkspaceKind: WorkspaceKind{
			Name: item.Spec.Kind,
			Type: "POD_TEMPLATE",
		},
		DeferUpdates: *item.Spec.DeferUpdates,
		Paused:       *item.Spec.Paused,
		PausedTime:   item.Status.PauseTime,
		State:        string(item.Status.State),
		StateMessage: item.Status.StateMessage,
		PodTemplate: PodTemplate{
			PodMetadata: &PodMetadata{
				Labels:      podMetadataLabels,
				Annotations: podMetadataAnnotations,
			},
			Volumes: &Volumes{
				Home: &DataVolumeModel{
					PvcName:   *item.Spec.PodTemplate.Volumes.Home,
					MountPath: wsk.Spec.PodTemplate.VolumeMounts.Home,
					ReadOnly:  false, // From where to get this value?
				},
				Data: dataVolumes,
			},
			ImageConfig: &ImageConfig{
				Current:       item.Spec.PodTemplate.Options.ImageConfig,
				Desired:       item.Status.PodTemplateOptions.ImageConfig.Desired,
				RedirectChain: imageConfigRedirectChain,
			},
			PodConfig: &PodConfig{
				Current:       item.Spec.PodTemplate.Options.PodConfig,
				Desired:       item.Spec.PodTemplate.Options.PodConfig,
				RedirectChain: podConfigRedirectChain,
			},
		},
		Activity: Activity{
			LastActivity: item.Status.Activity.LastActivity,
			LastUpdate:   item.Status.Activity.LastUpdate,
			// TODO: update these fields when the last probe is implemented
			LastProbe: &Probe{
				StartTimeMs: 0,
				EndTimeMs:   0,
				Result:      "default_result",
				Message:     "default_message",
			},
		},
	}
	return workspaceModel
}
