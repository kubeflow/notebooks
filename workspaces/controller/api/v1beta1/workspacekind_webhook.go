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

package v1beta1

import (
	"context"
	"errors"
	"fmt"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"
	"reflect"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/webhook"
	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
)

// log is for logging in this package.
var workspacekindlog = logf.Log.WithName("workspacekind-resource")

// SetupWebhookWithManager will setup the manager to manage the webhooks
func (r *WorkspaceKind) SetupWebhookWithManager(mgr ctrl.Manager) error {
	return ctrl.NewWebhookManagedBy(mgr).
		For(r).
		Complete()
}

// TODO(user): EDIT THIS FILE!  THIS IS SCAFFOLDING FOR YOU TO OWN!

// TODO(user): change verbs to "verbs=create;update;delete" if you want to enable deletion validation.
//+kubebuilder:webhook:path=/validate-kubeflow-org-v1beta1-workspacekind,mutating=false,failurePolicy=fail,sideEffects=None,groups=kubeflow.org,resources=workspacekinds,verbs=create;update,versions=v1beta1,name=vworkspacekind.kb.io,admissionReviewVersions=v1

var _ webhook.Validator = &WorkspaceKind{}

// ValidateCreate implements webhook.Validator so a webhook will be registered for the type
func (r *WorkspaceKind) ValidateCreate() (admission.Warnings, error) {
	workspacekindlog.Info("validate create", "name", r.Name)

	// Reject cycles in image options
	imageConfigIdMap := make(map[string]ImageConfigValue)
	for _, v := range r.Spec.PodTemplate.Options.ImageConfig.Values {
		// Ensure ports are unique
		ports := make(map[int32]bool)
		for _, port := range v.Spec.Ports {
			if _, exists := ports[port.Port]; exists {
				return nil, fmt.Errorf("duplicate port %d in imageConfig with id '%s'", port.Port, v.Id)
			}
			ports[port.Port] = true
		}

		imageConfigIdMap[v.Id] = v
	}
	for _, currentImageConfig := range imageConfigIdMap {
		// follow any redirects to get the desired imageConfig
		desiredImageConfig := currentImageConfig
		visitedNodes := map[string]bool{currentImageConfig.Id: true}
		for {
			if desiredImageConfig.Redirect == nil {
				break
			}
			if visitedNodes[desiredImageConfig.Redirect.To] {
				return nil, fmt.Errorf("imageConfig with id '%s' has a circular redirect", desiredImageConfig.Id)
			}
			nextNode, ok := imageConfigIdMap[desiredImageConfig.Redirect.To]
			if !ok {
				return nil, fmt.Errorf("imageConfig with id '%s' not found, was redirected from '%s'", desiredImageConfig.Redirect.To, desiredImageConfig.Id)
			}
			desiredImageConfig = nextNode
			visitedNodes[desiredImageConfig.Id] = true
		}
	}

	// Reject cycles in pod options
	podConfigIdMap := make(map[string]PodConfigValue)
	for _, v := range r.Spec.PodTemplate.Options.PodConfig.Values {
		podConfigIdMap[v.Id] = v
	}
	for _, currentPodConfig := range podConfigIdMap {
		// follow any redirects to get the desired podConfig
		desiredPodConfig := currentPodConfig
		visitedNodes := map[string]bool{currentPodConfig.Id: true}
		for {
			if desiredPodConfig.Redirect == nil {
				break
			}
			if visitedNodes[desiredPodConfig.Redirect.To] {
				return nil, fmt.Errorf("podConfig with id '%s' has a circular redirect", desiredPodConfig.Id)
			}
			nextNode, ok := podConfigIdMap[desiredPodConfig.Redirect.To]
			if !ok {
				return nil, fmt.Errorf("podConfig with id '%s' not found, was redirected from '%s'", desiredPodConfig.Redirect.To, desiredPodConfig.Id)
			}
			desiredPodConfig = nextNode
			visitedNodes[desiredPodConfig.Id] = true
		}
	}

	// Ensure the default image config is present
	if _, ok := imageConfigIdMap[r.Spec.PodTemplate.Options.ImageConfig.Spawner.Default]; !ok {
		return nil, fmt.Errorf("default image config with id '%s' is not present in spec.podTemplate.options.imageConfig.values", r.Spec.PodTemplate.Options.ImageConfig.Spawner.Default)
	}

	// Ensure the default pod config is present
	if _, ok := podConfigIdMap[r.Spec.PodTemplate.Options.PodConfig.Spawner.Default]; !ok {
		return nil, fmt.Errorf("default pod config with id '%s' is not present in spec.podTemplate.options.podConfig.values", r.Spec.PodTemplate.Options.PodConfig.Spawner.Default)
	}

	// TODO: Ensure that `spec.podTemplate.extraEnv[].value` is a valid go template

	return nil, nil
}

