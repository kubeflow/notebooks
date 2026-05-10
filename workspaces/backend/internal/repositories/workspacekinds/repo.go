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
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	modelsCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds"
	modelsPodTemplateOptions "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds/podtemplate/options"
)

var ErrWorkspaceKindNotFound = errors.New("workspace kind not found")
var ErrWorkspaceKindAlreadyExists = errors.New("workspacekind already exists")
var ErrWorkspaceKindRevisionConflict = errors.New("current workspace kind revision does not match request")
var ErrWorkspaceKindAssetConfigMapNotFound = fmt.Errorf("workspacekind asset configmap not found, or does not have %s=true label", helper.LabelImageSource)
var ErrWorkspaceKindAssetConfigMapKeyMissing = errors.New("workspacekind asset configmap missing expected key")
var ErrWorkspaceKindAssetNotConfigMap = errors.New("workspacekind asset does not reference a configmap")

type wskAssetType string

const (
	wskAssetTypeIcon wskAssetType = "icon"
	wskAssetTypeLogo wskAssetType = "logo"
)

type WorkspaceKindRepository struct {
	cfg             *config.EnvConfig
	client          client.Client
	configMapClient client.Client // filtered cache client for ConfigMaps with 'notebooks.kubeflow.org/image-source=true'
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

	workspaceKindModel := models.NewWorkspaceKindUpdateModelFromWorkspaceKind(workspaceKind)
	return workspaceKindModel, nil
}

func (r *WorkspaceKindRepository) GetWorkspaceKinds(ctx context.Context) ([]models.WorkspaceKindListItem, error) {
	workspaceKindList := &kubefloworgv1beta1.WorkspaceKindList{}
	err := r.client.List(ctx, workspaceKindList)
	if err != nil {
		return nil, err
	}

	workspaceKindsModels := make([]models.WorkspaceKindListItem, 0, len(workspaceKindList.Items))
	for _, wsk := range workspaceKindList.Items {
		if models.IsAPIHidden(&wsk) {
			continue
		}
		workspaceKindsModels = append(workspaceKindsModels, models.NewWorkspaceKindModelFromWorkspaceKind(r.cfg, &wsk))
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

// GetWorkspaceKindAssetBytesIcon retrieves the content of a WorkspaceKind icon as bytes, along with its media type.
func (r *WorkspaceKindRepository) GetWorkspaceKindAssetBytesIcon(ctx context.Context, name string) ([]byte, kubefloworgv1beta1.WorkspaceKindAssetMediaType, error) {
	return r.getWorkspaceKindAssetBytes(ctx, name, wskAssetTypeIcon)
}

// GetWorkspaceKindAssetBytesLogo retrieves the content of a WorkspaceKind logo as bytes, along with its media type.
func (r *WorkspaceKindRepository) GetWorkspaceKindAssetBytesLogo(ctx context.Context, name string) ([]byte, kubefloworgv1beta1.WorkspaceKindAssetMediaType, error) {
	return r.getWorkspaceKindAssetBytes(ctx, name, wskAssetTypeLogo)
}

func (r *WorkspaceKindRepository) getWorkspaceKindAssetBytes(ctx context.Context, name string, assetType wskAssetType) ([]byte, kubefloworgv1beta1.WorkspaceKindAssetMediaType, error) {
	// get workspace kind
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	err := r.client.Get(ctx, client.ObjectKey{Name: name}, workspaceKind)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, "", ErrWorkspaceKindNotFound
		}
		return nil, "", err
	}

	// get the asset config map reference from the workspace kind spec, depending on the asset type
	var assetConfigMap *kubefloworgv1beta1.WorkspaceKindAssetConfigMap
	switch assetType {
	case wskAssetTypeIcon:
		assetConfigMap = workspaceKind.Spec.Spawner.Icon.ConfigMap
	case wskAssetTypeLogo:
		assetConfigMap = workspaceKind.Spec.Spawner.Logo.ConfigMap
	}
	if assetConfigMap == nil {
		return nil, "", ErrWorkspaceKindAssetNotConfigMap
	}

	// get the config map
	configMap := &corev1.ConfigMap{}
	err = r.configMapClient.Get(ctx, client.ObjectKey{
		Namespace: assetConfigMap.Namespace,
		Name:      assetConfigMap.Name,
	}, configMap)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, "", ErrWorkspaceKindAssetConfigMapNotFound
		}
		return nil, "", err
	}

	// get the asset content from the config map
	var assetBytes []byte
	if stringData, exists := configMap.Data[assetConfigMap.Key]; exists {
		assetBytes = []byte(stringData)
	} else if bytesData, exists := configMap.BinaryData[assetConfigMap.Key]; exists {
		assetBytes = bytesData
	} else {
		return nil, "", ErrWorkspaceKindAssetConfigMapKeyMissing
	}

	return assetBytes, assetConfigMap.MediaType, nil
}
