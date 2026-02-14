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

package storageclasses

import storagev1 "k8s.io/api/storage/v1"

const (
	LabelCanUse           = "notebooks.kubeflow.org/can-use"
	AnnotationDisplayName = "notebooks.kubeflow.org/display-name"
	AnnotationDescription = "notebooks.kubeflow.org/description"
)

// NewStorageClassListItemFromStorageClass creates a new StorageClassListItem model from a StorageClass object.
func NewStorageClassListItemFromStorageClass(sc *storagev1.StorageClass) StorageClassListItem {
	return StorageClassListItem{
		Name:        sc.Name,
		DisplayName: sc.Annotations[AnnotationDisplayName],
		Description: sc.Annotations[AnnotationDescription],
		CanUse:      sc.Labels[LabelCanUse] == "true",
	}
}
