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

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

// StatusCausesFromAPIStatus extracts status causes from a Kubernetes apierrors.APIStatus validation error.
// NOTE: we use this to convert them to our own validation error format.
func StatusCausesFromAPIStatus(err error) []metav1.StatusCause {
	// ensure this is an APIStatus error
	var statusErr apierrors.APIStatus
	if status, ok := err.(apierrors.APIStatus); ok || errors.As(err, &status) {
		statusErr = status
	} else {
		return nil
	}

	// only attempt to extract if the status is a validation error
	errStatus := statusErr.Status()
	if errStatus.Reason != metav1.StatusReasonInvalid {
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
