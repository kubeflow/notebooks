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
	"bytes"
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
	"strings"
	"text/template"
)

type ErrorList []string

func (e ErrorList) Error() string {
	return strings.Join(e, " , ")
}

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
	for _, podConfigValue := range r.Spec.PodTemplate.Options.PodConfig.Values {
		podConfigValueMap[podConfigValue.Id] = podConfigValue
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

	if _, err := RenderAndValidateExtraEnv(r.Spec.PodTemplate.ExtraEnv, func(string) string { return "" }, false); err != nil {
		return nil, err
	}

	return nil, nil
}

// ValidateUpdate implements webhook.Validator so a webhook will be registered for the type
func (r *WorkspaceKind) ValidateUpdate(old runtime.Object) (admission.Warnings, error) {
	var (
		imageConfigUsageCount        map[string]int
		podConfigUsageCount          map[string]int
		isConfigUsageCountCalculated bool
		err                          error
	)

	generateAndValidateImageConfig := func(imageConfig ImageConfig, oldImageConfig ImageConfig) (map[string]ImageConfigValue, map[string]ImageConfigValue, error) {
		oldImageConfigValueMap := make(map[string]ImageConfigValue)
		imageConfigValueMap := make(map[string]ImageConfigValue)

		for _, imageConfigValue := range oldImageConfig.Values {
			oldImageConfigValueMap[imageConfigValue.Id] = imageConfigValue
		}

		for _, imageConfigValue := range imageConfig.Values {
			if oldImageConfigValue, exists := oldImageConfigValueMap[imageConfigValue.Id]; exists {
				if !isConfigUsageCountCalculated {
					imageConfigUsageCount, podConfigUsageCount, err = getConfigUsageCount(r.Name)
					if err != nil {
						return nil, nil, err
					}
					isConfigUsageCountCalculated = true
				}
				if imageConfigUsageCount[imageConfigValue.Id] > 0 && !reflect.DeepEqual(oldImageConfigValue.Spec, imageConfigValue.Spec) {
					return nil, nil, fmt.Errorf("spec.podTemplate.options.imageConfig.values with id '%s' is immutable because it is used by %d workspace(s)", imageConfigValue.Id, imageConfigUsageCount[imageConfigValue.Id])
				}
			}
			imageConfigValueMap[imageConfigValue.Id] = imageConfigValue
		}

		for id, _ := range oldImageConfigValueMap {
			if _, exists := imageConfigValueMap[id]; !exists && imageConfigUsageCount[id] > 0 {
				return nil, nil, fmt.Errorf("spec.podTemplate.options.imageConfig.values with id '%s' is used by %d workspace(s)", id, imageConfigUsageCount[id])
			}
		}
		return imageConfigValueMap, oldImageConfigValueMap, nil
	}
	generateAndValidatePodConfig := func(podConfig PodConfig, oldPodConfig PodConfig) (map[string]PodConfigValue, map[string]PodConfigValue, error) {
		oldPodConfigValueMap := make(map[string]PodConfigValue)
		podConfigValueMap := make(map[string]PodConfigValue)

		for _, podConfigValue := range oldPodConfig.Values {
			oldPodConfigValueMap[podConfigValue.Id] = podConfigValue
		}

		for _, podConfigValue := range podConfig.Values {
			if oldPodConfigValue, exists := oldPodConfigValueMap[podConfigValue.Id]; exists {
				err := normalizePodConfigSpec(&oldPodConfigValue.Spec)
				if err != nil {
					return nil, nil, err
				}
				err = normalizePodConfigSpec(&podConfigValue.Spec)
				if err != nil {
					return nil, nil, err
				}
				if !isConfigUsageCountCalculated {
					_, podConfigUsageCount, err = getConfigUsageCount(r.Name)
					if err != nil {
						return nil, nil, err
					}
					isConfigUsageCountCalculated = true
				}
				if podConfigUsageCount[podConfigValue.Id] > 0 && !reflect.DeepEqual(oldPodConfigValue.Spec, podConfigValue.Spec) {
					return nil, nil, fmt.Errorf("spec.podTemplate.options.podConfig.values with id '%s' is immutable because it is used by %d workspace(s)", podConfigValue.Id, podConfigUsageCount[podConfigValue.Id])
				}
			}
			podConfigValueMap[podConfigValue.Id] = podConfigValue
		}

		for id, _ := range oldPodConfigValueMap {
			if _, exists := podConfigValueMap[id]; !exists {
				if podConfigUsageCount[id] > 0 {
					return nil, nil, fmt.Errorf("spec.podTemplate.options.podConfig.values with id '%s' is used by %d workspace(s)", id, podConfigUsageCount[id])
				}
			}
		}

		return podConfigValueMap, oldPodConfigValueMap, nil
	}

	workspaceKindLog.Info("validate update", "name", r.Name)

	// Type assertion to convert the old runtime.Object to WorkspaceKind
	oldWorkspaceKind, ok := old.(*WorkspaceKind)
	if !ok {
		return nil, errors.New("old object is not a WorkspaceKind")
	}

	imageConfigValueMap, oldImageConfigValueMap, err := generateAndValidateImageConfig(
		r.Spec.PodTemplate.Options.ImageConfig,
		oldWorkspaceKind.Spec.PodTemplate.Options.ImageConfig,
	)
	if err != nil {
		return nil, err
	}
	if !reflect.DeepEqual(imageConfigValueMap, oldImageConfigValueMap) {
		if err := validateImageConfigCycles(imageConfigValueMap); err != nil {
			return nil, err
		}
	}

	podConfigValueMap, oldPodConfigValueMap, err := generateAndValidatePodConfig(
		r.Spec.PodTemplate.Options.PodConfig,
		oldWorkspaceKind.Spec.PodTemplate.Options.PodConfig,
	)
	if err != nil {
		return nil, err
	}

	if !reflect.DeepEqual(podConfigValueMap, oldPodConfigValueMap) {
		if err := validatePodConfigCycle(podConfigValueMap); err != nil {
			return nil, err
		}
	}

	if !reflect.DeepEqual(imageConfigValueMap, oldImageConfigValueMap) ||
		!reflect.DeepEqual(podConfigValueMap, oldPodConfigValueMap) ||
		r.Spec.PodTemplate.Options.ImageConfig.Spawner.Default != oldWorkspaceKind.Spec.PodTemplate.Options.ImageConfig.Spawner.Default ||
		r.Spec.PodTemplate.Options.PodConfig.Spawner.Default != oldWorkspaceKind.Spec.PodTemplate.Options.PodConfig.Spawner.Default {
		if err := ensureDefaultOptions(imageConfigValueMap, podConfigValueMap, r.Spec.PodTemplate.Options); err != nil {
			return nil, err
		}
	}

	if !reflect.DeepEqual(r.Spec.PodTemplate.ExtraEnv, oldWorkspaceKind.Spec.PodTemplate.ExtraEnv) {
		if _, err := RenderAndValidateExtraEnv(r.Spec.PodTemplate.ExtraEnv, func(string) string { return "" }, false); err != nil {
			return nil, err
		}
	}

	return nil, nil
}

