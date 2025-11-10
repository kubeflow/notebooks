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

package helper

import (
	"errors"
	"strings"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	apivalidation "k8s.io/apimachinery/pkg/api/validation"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	v1validation "k8s.io/apimachinery/pkg/apis/meta/v1/validation"
	"k8s.io/apimachinery/pkg/util/validation"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

// StatusCausesFromAPIStatus extracts status causes from a Kubernetes apierrors.APIStatus error.
// NOTE: we use this to convert them to our own validation/conflict error format.
func StatusCausesFromAPIStatus(err error) []metav1.StatusCause {
	// ensure this is an APIStatus error
	var statusErr apierrors.APIStatus
	if status, ok := err.(apierrors.APIStatus); ok || errors.As(err, &status) {
		statusErr = status
	} else {
		return nil
	}

	// only attempt to extract causes if the status has details
	errStatus := statusErr.Status()
	if errStatus.Details == nil {
		return nil
	}

	return errStatus.Details.Causes
}

// ValidateFieldIsNotEmpty validates a field is not empty.
func ValidateFieldIsNotEmpty(path *field.Path, value string) field.ErrorList {
	var errs field.ErrorList

	if value == "" {
		errs = append(errs, field.Required(path, ""))
	}

	return errs
}

// ValidateFieldIsDNS1123Subdomain validates a field contains an RCF 1123 DNS subdomain.
// USED FOR:
//   - names of: Workspaces, WorkspaceKinds, Secrets, etc.
func ValidateFieldIsDNS1123Subdomain(path *field.Path, value string) field.ErrorList {
	var errs field.ErrorList

	if value == "" {
		errs = append(errs, field.Required(path, ""))
	} else {
		failures := validation.IsDNS1123Subdomain(value)
		if len(failures) > 0 {
			errs = append(errs, field.Invalid(path, value, strings.Join(failures, "; ")))
		}
	}

	return errs
}

// ValidateWorkspaceName validates a field contains a valid Workspace name.
func ValidateWorkspaceName(path *field.Path, value string) field.ErrorList {
	return ValidateFieldIsDNS1123Subdomain(path, value)
}

// ValidateWorkspaceKindName validates a field contains a valid WorkspaceKind name.
func ValidateWorkspaceKindName(path *field.Path, value string) field.ErrorList {
	return ValidateFieldIsDNS1123Subdomain(path, value)
}

// ValidateWorkspaceKindGVK validates the provided apiVersion and kind are for a WorkspaceKind.
func ValidateWorkspaceKindGVK(apiVersion, kind string) field.ErrorList {
	var errs field.ErrorList

	// validate apiVersion
	apiVersionPath := field.NewPath("apiVersion")
	if apiVersion == "" {
		errs = append(errs, field.Required(apiVersionPath, ""))
	} else {
		expectedApiVersion := kubefloworgv1beta1.GroupVersion.String()
		if apiVersion != expectedApiVersion {
			errs = append(errs, field.Invalid(apiVersionPath, apiVersion, "invalid apiVersion for a WorkspaceKind"))
		}
	}

	// validate kind
	kindPath := field.NewPath("kind")
	if kind == "" {
		errs = append(errs, field.Required(kindPath, ""))
	} else {
		expectedKind := "WorkspaceKind"
		if kind != expectedKind {
			errs = append(errs, field.Invalid(kindPath, kind, "invalid kind for a WorkspaceKind"))
		}
	}

	return errs
}

// ValidateKubernetesSecretName validates a field contains a valid Kubernetes Secret name.
func ValidateKubernetesSecretName(path *field.Path, value string) field.ErrorList {
	return ValidateFieldIsDNS1123Subdomain(path, value)
}

// ValidateFieldIsDNS1123Label validates a field contains an RCF 1123 DNS label.
// USED FOR:
//   - names of: Namespaces, Services, etc.
func ValidateFieldIsDNS1123Label(path *field.Path, value string) field.ErrorList {
	var errs field.ErrorList

	if value == "" {
		errs = append(errs, field.Required(path, ""))
	} else {
		failures := validation.IsDNS1123Label(value)
		if len(failures) > 0 {
			errs = append(errs, field.Invalid(path, value, strings.Join(failures, "; ")))
		}
	}

	return errs
}

// ValidateKubernetesNamespaceName validates a field contains a valid Kubernetes Namespace name.
func ValidateKubernetesNamespaceName(path *field.Path, value string) field.ErrorList {
	return ValidateFieldIsDNS1123Label(path, value)
}

// ValidateKubernetesServicesName validates a field contains a valid Kubernetes Service name.
func ValidateKubernetesServicesName(path *field.Path, value string) field.ErrorList {
	return ValidateFieldIsDNS1123Label(path, value)
}

// ValidateKubernetesAnnotations validates a map of Kubernetes annotations.
func ValidateKubernetesAnnotations(path *field.Path, annotations map[string]string) field.ErrorList {
	return apivalidation.ValidateAnnotations(annotations, path)
}

// ValidateKubernetesLabels validates a map of Kubernetes labels.
func ValidateKubernetesLabels(path *field.Path, labels map[string]string) field.ErrorList {
	return v1validation.ValidateLabels(labels, path)
}

// ValidateFieldIsConfigMapKey validates a field contains a valid key name.
// USED FOR:
//   - keys of: Secrets, ConfigMaps
func ValidateFieldIsConfigMapKey(path *field.Path, value string) field.ErrorList {
	var errs field.ErrorList

	if value == "" {
		errs = append(errs, field.Required(path, ""))
	} else {
		failures := validation.IsConfigMapKey(value)
		if len(failures) > 0 {
			errs = append(errs, field.Invalid(path, value, strings.Join(failures, "; ")))
		}
	}

	return errs
}
