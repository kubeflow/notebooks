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
	"fmt"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"sigs.k8s.io/controller-runtime/pkg/client"

	commonassets "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common/assets"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds"
	assetmodels "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds/assets"
)

var ErrWorkspaceKindNotFound = errors.New("workspace kind not found")
var ErrWorkspaceKindAlreadyExists = errors.New("workspacekind already exists")

type WorkspaceKindRepository struct {
	client          client.Client
	configMapClient client.Client // filtered cache client for ConfigMaps with notebooks.kubeflow.org/image-source: true
}

func NewWorkspaceKindRepository(cl client.Client, configMapClient client.Client) *WorkspaceKindRepository {
	return &WorkspaceKindRepository{
		client:          cl,
		configMapClient: configMapClient,
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

	assetCtx := commonassets.NewAssetContextFromStatus(workspaceKind.Status.SpawnerIcon, workspaceKind.Status.SpawnerLogo)
	workspaceKindModel := models.NewWorkspaceKindModelFromWorkspaceKindWithAssetContext(workspaceKind, assetCtx)
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

		assetCtx := commonassets.NewAssetContextFromStatus(workspaceKind.Status.SpawnerIcon, workspaceKind.Status.SpawnerLogo)
		workspaceKindsModels[i] = models.NewWorkspaceKindModelFromWorkspaceKindWithAssetContext(workspaceKind, assetCtx)
	}

	return workspaceKindsModels, nil
}

func (r *WorkspaceKindRepository) Create(ctx context.Context, workspaceKind *kubefloworgv1beta1.WorkspaceKind) (*models.WorkspaceKind, error) {
	// create workspace kind
	if err := r.client.Create(ctx, workspaceKind); err != nil {
		if apierrors.IsAlreadyExists(err) {
			return nil, ErrWorkspaceKindAlreadyExists
		}
		if apierrors.IsInvalid(err) {
			// NOTE: we don't wrap this error so we can unpack it in the caller
			//       and extract the validation errors returned by the Kubernetes API server
			return nil, err
		}
		return nil, err
	}

	// convert the created workspace to a WorkspaceKindUpdate model
	//
	// TODO: this function should return the WorkspaceKindUpdate model, once the update WSK api is implemented
	//
	createdWorkspaceKindModel := models.NewWorkspaceKindModelFromWorkspaceKind(workspaceKind)

	return &createdWorkspaceKindModel, nil
}

// GetWorkspaceKindAsset retrieves a single asset (icon or logo) from a WorkspaceKind.
func (r *WorkspaceKindRepository) GetWorkspaceKindAsset(ctx context.Context, name string, assetType commonassets.WorkspaceKindAssetType) (commonassets.WorkspaceKindAsset, error) {
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	err := r.client.Get(ctx, client.ObjectKey{Name: name}, workspaceKind)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return commonassets.WorkspaceKindAsset{}, ErrWorkspaceKindNotFound
		}
		return commonassets.WorkspaceKindAsset{}, err
	}

	asset := assetmodels.NewWorkspaceKindAssetFromWorkspaceKind(workspaceKind, assetType)
	return asset, nil
}

// GetConfigMapContent retrieves the content from a ConfigMap referenced by a WorkspaceKindAsset.
// Returns the content as a string, or an error if the ConfigMap or key cannot be found.
func (r *WorkspaceKindRepository) GetConfigMapContent(ctx context.Context, asset commonassets.WorkspaceKindAsset) (string, error) {
	if asset.ConfigMap == nil {
		return "", fmt.Errorf("asset does not reference a ConfigMap")
	}

	configMap := &corev1.ConfigMap{}
	err := r.configMapClient.Get(ctx, client.ObjectKey{
		Namespace: asset.ConfigMap.Namespace,
		Name:      asset.ConfigMap.Name,
	}, configMap)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return "", commonassets.ErrWorkspaceKindAssetConfigMapNotFound
		}
		return "", commonassets.ErrWorkspaceKindAssetConfigMapUnknown
	}

	if data, exists := configMap.Data[asset.ConfigMap.Key]; exists {
		return data, nil
	}
	if binaryData, exists := configMap.BinaryData[asset.ConfigMap.Key]; exists {
		return string(binaryData), nil
	}

	return "", commonassets.ErrWorkspaceKindAssetConfigMapKeyNotFound
}
