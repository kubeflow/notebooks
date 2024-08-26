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
	"fmt"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/webhook"
	"sigs.k8s.io/controller-runtime/pkg/webhook/admission"
)

// log is for logging in this package.
var (
	workspaceLog = logf.Log.WithName("workspace-resource")
	k8sClient    client.Client
)

// SetupWebhookWithManager will setup the manager to manage the webhooks
func (r *Workspace) SetupWebhookWithManager(mgr ctrl.Manager) error {
	k8sClient = mgr.GetClient()
	return ctrl.NewWebhookManagedBy(mgr).
		For(r).
		Complete()
}

// TODO(user): change verbs to "verbs=create;update;delete" if you want to enable deletion validation.
//+kubebuilder:webhook:path=/validate-kubeflow-org-v1beta1-workspace,mutating=false,failurePolicy=fail,sideEffects=None,groups=kubeflow.org,resources=workspaces,verbs=create;update,versions=v1beta1,name=vworkspace.kb.io,admissionReviewVersions=v1

var _ webhook.Validator = &Workspace{}

// ValidateCreate implements webhook.Validator so a webhook will be registered for the type
func (r *Workspace) ValidateCreate() (admission.Warnings, error) {
	workspaceLog.Info("validate create", "name", r.Name)

	workspaceKindName := r.Spec.Kind
	workspaceKind := &WorkspaceKind{}
	if err := k8sClient.Get(context.Background(), client.ObjectKey{Name: workspaceKindName}, workspaceKind); err != nil {
		return nil, fmt.Errorf("workspace kind %s not found", workspaceKindName)
	}

	var errorList ErrorList
	if err := validateImageConfig(workspaceKind, r.Spec.PodTemplate.Options.ImageConfig); err != nil {
		errorList = append(errorList, err.Error())
	}
	if err := validatePodConfig(workspaceKind, r.Spec.PodTemplate.Options.PodConfig); err != nil {
		errorList = append(errorList, err.Error())
	}

	if len(errorList) > 0 {
		return nil, errorList
	}

	return nil, nil
}

// ValidateUpdate implements webhook.Validator so a webhook will be registered for the type
func (r *Workspace) ValidateUpdate(old runtime.Object) (admission.Warnings, error) {
	workspaceLog.Info("validate update", "name", r.Name)

	oldWorkspace, ok := old.(*Workspace)
	if !ok {
		return nil, fmt.Errorf("old object is not a workspace")
	}
	workspaceKindName := r.Spec.Kind
	workspaceKind := &WorkspaceKind{}
	if err := k8sClient.Get(context.Background(), client.ObjectKey{Name: workspaceKindName}, workspaceKind); err != nil {
		return nil, fmt.Errorf("workspace kind %s not found", workspaceKindName)
	}
	var errorList ErrorList

	if r.Spec.PodTemplate.Options.ImageConfig != oldWorkspace.Spec.PodTemplate.Options.ImageConfig {
		if err := validateImageConfig(workspaceKind, r.Spec.PodTemplate.Options.ImageConfig); err != nil {
			errorList = append(errorList, err.Error())
		}
	}
	if r.Spec.PodTemplate.Options.PodConfig != oldWorkspace.Spec.PodTemplate.Options.PodConfig {
		if err := validatePodConfig(workspaceKind, r.Spec.PodTemplate.Options.PodConfig); err != nil {
			errorList = append(errorList, err.Error())
		}
	}

	if len(errorList) > 1 {
		return nil, errorList
	}
	return nil, nil
}

// validateImageConfig checks if the selected imageConfig is valid
func validateImageConfig(workspaceKind *WorkspaceKind, imageConfigID string) error {
	for _, imageConfig := range workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values {
		if imageConfig.Id == imageConfigID {
			return nil
		}
	}
	return fmt.Errorf("imageConfig %s not found in workspace kind %s", imageConfigID, workspaceKind.Name)
}

// validatePodConfig checks if the selected podConfig is valid
func validatePodConfig(workspaceKind *WorkspaceKind, podConfigID string) error {
	for _, podConfig := range workspaceKind.Spec.PodTemplate.Options.PodConfig.Values {
		if podConfig.Id == podConfigID {
			return nil
		}
	}
	return fmt.Errorf("podConfig %s not found in workspace kind %s", podConfigID, workspaceKind.Name)
}

// ValidateDelete implements webhook.Validator so a webhook will be registered for the type
func (r *Workspace) ValidateDelete() (admission.Warnings, error) {
	workspaceLog.Info("validate delete", "name", r.Name)

	// TODO(user): fill in your validation logic upon object deletion.
	return nil, nil
}