// ValidateDelete implements webhook.Validator so a webhook will be registered for the type
func (r *WorkspaceKind) ValidateDelete() (admission.Warnings, error) {
	workspaceKindLog.Info("validate delete", "name", r.Name)
	if r.Status.Workspaces > 0 {
		return nil, fmt.Errorf("can not delete workspaceKind %s becuase it is used by %d workspace(s)", r.Name, r.Status.Workspaces)
	}
	return nil, nil
}

func generateImageConfigAndValidatePorts(imageConfig ImageConfig) (map[string]ImageConfigValue, error) {
	var errorList ErrorList
	imageConfigValueMap := make(map[string]ImageConfigValue)
	for _, imageConfigValue := range imageConfig.Values {

		ports := make(map[int32]bool)
		for _, port := range imageConfigValue.Spec.Ports {
			if _, exists := ports[port.Port]; exists {
				errorList = append(errorList, fmt.Sprintf("duplicate port %d in imageConfig with id '%s'", port.Port, imageConfigValue.Id))
			}
			ports[port.Port] = true
		}

		imageConfigValueMap[imageConfigValue.Id] = imageConfigValue
	}
	if len(errorList) > 0 {
		return imageConfigValueMap, errorList
	}
	return imageConfigValueMap, nil
}

func ensureDefaultOptions(imageConfigValueMap map[string]ImageConfigValue, podConfigValueMap map[string]PodConfigValue, workspaceOptions WorkspaceKindPodOptions) error {
	var errorList ErrorList
	if _, ok := imageConfigValueMap[workspaceOptions.ImageConfig.Spawner.Default]; !ok {
		errorList = append(errorList, fmt.Sprintf("default image config with id '%s' is not found in spec.podTemplate.options.imageConfig.values", workspaceOptions.ImageConfig.Spawner.Default))
	}

	if _, ok := podConfigValueMap[workspaceOptions.PodConfig.Spawner.Default]; !ok {
		errorList = append(errorList, fmt.Sprintf("default pod config with id '%s' is not found in spec.podTemplate.options.podConfig.values", workspaceOptions.PodConfig.Spawner.Default))
	}
	if len(errorList) > 0 {
		return errorList
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

func RenderAndValidateExtraEnv(extraEnv []corev1.EnvVar, templateFunc func(string) string, shouldExecTemplate bool) ([]corev1.EnvVar, error) {
	var errorList ErrorList
	containerEnv := make([]corev1.EnvVar, 0)

	for _, env := range extraEnv {
		if env.Value != "" {
			rawValue := env.Value
			tmpl, err := template.New("value").Funcs(template.FuncMap{"httpPathPrefix": templateFunc}).Parse(rawValue)
			if err != nil {
				errorList = append(errorList, fmt.Sprintf("failed to parse value %q: %v", rawValue, err))
				continue
			}
			if shouldExecTemplate {
				var buf bytes.Buffer
				err = tmpl.Execute(&buf, nil)
				if err != nil {
					errorList = append(errorList, fmt.Sprintf("failed to execute template for extraEnv '%s': %v", env.Name, err))
					continue
				}

				env.Value = buf.String()
			}
		}
		containerEnv = append(containerEnv, env)
	}
	if len(errorList) > 0 {
		return nil, errorList
	}
	return containerEnv, nil

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

func normalizePodConfigSpec(spec *PodConfigSpec) (err error) {
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
			q, err := resource.ParseQuantity(value.String())
			if err != nil {
				return err
			}
			spec.Resources.Requests[key] = q
		}
	}

	// Normalize ResourceLimits
	if reflect.DeepEqual(spec.Resources.Limits, corev1.ResourceList{}) {
		spec.Resources.Limits = nil
	}
	if spec.Resources.Limits != nil {
		for key, value := range spec.Resources.Limits {
			q, err := resource.ParseQuantity(value.String())
			if err != nil {
				return err
			}
			spec.Resources.Limits[key] = q
		}
	}
	return nil
}
