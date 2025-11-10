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

package common

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	AnnotationCreatedBy = "notebooks.kubeflow.org/created-by"
	AnnotationUpdatedAt = "notebooks.kubeflow.org/updated-at"
	AnnotationUpdatedBy = "notebooks.kubeflow.org/updated-by"
	LabelCanMount       = "notebooks.kubeflow.org/can-mount"
	LabelCanUpdate      = "notebooks.kubeflow.org/can-update"
)

// Audit represents audit information for resources
type Audit struct {
	CreatedAt metav1.Time  `json:"createdAt"`
	CreatedBy *string      `json:"createdBy"`
	UpdatedAt *metav1.Time `json:"updatedAt"`
	UpdatedBy *string      `json:"updatedBy"`
	DeletedAt *metav1.Time `json:"deletedAt"`
}
