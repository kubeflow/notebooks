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
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
)

// PVCCreate represents the request and response body for creating a PVC.
type PVCCreate struct {
	Name             string                              `json:"name"`
	AccessModes      []corev1.PersistentVolumeAccessMode `json:"accessModes"`
	StorageClassName string                              `json:"storageClassName"`
	Requests         StorageRequestsMutate               `json:"requests"`
}

// Validate validates the PVCCreate struct.
// NOTE: we only do basic validation, more complex validation is done by Kubernetes when attempting to create the PVC.
func (p *PVCCreate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate the PVC name
	namePath := prefix.Child("name")
	errs = append(errs, helper.ValidateKubernetesPVCName(namePath, p.Name)...)

	// validate the access modes
	accessModesPath := prefix.Child("accessModes")
	if len(p.AccessModes) == 0 {
		errs = append(errs, field.Required(accessModesPath, "at least one access mode is required"))
	}

	// validate the storage class name
	storageClassNamePath := prefix.Child("storageClassName")
	errs = append(errs, helper.ValidateKubernetesStorageClassName(storageClassNamePath, p.StorageClassName)...)

	// validate the storage requests
	storageRequestsPath := prefix.Child("requests")
	errs = append(errs, p.Requests.Validate(storageRequestsPath)...)

	return errs
}

type StorageRequestsMutate struct {
	Storage string `json:"storage"`
}

// Validate validates the StorageRequestsMutate struct.
func (s *StorageRequestsMutate) Validate(prefix *field.Path) []*field.Error {
	var errs []*field.Error

	// validate the storage request
	storagePath := prefix.Child("storage")
	_, err := resource.ParseQuantity(s.Storage)
	if err != nil {
		errs = append(errs, field.Invalid(storagePath, s.Storage, err.Error()))
	}

	return errs
}