// ValidateUpdate implements webhook.Validator so a webhook will be registered for the type
func (r *WorkspaceKind) ValidateUpdate(old runtime.Object) (admission.Warnings, error) {
	workspacekindlog.Info("validate update", "name", r.Name)

	// Type assertion to convert the old runtime.Object to WorkspaceKind
	oldWorkspaceKind, ok := old.(*WorkspaceKind)
	if !ok {
		return nil, errors.New("old object is not a WorkspaceKind")
	}

	// Validate ImageConfig is immutable
	imageConfigSpecMap := make(map[string]ImageConfigSpec)
	for _, v := range oldWorkspaceKind.Spec.PodTemplate.Options.ImageConfig.Values {
		imageConfigSpecMap[v.Id] = v.Spec
	}
	updatedImageConfigSpecMap := make(map[string]ImageConfigSpec)
	for _, v := range r.Spec.PodTemplate.Options.ImageConfig.Values {
		updatedImageConfigSpecMap[v.Id] = v.Spec
		if oldSpec, exists := imageConfigSpecMap[v.Id]; exists {
			if !reflect.DeepEqual(oldSpec, v.Spec) {
				return nil, fmt.Errorf("spec.podTemplate.options.imageConfig.values with id '%s' is immutable", v.Id)
			}
		}
	}

	// Validate PodConfig is immutable
	podConfigSpecMap := make(map[string]PodConfigSpec)
	for _, v := range oldWorkspaceKind.Spec.PodTemplate.Options.PodConfig.Values {
		podConfigSpecMap[v.Id] = v.Spec
	}
	updatedPodConfigSpecMap := make(map[string]PodConfigSpec)
	for _, v := range r.Spec.PodTemplate.Options.PodConfig.Values {
		updatedPodConfigSpecMap[v.Id] = v.Spec
		if oldSpec, exists := podConfigSpecMap[v.Id]; exists {
			normalizePodConfigSpec(&oldSpec)
			normalizePodConfigSpec(&v.Spec)

			if !reflect.DeepEqual(oldSpec, v.Spec) {
				return nil, fmt.Errorf("spec.podTemplate.options.podConfig.values with id '%s' is immutable", v.Id)
			}
		}
	}

	kbCacheWorkspaceKindField := ".spec.kind"
	workspaces := &WorkspaceList{}
	listOpts := &client.ListOptions{
		FieldSelector: fields.OneTermEqualSelector(kbCacheWorkspaceKindField, r.Name),
		Namespace:     corev1.NamespaceAll,
	}
	if err := k8sClient.List(context.Background(), workspaces, listOpts); err != nil {
		return nil, err
	}

	usedImageConfig := make(map[string]int)
	usedPodConfig := make(map[string]int)
	for _, ws := range workspaces.Items {
		usedImageConfig[ws.Spec.PodTemplate.Options.ImageConfig]++
		usedPodConfig[ws.Spec.PodTemplate.Options.PodConfig]++
	}
	// Only allow removing option ids which are not used
	for id, _ := range imageConfigSpecMap {
		if _, exists := updatedImageConfigSpecMap[id]; !exists {
			// check if this option is used by any workspace
			if usedImageConfig[id] > 0 {
				errMsg := fmt.Sprintf("spec.podTemplate.options.imageConfig.values with id '%s' is used by %d workspace", id, usedImageConfig[id])
				if usedImageConfig[id] > 1 {
					errMsg += "s"
				}
				return nil, fmt.Errorf(errMsg)
			}
		}
	}
	for id, _ := range podConfigSpecMap {
		if _, exists := updatedPodConfigSpecMap[id]; !exists {
			// check if this option is used by any workspace
			if usedPodConfig[id] > 0 {
				errMsg := fmt.Sprintf("spec.podTemplate.options.podConfig.values with id '%s' is used by %d workspace", id, usedPodConfig[id])
				if usedPodConfig[id] > 1 {
					errMsg += "s"
				}
				return nil, fmt.Errorf(errMsg)
			}
		}
	}

	// Reject cycles in image options
	imageConfigIdMap := make(map[string]ImageConfigValue)
	for _, v := range r.Spec.PodTemplate.Options.ImageConfig.Values {
		imageConfigIdMap[v.Id] = v
	}
	for _, currentImageConfig := range imageConfigIdMap {
		// follow any redirects to get the desired imageConfig
		desiredImageConfig := currentImageConfig
		visitedNodes := map[string]bool{currentImageConfig.Id: true}
		for {
			if desiredImageConfig.Redirect == nil {
				break
			}
			if visitedNodes[desiredImageConfig.Redirect.To] {
				return nil, fmt.Errorf("imageConfig with id '%s' has a circular redirect", desiredImageConfig.Id)
			}
			nextNode, ok := imageConfigIdMap[desiredImageConfig.Redirect.To]
			if !ok {
				return nil, fmt.Errorf("imageConfig with id '%s' not found, was redirected from '%s'", desiredImageConfig.Redirect.To, desiredImageConfig.Id)
			}
			desiredImageConfig = nextNode
			visitedNodes[desiredImageConfig.Id] = true
		}
	}

	// Reject cycles in pod options
	podConfigIdMap := make(map[string]PodConfigValue)
	for _, v := range r.Spec.PodTemplate.Options.PodConfig.Values {
		podConfigIdMap[v.Id] = v
	}
	for _, currentPodConfig := range podConfigIdMap {
		// follow any redirects to get the desired podConfig
		desiredPodConfig := currentPodConfig
		visitedNodes := map[string]bool{currentPodConfig.Id: true}
		for {
			if desiredPodConfig.Redirect == nil {
				break
			}
			if visitedNodes[desiredPodConfig.Redirect.To] {
				return nil, fmt.Errorf("podConfig with id '%s' has a circular redirect", desiredPodConfig.Id)
			}
			nextNode, ok := podConfigIdMap[desiredPodConfig.Redirect.To]
			if !ok {
				return nil, fmt.Errorf("podConfig with id '%s' not found, was redirected from '%s'", desiredPodConfig.Redirect.To, desiredPodConfig.Id)
			}
			desiredPodConfig = nextNode
			visitedNodes[desiredPodConfig.Id] = true
		}
	}

	// Ensure the default image config is present
	if _, ok := imageConfigIdMap[r.Spec.PodTemplate.Options.ImageConfig.Spawner.Default]; !ok {
		return nil, fmt.Errorf("default image config with id '%s' is not present in spec.podTemplate.options.imageConfig.values", r.Spec.PodTemplate.Options.ImageConfig.Spawner.Default)
	}

	// Ensure the default pod config is present
	if _, ok := podConfigIdMap[r.Spec.PodTemplate.Options.PodConfig.Spawner.Default]; !ok {
		return nil, fmt.Errorf("default pod config with id '%s' is not present in spec.podTemplate.options.podConfig.values", r.Spec.PodTemplate.Options.PodConfig.Spawner.Default)
	}
	return nil, nil
}

