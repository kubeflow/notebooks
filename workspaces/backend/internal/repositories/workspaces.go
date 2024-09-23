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

package repositories

import (
	"context"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/models"
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

type WorkspaceRepository struct {
	client client.Client
}

func NewWorkspaceRepository(client client.Client) *WorkspaceRepository {
	return &WorkspaceRepository{
		client: client,
	}
}

func (r *WorkspaceRepository) GetWorkspaces(ctx context.Context, namespace string) ([]models.WorkspaceModel, error) {
	workspaceList := &kubefloworgv1beta1.WorkspaceList{}
	listOptions := []client.ListOption{
		client.InNamespace(namespace),
	}
	err := r.client.List(ctx, workspaceList, listOptions...)
	if err != nil {
		return nil, err
	}

	workspacesModels := make([]models.WorkspaceModel, 0, len(workspaceList.Items))

	for _, item := range workspaceList.Items {
		workspaceModel := models.NewWorkspaceModelFromWorkspace(&item)
		workspacesModels = append(workspacesModels, workspaceModel)
	}

	return workspacesModels, nil
}
