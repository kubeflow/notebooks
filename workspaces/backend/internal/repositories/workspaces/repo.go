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

package workspaces

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/utils/ptr"
	"sigs.k8s.io/controller-runtime/pkg/client"

	commonassets "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common/assets"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces"
	action_models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/actions"
)

var (
	ErrWorkspaceNotFound      = fmt.Errorf("workspace not found")
	ErrWorkspaceAlreadyExists = fmt.Errorf("workspace already exists")
	ErrWorkspaceInvalidState  = fmt.Errorf("workspace is in an invalid state for this operation")
)

type WorkspaceRepository struct {
	client          client.Client
	configMapClient client.Client // filtered cache client for ConfigMaps with notebooks.kubeflow.org/image-source: true
}

func NewWorkspaceRepository(cl client.Client, configMapClient client.Client) *WorkspaceRepository {
	return &WorkspaceRepository{
		client:          cl,
		configMapClient: configMapClient,
	}
}

func (r *WorkspaceRepository) GetWorkspace(ctx context.Context, namespace string, workspaceName string) (models.Workspace, error) {
	// get workspace
	workspace := &kubefloworgv1beta1.Workspace{}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: namespace, Name: workspaceName}, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return models.Workspace{}, ErrWorkspaceNotFound
		}
		return models.Workspace{}, err
	}

	// get workspace kind, if it exists
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	workspaceKindName := workspace.Spec.Kind
	if err := r.client.Get(ctx, client.ObjectKey{Name: workspaceKindName}, workspaceKind); err != nil {
		// ignore error if workspace kind does not exist, as we can still create a model without it
		if !apierrors.IsNotFound(err) {
			return models.Workspace{}, err
		}
	}

	// convert workspace to model
	workspaceModel := models.NewWorkspaceModelFromWorkspace(workspace, workspaceKind)

	return workspaceModel, nil
}

func (r *WorkspaceRepository) GetWorkspaces(ctx context.Context, namespace string) ([]models.Workspace, error) {
	return r.getWorkspaceModels(ctx, client.InNamespace(namespace))
}

func (r *WorkspaceRepository) GetAllWorkspaces(ctx context.Context) ([]models.Workspace, error) {
	return r.getWorkspaceModels(ctx)
}

// getWorkspaceModels lists workspaces using the provided ListOptions and converts them to models.
// For each workspace, it retrieves the associated WorkspaceKind and computes asset SHA256 hashes
// for ConfigMap-based assets to populate the ImageRef fields.
func (r *WorkspaceRepository) getWorkspaceModels(ctx context.Context, listOptions ...client.ListOption) ([]models.Workspace, error) {
	// get workspaces using the provided list options
	workspaceList := &kubefloworgv1beta1.WorkspaceList{}
	if err := r.client.List(ctx, workspaceList, listOptions...); err != nil {
		return nil, err
	}

	// convert workspaces to models
	workspacesModels := make([]models.Workspace, len(workspaceList.Items))
	for i, workspace := range workspaceList.Items {
		// get workspace kind, if it exists
		workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
		workspaceKindName := workspace.Spec.Kind
		if err := r.client.Get(ctx, client.ObjectKey{Name: workspaceKindName}, workspaceKind); err != nil {
			// ignore error if workspace kind does not exist, as we can still create a model without it
			if !apierrors.IsNotFound(err) {
				return nil, err
			}
			// If not found, set workspaceKind to nil to indicate it doesn't exist
			workspaceKind = nil
		}

		// Compute SHA256 hashes for ConfigMap-based assets if WorkspaceKind exists
		// Capture errors to populate ImageRef.Error field
		var assetCtx *commonassets.WorkspaceKindAssetContext
		if workspaceKind != nil && workspaceKind.UID != "" {
			assetCtx = r.getWorkspaceKindAssetContext(ctx, workspaceKind)
		}

		workspacesModels[i] = models.NewWorkspaceModelFromWorkspaceWithAssetContext(&workspace, workspaceKind, assetCtx)
	}

	return workspacesModels, nil
}

func (r *WorkspaceRepository) CreateWorkspace(ctx context.Context, workspaceCreate *models.WorkspaceCreate, namespace string) (*models.WorkspaceCreate, error) {
	// get data volumes from workspace model
	dataVolumeMounts := make([]kubefloworgv1beta1.PodVolumeMount, len(workspaceCreate.PodTemplate.Volumes.Data))
	for i, dataVolume := range workspaceCreate.PodTemplate.Volumes.Data {
		dataVolumeMounts[i] = kubefloworgv1beta1.PodVolumeMount{
			PVCName:   dataVolume.PVCName,
			MountPath: dataVolume.MountPath,
			ReadOnly:  ptr.To(dataVolume.ReadOnly),
		}
	}

	// get secrets from workspace model
	secretMounts := make([]kubefloworgv1beta1.PodSecretMount, len(workspaceCreate.PodTemplate.Volumes.Secrets))
	for i, secret := range workspaceCreate.PodTemplate.Volumes.Secrets {
		secretMounts[i] = kubefloworgv1beta1.PodSecretMount{
			SecretName:  secret.SecretName,
			MountPath:   secret.MountPath,
			DefaultMode: secret.DefaultMode,
		}
	}

	// define workspace object from model
	workspaceName := workspaceCreate.Name
	workspaceKindName := workspaceCreate.Kind
	workspace := &kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{
			Name:      workspaceName,
			Namespace: namespace,
		},
		Spec: kubefloworgv1beta1.WorkspaceSpec{
			Paused:       &workspaceCreate.Paused,
			DeferUpdates: &workspaceCreate.DeferUpdates,
			Kind:         workspaceKindName,
			PodTemplate: kubefloworgv1beta1.WorkspacePodTemplate{
				PodMetadata: &kubefloworgv1beta1.WorkspacePodMetadata{
					Labels:      workspaceCreate.PodTemplate.PodMetadata.Labels,
					Annotations: workspaceCreate.PodTemplate.PodMetadata.Annotations,
				},
				Volumes: kubefloworgv1beta1.WorkspacePodVolumes{
					Home:    workspaceCreate.PodTemplate.Volumes.Home,
					Data:    dataVolumeMounts,
					Secrets: secretMounts,
				},
				Options: kubefloworgv1beta1.WorkspacePodOptions{
					ImageConfig: workspaceCreate.PodTemplate.Options.ImageConfig,
					PodConfig:   workspaceCreate.PodTemplate.Options.PodConfig,
				},
			},
		},
	}

	// create workspace
	if err := r.client.Create(ctx, workspace); err != nil {
		if apierrors.IsAlreadyExists(err) {
			return nil, ErrWorkspaceAlreadyExists
		}
		if apierrors.IsInvalid(err) {
			// NOTE: we don't wrap this error so we can unpack it in the caller
			//       and extract the validation errors returned by the Kubernetes API server
			return nil, err
		}
		return nil, err
	}

	// convert the created workspace to a WorkspaceCreate model
	createdWorkspaceModel := models.NewWorkspaceCreateModelFromWorkspace(workspace)

	return createdWorkspaceModel, nil
}

