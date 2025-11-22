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
	"crypto/sha256"
	"encoding/hex"
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

		// TODO: should we use a cache here to avoid recomputing the hash for the same asset?
		// Compute SHA256 hashes for ConfigMap-based assets
		// Capture errors to populate ImageRef.Error field
		assetCtx := r.getWorkspaceKindAssetContext(ctx, workspaceKind)

		workspaceKindsModels[i] = models.NewWorkspaceKindModelFromWorkspaceKindWithAssetContext(workspaceKind, assetCtx)
	}

	return workspaceKindsModels, nil
}

// getWorkspaceKindAssetContext computes the SHA256 hashes for both icon and logo assets of a WorkspaceKind.
// Returns a WorkspaceKindAssetContext containing the SHA256 hashes and any errors encountered during retrieval.
func (r *WorkspaceKindRepository) getWorkspaceKindAssetContext(ctx context.Context, workspaceKind *kubefloworgv1beta1.WorkspaceKind) *commonassets.WorkspaceKindAssetContext {
	iconSHA256, iconErr := r.computeAssetSHA256(ctx, workspaceKind.Spec.Spawner.Icon)
	logoSHA256, logoErr := r.computeAssetSHA256(ctx, workspaceKind.Spec.Spawner.Logo)
	return commonassets.NewAssetContext(iconSHA256, logoSHA256, iconErr, logoErr)
}

// computeAssetSHA256 computes the SHA256 hash of a WorkspaceKindAsset if it uses a ConfigMap.
// Returns empty string if the asset does not use a ConfigMap or if there's an error retrieving the ConfigMap.
func (r *WorkspaceKindRepository) computeAssetSHA256(ctx context.Context, asset kubefloworgv1beta1.WorkspaceKindAsset) (string, error) {
	if asset.ConfigMap == nil {
		return "", nil
	}

	assetModel := commonassets.WorkspaceKindAsset{
		ConfigMap: &commonassets.WorkspaceKindAssetConfigMap{
			Name:      asset.ConfigMap.Name,
			Key:       asset.ConfigMap.Key,
			Namespace: asset.ConfigMap.Namespace,
		},
	}

	content, err := r.GetConfigMapContent(ctx, assetModel)
	if err != nil {
		return "", err
	}

	hash := sha256.Sum256([]byte(content))
	return hex.EncodeToString(hash[:]), nil
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

// GetWorkspaceKindAssets retrieves both icon and logo assets from a WorkspaceKind.
// It queries for the WorkspaceKind CRD once and converts both assets to the backend model.
// Returns icon as the first value and logo as the second value, matching the order they are defined in the CRD.
func (r *WorkspaceKindRepository) GetWorkspaceKindAssets(ctx context.Context, name string) (commonassets.WorkspaceKindAsset, commonassets.WorkspaceKindAsset, error) {
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	err := r.client.Get(ctx, client.ObjectKey{Name: name}, workspaceKind)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return commonassets.WorkspaceKindAsset{}, commonassets.WorkspaceKindAsset{}, ErrWorkspaceKindNotFound
		}
		return commonassets.WorkspaceKindAsset{}, commonassets.WorkspaceKindAsset{}, err
	}

	icon := assetmodels.NewWorkspaceKindAssetFromWorkspaceKind(workspaceKind, commonassets.WorkspaceKindAssetTypeIcon)
	logo := assetmodels.NewWorkspaceKindAssetFromWorkspaceKind(workspaceKind, commonassets.WorkspaceKindAssetTypeLogo)

	return icon, logo, nil
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
