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
	"text/template"
)

const kbCacheWorkspaceKindField = ".spec.kind"

// log is for logging in this package.
var workspaceKindLog = logf.Log.WithName("workspacekind-resource")

// SetupWebhookWithManager will setup the manager to manage the webhooks
func (r *WorkspaceKind) SetupWebhookWithManager(mgr ctrl.Manager) error {
	return ctrl.NewWebhookManagedBy(mgr).
		For(r).
		Complete()
}

// TODO(user): change verbs to "verbs=create;update;delete" if you want to enable deletion validation.
//+kubebuilder:webhook:path=/validate-kubeflow-org-v1beta1-workspacekind,mutating=false,failurePolicy=fail,sideEffects=None,groups=kubeflow.org,resources=workspacekinds,verbs=create;update,versions=v1beta1,name=vworkspacekind.kb.io,admissionReviewVersions=v1

var _ webhook.Validator = &WorkspaceKind{}

// ValidateCreate implements webhook.Validator so a webhook will be registered for the type
func (r *WorkspaceKind) ValidateCreate() (admission.Warnings, error) {
	workspaceKindLog.Info("validate create", "name", r.Name)

	imageConfigValueMap, err := generateImageConfigAndValidatePorts(r.Spec.PodTemplate.Options.ImageConfig)
	if err != nil {
		return nil, err
	}
	podConfigValueMap := make(map[string]PodConfigValue)
	for _, v := range r.Spec.PodTemplate.Options.PodConfig.Values {
		podConfigValueMap[v.Id] = v
	}

	if err := validateImageConfigCycles(imageConfigValueMap); err != nil {
		return nil, err
	}
	if err := validatePodConfigCycle(podConfigValueMap); err != nil {
		return nil, err
	}

	if err := ensureDefaultOptions(imageConfigValueMap, podConfigValueMap, r.Spec.PodTemplate.Options); err != nil {
		return nil, err
	}

	if err := validateExtraEnv(r.Spec.PodTemplate.ExtraEnv); err != nil {
		return nil, err
	}

	return nil, nil
}

// ValidateUpdate implements webhook.Validator so a webhook will be registered for the type
func (r *WorkspaceKind) ValidateUpdate(old runtime.Object) (admission.Warnings, error) {
	workspaceKindLog.Info("validate update", "name", r.Name)

	// Type assertion to convert the old runtime.Object to WorkspaceKind
	oldWorkspaceKind, ok := old.(*WorkspaceKind)
	if !ok {
		return nil, errors.New("old object is not a WorkspaceKind")
	}

	imageConfigUsageCount, podConfigUsageCount, err := getConfigUsageCount(r.Name)

	imageConfigValueMap, err := generateAndValidateImageConfig(r.Spec.PodTemplate.Options.ImageConfig, oldWorkspaceKind.Spec.PodTemplate.Options.ImageConfig, imageConfigUsageCount)
	if err != nil {
		return nil, err
	}

	podConfigValueMap, err := generateAndValidatePodConfig(r.Spec.PodTemplate.Options.PodConfig, oldWorkspaceKind.Spec.PodTemplate.Options.PodConfig, podConfigUsageCount)
	if err != nil {
		return nil, err
	}

	if err := validateImageConfigCycles(imageConfigValueMap); err != nil {
		return nil, err
	}

	if err := validatePodConfigCycle(podConfigValueMap); err != nil {
		return nil, err
	}

	if err := ensureDefaultOptions(imageConfigValueMap, podConfigValueMap, r.Spec.PodTemplate.Options); err != nil {
		return nil, err
	}

	if err := validateExtraEnv(r.Spec.PodTemplate.ExtraEnv); err != nil {
		return nil, err
	}

	return nil, nil
}

// ValidateDelete implements webhook.Validator so a webhook will be registered for the type
func (r *WorkspaceKind) ValidateDelete() (admission.Warnings, error) {
	workspaceKindLog.Info("validate delete", "name", r.Name)

	// TODO(user): fill in your validation logic upon object deletion.
	return nil, nil
}

func generateImageConfigAndValidatePorts(imageConfig ImageConfig) (map[string]ImageConfigValue, error) {
	imageConfigValueMap := make(map[string]ImageConfigValue)
	for _, v := range imageConfig.Values {

		ports := make(map[int32]bool)
		for _, port := range v.Spec.Ports {
			if _, exists := ports[port.Port]; exists {
				return nil, fmt.Errorf("duplicate port %d in imageConfig with id '%s'", port.Port, v.Id)
			}
			ports[port.Port] = true
		}

		imageConfigValueMap[v.Id] = v
	}
	return imageConfigValueMap, nil
}

func ensureDefaultOptions(imageConfigValueMap map[string]ImageConfigValue, podConfigValueMap map[string]PodConfigValue, workspaceOptions WorkspaceKindPodOptions) error {
	if _, ok := imageConfigValueMap[workspaceOptions.ImageConfig.Spawner.Default]; !ok {
		return fmt.Errorf("default image config with id '%s' is not found in spec.podTemplate.options.imageConfig.values", workspaceOptions.ImageConfig.Spawner.Default)
	}

	if _, ok := podConfigValueMap[workspaceOptions.PodConfig.Spawner.Default]; !ok {
		return fmt.Errorf("default pod config with id '%s' is not found in spec.podTemplate.options.podConfig.values", workspaceOptions.PodConfig.Spawner.Default)
	}
	return nil
}

