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
	"fmt"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/utils/ptr"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
)

/*
===============================================================================
                              Helpers
===============================================================================
*/

// CalculateWorkspaceRevision calculates the revision/etag for a workspace.
// FORMAT: hex(sha256("<WORKSPACE_UUID>:<WORKSPACE_NAME>:<WORKSPACE_GENERATION>"))
// this detects changes to the `spec` of the workspace, while also ensuring
// that the resource itself is the same (via UID and name).
func CalculateWorkspaceRevision(workspace *kubefloworgv1beta1.Workspace) string {
	revisionInput := fmt.Sprintf("%s:%s:%d", workspace.UID, workspace.Name, workspace.Generation)
	hash := sha256.Sum256([]byte(revisionInput))
	return hex.EncodeToString(hash[:])
}

/*
===============================================================================
                              Kubernetes to Model
===============================================================================
*/

// NewWorkspaceCreateModelFromWorkspace creates WorkspaceCreate model from a Workspace object.
func NewWorkspaceCreateModelFromWorkspace(ws *kubefloworgv1beta1.Workspace) *WorkspaceCreate {
	return &WorkspaceCreate{
		Name:        ws.Name,
		Kind:        ws.Spec.Kind,
		Paused:      ptr.Deref(ws.Spec.Paused, false),
		PodTemplate: buildPodTemplateMutate(ws),
	}
}

// NewWorkspaceUpdateModelFromWorkspace creates WorkspaceUpdate model from a Workspace object.
func NewWorkspaceUpdateModelFromWorkspace(ws *kubefloworgv1beta1.Workspace) *WorkspaceUpdate {
	return &WorkspaceUpdate{
		Revision:    CalculateWorkspaceRevision(ws),
		Paused:      ptr.Deref(ws.Spec.Paused, false),
		PodTemplate: buildPodTemplateMutate(ws),
	}
}

// buildPodTemplateMutate constructs a PodTemplateMutate from a Workspace spec.
func buildPodTemplateMutate(ws *kubefloworgv1beta1.Workspace) PodTemplateMutate {
	podLabels, podAnnotations := extractPodMetadata(ws)
	return PodTemplateMutate{
		PodMetadata: PodMetadataMutate{
			Labels:      podLabels,
			Annotations: podAnnotations,
		},
		Volumes: PodVolumesMutate{
			Home:    ws.Spec.PodTemplate.Volumes.Home,
			Data:    extractDataVolumes(ws),
			Secrets: extractSecretMounts(ws),
		},
		Options: PodTemplateOptionsMutate{
			ImageConfig: ws.Spec.PodTemplate.Options.ImageConfig,
			PodConfig:   ws.Spec.PodTemplate.Options.PodConfig,
		},
	}
}

// extractPodMetadata extracts and copies pod labels and annotations from a Workspace spec.
// Returns copies of the maps to avoid creating references to the original maps.
func extractPodMetadata(ws *kubefloworgv1beta1.Workspace) (labels map[string]string, annotations map[string]string) {
	labels = make(map[string]string)
	annotations = make(map[string]string)
	if ws.Spec.PodTemplate.PodMetadata != nil {
		for k, v := range ws.Spec.PodTemplate.PodMetadata.Labels {
			labels[k] = v
		}
		for k, v := range ws.Spec.PodTemplate.PodMetadata.Annotations {
			annotations[k] = v
		}
	}
	return labels, annotations
}

// extractDataVolumes converts workspace data volumes to PodVolumeMount slice.
func extractDataVolumes(ws *kubefloworgv1beta1.Workspace) []PodVolumeMount {
	dataVolumes := make([]PodVolumeMount, len(ws.Spec.PodTemplate.Volumes.Data))
	for i, v := range ws.Spec.PodTemplate.Volumes.Data {
		dataVolumes[i] = PodVolumeMount{
			PVCName:   v.PVCName,
			MountPath: v.MountPath,
			ReadOnly:  ptr.Deref(v.ReadOnly, false),
		}
	}
	return dataVolumes
}

// extractSecretMounts converts workspace secret volumes to PodSecretMount slice.
func extractSecretMounts(ws *kubefloworgv1beta1.Workspace) []PodSecretMount {
	secretMounts := make([]PodSecretMount, len(ws.Spec.PodTemplate.Volumes.Secrets))
	for i, s := range ws.Spec.PodTemplate.Volumes.Secrets {
		secretMounts[i] = PodSecretMount{
			SecretName:  s.SecretName,
			MountPath:   s.MountPath,
			DefaultMode: s.DefaultMode,
		}
	}
	return secretMounts
}

/*
===============================================================================
                              Model to Kubernetes
===============================================================================
*/

