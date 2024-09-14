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
	"context"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	client "sigs.k8s.io/controller-runtime/pkg/client"
)

type WorkspaceModel struct {
	Name   string `json:"name"`
	Kind   string `json:"kind"`
	Image  string `json:"image"`
	Config string `json:"config"`
}

func (m WorkspaceModel) GetWorkspaces(ctx context.Context, reader client.Client, namespace string) ([]WorkspaceModel, error) {

	workspaceList := &kubefloworgv1beta1.WorkspaceList{}
	listOptions := []client.ListOption{
		client.InNamespace(namespace),
	}

	err := reader.List(ctx, workspaceList, listOptions...)
	if err != nil {
		return nil, err
	}

	var workspacesModels []WorkspaceModel
	for _, item := range workspaceList.Items {
		workspace := WorkspaceModel{
			Name:   item.ObjectMeta.Name,
			Kind:   item.Spec.Kind,
			Image:  item.Spec.PodTemplate.Options.ImageConfig,
			Config: item.Spec.PodTemplate.Options.PodConfig,
			//todo add other field for workspaces
		}
		workspacesModels = append(workspacesModels, workspace)
	}

	return workspacesModels, nil
}
