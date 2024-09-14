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
package data

import (
	"github.com/kubeflow/notebooks/workspaces/backend/integrations"
)

type WorkspaceModel struct {
	Name   string `json:"name"`
	Kind   string `json:"kind"`
	Image  string `json:"image"`
	Config string `json:"config"`
}

func (m WorkspaceModel) GetWorkspaces(client *integrations.KubernetesClient, namespace string) ([]WorkspaceModel, error) {

	workspaces, err := client.GetWorkspaces(namespace)
	if err != nil {
		return nil, err
	}

	var workspacesModels []WorkspaceModel
	for _, item := range workspaces {
		workspace := WorkspaceModel{
			Name:   item.ObjectMeta.Name,
			Kind:   item.Spec.Kind,
			Image:  item.Spec.PodTemplate.Options.ImageConfig,
			Config: item.Spec.PodTemplate.Options.PodConfig,
		}
		workspacesModels = append(workspacesModels, workspace)
	}

	return workspacesModels, nil
}
