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

	v1 "k8s.io/api/core/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models"
)

type NamespaceRepository struct {
	client client.Client
}

func NewNamespaceRepository(cl client.Client) *NamespaceRepository {
	return &NamespaceRepository{
		client: cl,
	}
}

func (r *NamespaceRepository) GetNamespaces(ctx context.Context) ([]models.NamespaceModel, error) {

	// TODO(ederign): Implement subject access review here to fetch only
	//                namespaces that "kubeflow-userid" has access to
	namespaceList := &v1.NamespaceList{}
	err := r.client.List(ctx, namespaceList, &client.ListOptions{})
	if err != nil {
		return nil, err
	}

	namespaces := make([]models.NamespaceModel, len(namespaceList.Items))
	for i, ns := range namespaceList.Items {
		namespaces[i] = models.NewNamespaceModelFromNamespace(ns.Name)
	}
	return namespaces, nil
}