// validateAndUnpackVolumes validates that referenced PVCs and Secrets exist and are mountable
// in the given namespace, and converts model volume types to their CRD equivalents.
func validateAndUnpackVolumes(
	ctx context.Context,
	k8sClient client.Client,
	volumes PodVolumesMutate,
	namespace string,
) (*string, []kubefloworgv1beta1.PodVolumeMount, []kubefloworgv1beta1.PodSecretMount, error) {
	var allValErrs field.ErrorList

	// unpack and validate home volume
	homeVolumeName := volumes.Home
	homeVolumeNameField := field.NewPath("podTemplate", "volumes", "home")
	if homeVolumeName != nil {
		valErrs, err := helper.ValidateKubernetesPVCIsMountable(ctx, k8sClient, homeVolumeNameField, namespace, *homeVolumeName)
		if err != nil {
			return nil, nil, nil, err
		}
		allValErrs = append(allValErrs, valErrs...)
	}

	// unpack and validate data volume mounts
	dataVolumeMounts := make([]kubefloworgv1beta1.PodVolumeMount, len(volumes.Data))
	for i, dataVolume := range volumes.Data {
		dataVolumeName := dataVolume.PVCName
		dataVolumeNameField := field.NewPath("podTemplate", "volumes", "data").Index(i).Child("pvcName")
		valErrs, err := helper.ValidateKubernetesPVCIsMountable(ctx, k8sClient, dataVolumeNameField, namespace, dataVolumeName)
		if err != nil {
			return nil, nil, nil, err
		}
		allValErrs = append(allValErrs, valErrs...)
		dataVolumeMounts[i] = kubefloworgv1beta1.PodVolumeMount{
			PVCName:   dataVolumeName,
			MountPath: dataVolume.MountPath,
			ReadOnly:  ptr.To(dataVolume.ReadOnly),
		}
	}

	// unpack and validate secret mounts
	secretMounts := make([]kubefloworgv1beta1.PodSecretMount, len(volumes.Secrets))
	for i, secret := range volumes.Secrets {
		secretName := secret.SecretName
		secretNameField := field.NewPath("podTemplate", "volumes", "secrets").Index(i).Child("secretName")
		valErrs, err := helper.ValidateKubernetesSecretIsMountable(ctx, k8sClient, secretNameField, namespace, secretName)
		if err != nil {
			return nil, nil, nil, err
		}
		allValErrs = append(allValErrs, valErrs...)
		secretMounts[i] = kubefloworgv1beta1.PodSecretMount{
			SecretName:  secretName,
			MountPath:   secret.MountPath,
			DefaultMode: secret.DefaultMode,
		}
	}

	// if there are any validation errors, return an aggregated error
	if len(allValErrs) > 0 {
		return nil, nil, nil, helper.NewInternalValidationError(allValErrs)
	}

	return homeVolumeName, dataVolumeMounts, secretMounts, nil
}

// buildWorkspacePodTemplate constructs a WorkspacePodTemplate from a PodTemplateMutate
// and the validated volume outputs from validateAndUnpackVolumes.
func buildWorkspacePodTemplate(
	podTemplate *PodTemplateMutate,
	homeVolumeName *string,
	dataVolumeMounts []kubefloworgv1beta1.PodVolumeMount,
	secretMounts []kubefloworgv1beta1.PodSecretMount,
) kubefloworgv1beta1.WorkspacePodTemplate {
	return kubefloworgv1beta1.WorkspacePodTemplate{
		PodMetadata: &kubefloworgv1beta1.WorkspacePodMetadata{
			Labels:      podTemplate.PodMetadata.Labels,
			Annotations: podTemplate.PodMetadata.Annotations,
		},
		Volumes: kubefloworgv1beta1.WorkspacePodVolumes{
			Home:    homeVolumeName,
			Data:    dataVolumeMounts,
			Secrets: secretMounts,
		},
		Options: kubefloworgv1beta1.WorkspacePodOptions{
			ImageConfig: podTemplate.Options.ImageConfig,
			PodConfig:   podTemplate.Options.PodConfig,
		},
	}
}

// NewWorkspaceFromWorkspaceCreateModel creates a Workspace object from a WorkspaceCreate model.
// It validates that referenced PVCs and Secrets exist and are mountable in the given namespace.
func NewWorkspaceFromWorkspaceCreateModel(ctx context.Context, k8sClient client.Client, workspaceCreate *WorkspaceCreate, namespace string) (*kubefloworgv1beta1.Workspace, error) {
	homeVolumeName, dataVolumeMounts, secretMounts, err := validateAndUnpackVolumes(ctx, k8sClient, workspaceCreate.PodTemplate.Volumes, namespace)
	if err != nil {
		return nil, err
	}

	// construct workspace object from model
	workspace := &kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{
			Name:      workspaceCreate.Name,
			Namespace: namespace,
		},
		Spec: kubefloworgv1beta1.WorkspaceSpec{
			Paused:      &workspaceCreate.Paused,
			Kind:        workspaceCreate.Kind,
			PodTemplate: buildWorkspacePodTemplate(&workspaceCreate.PodTemplate, homeVolumeName, dataVolumeMounts, secretMounts),
		},
	}

	return workspace, nil
}

// ApplyWorkspaceUpdateModelToWorkspace applies a WorkspaceUpdate model to an existing Workspace object.
// It validates that referenced PVCs and Secrets exist and are mountable in the given namespace.
func ApplyWorkspaceUpdateModelToWorkspace(ctx context.Context, k8sClient client.Client, workspaceUpdate *WorkspaceUpdate, workspace *kubefloworgv1beta1.Workspace) error {
	_, dataVolumeMounts, secretMounts, err := validateAndUnpackVolumes(ctx, k8sClient, workspaceUpdate.PodTemplate.Volumes, workspace.Namespace)
	if err != nil {
		return err
	}

	// apply model fields to workspace spec
	workspace.Spec.Paused = ptr.To(workspaceUpdate.Paused)
	workspace.Spec.PodTemplate = buildWorkspacePodTemplate(&workspaceUpdate.PodTemplate, workspaceUpdate.PodTemplate.Volumes.Home, dataVolumeMounts, secretMounts)

	return nil
}
