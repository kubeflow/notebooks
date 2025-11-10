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
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// NewAuditFromObjectMeta creates an Audit instance from Kubernetes ObjectMeta.
// It extracts audit information from annotations, falling back to Kubernetes
// creation timestamp when annotations are not available.
func NewAuditFromObjectMeta(objectMeta *metav1.ObjectMeta) Audit {
	audit := Audit{}
	if objectMeta == nil {
		return audit
	}

	audit.CreatedAt = objectMeta.CreationTimestamp
	audit.DeletedAt = objectMeta.DeletionTimestamp

	if createdBy, ok := objectMeta.Annotations[AnnotationCreatedBy]; ok {
		audit.CreatedBy = &createdBy
	}
	if updatedAtStr, ok := objectMeta.Annotations[AnnotationUpdatedAt]; ok {
		if updateTime, err := time.Parse(time.RFC3339, updatedAtStr); err == nil {
			updatedAt := metav1.NewTime(updateTime)
			audit.UpdatedAt = &updatedAt
		}
	}
	if updatedBy, ok := objectMeta.Annotations[AnnotationUpdatedBy]; ok {
		audit.UpdatedBy = &updatedBy
	}

	return audit
}