func validateImageConfigCycles(imageConfigValueMap map[string]ImageConfigValue) error {
	for _, currentImageConfig := range imageConfigValueMap {
		// follow any redirects to get the desired imageConfig
		desiredImageConfig := currentImageConfig
		visitedNodes := map[string]bool{currentImageConfig.Id: true}
		for {
			if desiredImageConfig.Redirect == nil {
				break
			}
			if visitedNodes[desiredImageConfig.Redirect.To] {
				return fmt.Errorf("imageConfig with id '%s' has a circular redirect", desiredImageConfig.Id)
			}
			nextNode, ok := imageConfigValueMap[desiredImageConfig.Redirect.To]
			if !ok {
				return fmt.Errorf("imageConfig with id '%s' not found, was redirected from '%s'", desiredImageConfig.Redirect.To, desiredImageConfig.Id)
			}
			desiredImageConfig = nextNode
			visitedNodes[desiredImageConfig.Id] = true
		}
	}
	return nil
}

func validatePodConfigCycle(podConfigValueMap map[string]PodConfigValue) error {
	for _, currentPodConfig := range podConfigValueMap {
		// follow any redirects to get the desired podConfig
		desiredPodConfig := currentPodConfig
		visitedNodes := map[string]bool{currentPodConfig.Id: true}
		for {
			if desiredPodConfig.Redirect == nil {
				break
			}
			if visitedNodes[desiredPodConfig.Redirect.To] {
				return fmt.Errorf("podConfig with id '%s' has a circular redirect", desiredPodConfig.Id)
			}
			nextNode, ok := podConfigValueMap[desiredPodConfig.Redirect.To]
			if !ok {
				return fmt.Errorf("podConfig with id '%s' not found, was redirected from '%s'", desiredPodConfig.Redirect.To, desiredPodConfig.Id)
			}
			desiredPodConfig = nextNode
			visitedNodes[desiredPodConfig.Id] = true
		}
	}
	return nil
}

func validateExtraEnv(extraEnv []corev1.EnvVar) error {
	for _, env := range extraEnv {
		rawValue := env.Value
		_, err := template.New("value").Funcs(template.FuncMap{"httpPathPrefix": func(_ string) string { return "" }}).Parse(rawValue)
		if err != nil {
			err = fmt.Errorf("failed to parse value %q: %v", rawValue, err)
			return err
		}
	}
	return nil
}

func getConfigUsageCount(workspaceKindName string) (map[string]int, map[string]int, error) {
	workspaces := &WorkspaceList{}
	listOpts := &client.ListOptions{
		FieldSelector: fields.OneTermEqualSelector(kbCacheWorkspaceKindField, workspaceKindName),
		Namespace:     corev1.NamespaceAll,
	}
	if err := k8sClient.List(context.Background(), workspaces, listOpts); err != nil {
		return nil, nil, err
	}

	imageConfigUsageCount := make(map[string]int)
	podConfigUsageCount := make(map[string]int)
	for _, ws := range workspaces.Items {
		imageConfigUsageCount[ws.Spec.PodTemplate.Options.ImageConfig]++
		podConfigUsageCount[ws.Spec.PodTemplate.Options.PodConfig]++
	}
	return imageConfigUsageCount, podConfigUsageCount, nil
}

func generateAndValidateImageConfig(imageConfig ImageConfig, oldImageConfig ImageConfig, imageConfigUsageCount map[string]int) (map[string]ImageConfigValue, error) {
	oldImageConfigValueMap := make(map[string]ImageConfigValue)
	imageConfigValueMap := make(map[string]ImageConfigValue)

	for _, v := range oldImageConfig.Values {
		oldImageConfigValueMap[v.Id] = v
	}

	for _, v := range imageConfig.Values {

		if oldImageConfigValue, exists := oldImageConfigValueMap[v.Id]; exists {
			if !reflect.DeepEqual(oldImageConfigValue.Spec, v.Spec) {
				return nil, fmt.Errorf("spec.podTemplate.options.imageConfig.values with id '%s' is immutable", v.Id)
			}
		}
		imageConfigValueMap[v.Id] = v
	}

	for id, _ := range oldImageConfigValueMap {
		if _, exists := imageConfigValueMap[id]; !exists {
			if imageConfigUsageCount[id] > 0 {
				errMsg := fmt.Sprintf("spec.podTemplate.options.imageConfig.values with id '%s' is used by %d workspace", id, imageConfigUsageCount[id])
				if imageConfigUsageCount[id] > 1 {
					errMsg += "s"
				}
				return nil, fmt.Errorf(errMsg)
			}
		}
	}
	return imageConfigValueMap, nil
}

func generateAndValidatePodConfig(podConfig PodConfig, oldPodConfig PodConfig, podConfigUsageCount map[string]int) (map[string]PodConfigValue, error) {
	oldPodConfigValueMap := make(map[string]PodConfigValue)
	podConfigValueMap := make(map[string]PodConfigValue)

	for _, v := range oldPodConfig.Values {
		oldPodConfigValueMap[v.Id] = v
	}

	for _, v := range podConfig.Values {
		if oldPodConfigValue, exists := oldPodConfigValueMap[v.Id]; exists {
			normalizePodConfigSpec(&oldPodConfigValue.Spec)
			normalizePodConfigSpec(&v.Spec)

			if !reflect.DeepEqual(oldPodConfigValue.Spec, v.Spec) {
				return nil, fmt.Errorf("spec.podTemplate.options.podConfig.values with id '%s' is immutable", v.Id)
			}
		}
		podConfigValueMap[v.Id] = v
	}

	for id, _ := range oldPodConfigValueMap {
		if _, exists := podConfigValueMap[id]; !exists {
			if podConfigUsageCount[id] > 0 {
				errMsg := fmt.Sprintf("spec.podTemplate.options.podConfig.values with id '%s' is used by %d workspace", id, podConfigUsageCount[id])
				if podConfigUsageCount[id] > 1 {
					errMsg += "s"
				}
				return nil, fmt.Errorf(errMsg)
			}
		}
	}

	return podConfigValueMap, nil
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
