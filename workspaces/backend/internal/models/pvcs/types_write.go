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

package pvcs

import (
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
)

// PVCCreate represents the request and response body for creating a PVC.
type PVCCreate struct {
	Name             string          `json:"name"`
	AccessModes      []string        `json:"accessModes"`
	StorageClassName string          `json:"storageClassName"`
	Requests         StorageRequests `json:"requests"`
}

// Validate validates the PVCCreate struct.
// NOTE: we only do basic validation, more complex validation is done by Kubernetes when attempting to create the PVC.
func (p *PVCCreate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate the PVC name
	namePath := prefix.Child("name")
	errs = append(errs, helper.ValidateFieldIsDNS1123Subdomain(namePath, p.Name)...)

	// validate the access modes
	accessModesPath := prefix.Child("accessModes")
	if len(p.AccessModes) == 0 {
		errs = append(errs, field.Required(accessModesPath, ""))
	}

	// validate the storage class name
	storageClassNamePath := prefix.Child("storageClassName")
	errs = append(errs, helper.ValidateFieldIsNotEmpty(storageClassNamePath, p.StorageClassName)...)

	// validate the storage request
	storagePath := prefix.Child("requests").Child("storage")
	errs = append(errs, helper.ValidateFieldIsNotEmpty(storagePath, p.Requests.Storage)...)

	return errs
}