func (r *WorkspaceRepository) DeleteWorkspace(ctx context.Context, namespace, workspaceName string) error {
	workspace := &kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      workspaceName,
		},
	}

	if err := r.client.Delete(ctx, workspace); err != nil {
		if apierrors.IsNotFound(err) {
			return ErrWorkspaceNotFound
		}
		return err
	}

	return nil
}

// getWorkspaceKindAssetContext computes the SHA256 hashes for both icon and logo assets of a WorkspaceKind.
// Returns a WorkspaceKindAssetContext containing the SHA256 hashes and any errors encountered during retrieval.
func (r *WorkspaceRepository) getWorkspaceKindAssetContext(ctx context.Context, workspaceKind *kubefloworgv1beta1.WorkspaceKind) *commonassets.WorkspaceKindAssetContext {
	iconSHA256, iconErr := r.computeAssetSHA256(ctx, workspaceKind.Spec.Spawner.Icon)
	logoSHA256, logoErr := r.computeAssetSHA256(ctx, workspaceKind.Spec.Spawner.Logo)
	return commonassets.NewAssetContext(iconSHA256, logoSHA256, iconErr, logoErr)
}

// computeAssetSHA256 computes the SHA256 hash of a WorkspaceKindAsset if it uses a ConfigMap.
// Returns empty string if the asset does not use a ConfigMap or if there's an error retrieving the ConfigMap.
func (r *WorkspaceRepository) computeAssetSHA256(ctx context.Context, asset kubefloworgv1beta1.WorkspaceKindAsset) (string, error) {
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

	content, err := r.getConfigMapContent(ctx, assetModel)
	if err != nil {
		return "", err
	}

	hash := sha256.Sum256([]byte(content))
	return hex.EncodeToString(hash[:]), nil
}

// getConfigMapContent retrieves the content from a ConfigMap referenced by a WorkspaceKindAsset.
// Returns the content as a string, or an error if the ConfigMap or key cannot be found.
func (r *WorkspaceRepository) getConfigMapContent(ctx context.Context, asset commonassets.WorkspaceKindAsset) (string, error) {
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

// WorkspacePatchOperation represents a single JSONPatch operation
type WorkspacePatchOperation struct {
	Op    string      `json:"op"`
	Path  string      `json:"path"`
	Value interface{} `json:"value,omitempty"`
}

// HandlePauseAction handles pause/start operations for a workspace
func (r *WorkspaceRepository) HandlePauseAction(ctx context.Context, namespace, workspaceName string, workspaceActionPause *action_models.WorkspaceActionPause) (*action_models.WorkspaceActionPause, error) {
	targetPauseState := workspaceActionPause.Paused

	// Build patch operations incrementally
	patch := []WorkspacePatchOperation{
		{
			Op:    "test",
			Path:  "/spec/paused",
			Value: !targetPauseState, // Test current state (opposite of target state)
		},
	}

	// For start operations, add additional test for paused state
	// "test" operations on JSON Patch only support strict equality checks, so we can't apply an additional test
	// for pause operations on the workspace as we'd want to check the workspace state != paused.
	if !targetPauseState {
		patch = append(patch, WorkspacePatchOperation{
			Op:    "test",
			Path:  "/status/state",
			Value: kubefloworgv1beta1.WorkspaceStatePaused,
		})
	}

	// Always add the replace operation
	patch = append(patch, WorkspacePatchOperation{
		Op:    "replace",
		Path:  "/spec/paused",
		Value: targetPauseState,
	})

	patchBytes, err := json.Marshal(patch)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal patch: %w", err)
	}

	workspace := &kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      workspaceName,
		},
	}

	if err := r.client.Patch(ctx, workspace, client.RawPatch(types.JSONPatchType, patchBytes)); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, ErrWorkspaceNotFound
		}
		if apierrors.IsInvalid(err) {
			return nil, ErrWorkspaceInvalidState
		}
		return nil, fmt.Errorf("failed to patch workspace: %w", err)
	}

	workspaceActionPauseModel := action_models.NewWorkspaceActionPauseFromWorkspace(workspace)
	return workspaceActionPauseModel, nil
}
