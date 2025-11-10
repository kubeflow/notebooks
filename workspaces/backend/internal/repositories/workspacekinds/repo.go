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
	"time"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	commonAssets "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common/assets"
	modelsCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds"
	modelsAssets "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds/assets"
	modelsPodTemplateOptions "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds/podtemplate/options"
)

var ErrWorkspaceKindNotFound = errors.New("workspace kind not found")
var ErrWorkspaceKindAlreadyExists = errors.New("workspacekind already exists")
var ErrWorkspaceKindRevisionConflict = errors.New("current workspace kind revision does not match request")

type WorkspaceKindRepository struct {
	cfg             *config.EnvConfig
	client          client.Client
	configMapClient client.Client // filtered cache client for ConfigMaps with notebooks.kubeflow.org/image-source: true
}

func NewWorkspaceKindRepository(cfg *config.EnvConfig, cl client.Client, configMapClient client.Client) *WorkspaceKindRepository {
	return &WorkspaceKindRepository{
		cfg:             cfg,
		client:          cl,
		configMapClient: configMapClient,
	}
}

func (r *WorkspaceKindRepository) GetWorkspaceKind(ctx context.Context, name string) (*models.WorkspaceKindUpdate, error) {
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	err := r.client.Get(ctx, client.ObjectKey{Name: name}, workspaceKind)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, ErrWorkspaceKindNotFound
		}
		return nil, err
	}

	workspaceKindModel := models.NewWorkspaceKindUpdateModelFromWorkspaceKind(r.cfg, workspaceKind)
	return workspaceKindModel, nil
}

func (r *WorkspaceKindRepository) GetWorkspaceKinds(ctx context.Context) ([]models.WorkspaceKindListItem, error) {
	workspaceKindList := &kubefloworgv1beta1.WorkspaceKindList{}
	err := r.client.List(ctx, workspaceKindList)
	if err != nil {
		return nil, err
	}

	workspaceKindsModels := make([]models.WorkspaceKindListItem, len(workspaceKindList.Items))
	for i := range workspaceKindList.Items {
		workspaceKindsModels[i] = models.NewWorkspaceKindModelFromWorkspaceKind(r.cfg, &workspaceKindList.Items[i])
	}

	return workspaceKindsModels, nil
}

func (r *WorkspaceKindRepository) Create(ctx context.Context, workspaceKind *kubefloworgv1beta1.WorkspaceKind) (*models.WorkspaceKindCreate, error) {
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

	createdWorkspaceKindModel := models.NewWorkspaceKindCreateModelFromWorkspaceKind(workspaceKind)
	return createdWorkspaceKindModel, nil
}

func (r *WorkspaceKindRepository) UpdateWorkspaceKind(ctx context.Context, workspaceKindUpdate *models.WorkspaceKindUpdate, name string) (*models.WorkspaceKindUpdate, error) {
	// TODO: get actual user email from request context
	actor := "mock@example.com"
	now := time.Now()

	// get workspace kind
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := r.client.Get(ctx, client.ObjectKey{Name: name}, workspaceKind); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, ErrWorkspaceKindNotFound
		}
		return nil, err
	}

	// ensure caller's revision matches current workspace kind revision
	// prevents updates by callers with a stale view of the workspace kind
	clusterRevision := modelsCommon.CalculateRevision(&workspaceKind.ObjectMeta)
	callerRevision := workspaceKindUpdate.Revision
	if clusterRevision != callerRevision {
		return nil, ErrWorkspaceKindRevisionConflict
	}

	// apply the update to the workspace kind object
	models.ApplyWorkspaceKindUpdateModelToWorkspaceKind(workspaceKindUpdate, workspaceKind)

	// set audit annotations
	modelsCommon.UpdateObjectMetaForUpdate(&workspaceKind.ObjectMeta, actor, now)

	// update the workspace kind in K8s
	// TODO: if the update fails due to a kubernetes conflict, this implies our cache is stale.
	//       we should retry the entire update operation a few times (including recalculating clusterRevision)
	//       before returning a 500 error to the caller (DO NOT return a 409, as it's not the caller's fault)
	if err := r.client.Update(ctx, workspaceKind); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, ErrWorkspaceKindNotFound
		}
		if apierrors.IsInvalid(err) {
			// NOTE: we don't wrap this error so we can unpack it in the caller
			//       and extract the validation errors returned by the Kubernetes API server
			return nil, err
		}
		return nil, err
	}

	workspaceKindUpdateModel := models.NewWorkspaceKindUpdateModelFromWorkspaceKind(workspaceKind)
	return workspaceKindUpdateModel, nil
}

func (r *WorkspaceKindRepository) DeleteWorkspaceKind(ctx context.Context, name string) error {
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
		},
	}

	if err := r.client.Delete(ctx, workspaceKind); err != nil {
		if apierrors.IsNotFound(err) {
			return ErrWorkspaceKindNotFound
		}
		return err
	}

	return nil
}

func (r *WorkspaceKindRepository) ListPodTemplateOptionsValues(ctx context.Context, name string, listValuesRequest *modelsPodTemplateOptions.ListValuesRequest) (*modelsPodTemplateOptions.PodTemplateOptions, error) {
	// get workspace kind
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	err := r.client.Get(ctx, client.ObjectKey{Name: name}, workspaceKind)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, ErrWorkspaceKindNotFound
		}
		return nil, err
	}

	// convert the WorkspaceKind and ListValuesRequest to PodTemplateOptions model
	listValuesResponse, err := modelsPodTemplateOptions.NewPodTemplateOptionsModelFromWorkspaceKind(workspaceKind, listValuesRequest)
	if err != nil {
		return nil, err
	}

	return listValuesResponse, nil
}

// GetWorkspaceKindAsset retrieves a single asset (icon or logo) from a WorkspaceKind.
func (r *WorkspaceKindRepository) GetWorkspaceKindAsset(ctx context.Context, name string, assetType commonAssets.WorkspaceKindAssetType) (commonAssets.WorkspaceKindAsset, error) {
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	err := r.client.Get(ctx, client.ObjectKey{Name: name}, workspaceKind)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return commonAssets.WorkspaceKindAsset{}, ErrWorkspaceKindNotFound
		}
		return commonAssets.WorkspaceKindAsset{}, err
	}

	asset := modelsAssets.NewWorkspaceKindAssetFromWorkspaceKind(workspaceKind, assetType)
	return asset, nil
}

// GetConfigMapContent retrieves the content from a ConfigMap referenced by a WorkspaceKindAsset.
// Returns the content as a string, or an error if the ConfigMap or key cannot be found.
func (r *WorkspaceKindRepository) GetConfigMapContent(ctx context.Context, asset commonAssets.WorkspaceKindAsset) (string, error) {
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
			return "", commonAssets.ErrWorkspaceKindAssetConfigMapNotFound
		}
		return "", commonAssets.ErrWorkspaceKindAssetConfigMapUnknown
	}

	if data, exists := configMap.Data[asset.ConfigMap.Key]; exists {
		return data, nil
	}
	if binaryData, exists := configMap.BinaryData[asset.ConfigMap.Key]; exists {
		return string(binaryData), nil
	}

	return "", commonAssets.ErrWorkspaceKindAssetConfigMapKeyNotFound
}
