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

package storageclasses

import (
	"context"

	storagev1 "k8s.io/api/storage/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"

	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/storageclasses"
)

type StorageClassRepository struct {
	client client.Client
}

func NewStorageClassRepository(cl client.Client) *StorageClassRepository {
	return &StorageClassRepository{
		client: cl,
	}
}

func (r *StorageClassRepository) GetStorageClasses(ctx context.Context) ([]models.StorageClassListItem, error) {
	storageClassList := &storagev1.StorageClassList{}
	err := r.client.List(ctx, storageClassList)
	if err != nil {
		return nil, err
	}

	storageClasses := make([]models.StorageClassListItem, len(storageClassList.Items))
	for i := range storageClassList.Items {
		storageClass := &storageClassList.Items[i]
		storageClasses[i] = models.NewStorageClassListItemFromStorageClass(storageClass)
	}
	return storageClasses, nil
}
