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

package workspacekinds

import (
	"context"
	"errors"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"sigs.k8s.io/controller-runtime/pkg/client"

	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds"
)

var ErrWorkspaceKindNotFound = errors.New("workspace kind not found")

type WorkspaceKindRepository struct {
	client client.Client
}

func NewWorkspaceKindRepository(cl client.Client) *WorkspaceKindRepository {
	return &WorkspaceKindRepository{
		client: cl,
	}
}

func (r *WorkspaceKindRepository) GetWorkspaceKind(ctx context.Context, name string) (models.WorkspaceKind, error) {
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	err := r.client.Get(ctx, client.ObjectKey{Name: name}, workspaceKind)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return models.WorkspaceKind{}, ErrWorkspaceKindNotFound
		}
		return models.WorkspaceKind{}, err
	}

	workspaceKindModel := models.NewWorkspaceKindModelFromWorkspaceKind(workspaceKind)
	return workspaceKindModel, nil
}

func (r *WorkspaceKindRepository) GetWorkspaceKinds(ctx context.Context) ([]models.WorkspaceKind, error) {
	workspaceKindList := &kubefloworgv1beta1.WorkspaceKindList{}

	err := r.client.List(ctx, workspaceKindList)
	if err != nil {
		return nil, err
	}

	workspaceKindsModels := make([]models.WorkspaceKind, len(workspaceKindList.Items))
	for i := range workspaceKindList.Items {
		workspaceKind := &workspaceKindList.Items[i]
		workspaceKindsModels[i] = models.NewWorkspaceKindModelFromWorkspaceKind(workspaceKind)
	}

	return workspaceKindsModels, nil
}