// ValidateDelete implements webhook.Validator so a webhook will be registered for the type
func (r *WorkspaceKind) ValidateDelete() (admission.Warnings, error) {
	workspacekindlog.Info("validate delete", "name", r.Name)

	// TODO(user): fill in your validation logic upon object deletion.
	return nil, nil
}

func normalizePodConfigSpec(spec *PodConfigSpec) {
	// Normalize NodeSelector
	if spec.NodeSelector != nil && len(spec.NodeSelector) == 0 {
		spec.NodeSelector = nil
	}

	// Normalize Tolerations
	if spec.Tolerations != nil && len(spec.Tolerations) == 0 {
		spec.Tolerations = nil
	}

	// Normalize ResourceRequests
	if reflect.DeepEqual(spec.Resources.Requests, corev1.ResourceList{}) {
		spec.Resources.Requests = nil
	}
	if spec.Resources.Requests != nil {
		for key, value := range spec.Resources.Requests {
			spec.Resources.Requests[key] = resource.MustParse(value.String())
		}
	}

	// Normalize ResourceLimits
	if reflect.DeepEqual(spec.Resources.Limits, corev1.ResourceList{}) {
		spec.Resources.Limits = nil
	}
	if spec.Resources.Limits != nil {
		for key, value := range spec.Resources.Limits {
			spec.Resources.Limits[key] = resource.MustParse(value.String())
		}
	}
}
