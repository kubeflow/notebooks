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
	"google.golang.org/protobuf/proto"
	istiov1 "istio.io/client-go/pkg/apis/networking/v1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	"k8s.io/apimachinery/pkg/api/equality"
)

// copyLabelFields copies metadata.labels from desired to target, returning the updated map and whether an update is required.
func copyLabelFields(desiredLabels map[string]string, targetLabels map[string]string) (map[string]string, bool) {
	requireUpdate := false

	for k, v := range targetLabels {
		if desiredLabels[k] != v {
			requireUpdate = true
		}
	}
	return desiredLabels, requireUpdate
}

// copyAnnotationFields copies metadata.annotations from desired to target, returning the updated map and whether an update is required.
func copyAnnotationFields(desiredAnnotations map[string]string, targetAnnotations map[string]string) (map[string]string, bool) {
	requireUpdate := false

	for k, v := range targetAnnotations {
		if desiredAnnotations[k] != v {
			requireUpdate = true
		}
	}
	return desiredAnnotations, requireUpdate
}

// CopyStatefulSetFields updates a target StatefulSet with the fields from a desired StatefulSet, returning true if an update is required.
func CopyStatefulSetFields(desired *appsv1.StatefulSet, target *appsv1.StatefulSet) bool {
	requireUpdate := false

	// copy `metadata.labels`
	var updated bool
	target.Labels, updated = copyLabelFields(desired.Labels, target.Labels)
	if updated {
		requireUpdate = true
	}

	// copy `metadata.annotations`
	target.Annotations, updated = copyAnnotationFields(desired.Annotations, target.Annotations)
	if updated {
		requireUpdate = true
	}

	// copy `spec.replicas`
	if *desired.Spec.Replicas != *target.Spec.Replicas {
		*target.Spec.Replicas = *desired.Spec.Replicas
		requireUpdate = true
	}

	// copy `spec.selector`
	//
	// TODO: confirm if StatefulSets support updates to the selector
	//       if not, we might need to recreate the StatefulSet
	//
	if !equality.Semantic.DeepEqual(target.Spec.Selector, desired.Spec.Selector) {
		target.Spec.Selector = desired.Spec.Selector
		requireUpdate = true
	}

	// copy `spec.template`
	//
	// TODO: confirm if there is a problem with doing the update at the `spec.template` level
	//       or if only `spec.template.spec` should be updated
	//
	if !equality.Semantic.DeepEqual(target.Spec.Template, desired.Spec.Template) {
		target.Spec.Template = desired.Spec.Template
		requireUpdate = true
	}

	return requireUpdate
}

// CopyServiceFields updates a target Service with the fields from a desired Service, returning true if an update is required.
func CopyServiceFields(desired *corev1.Service, target *corev1.Service) bool {
	requireUpdate := false

	// copy `metadata.labels`
	var updated bool
	target.Labels, updated = copyLabelFields(desired.Labels, target.Labels)
	if updated {
		requireUpdate = true
	}

	// copy `metadata.annotations`
	target.Annotations, updated = copyAnnotationFields(desired.Annotations, target.Annotations)
	if updated {
		requireUpdate = true
	}

	// NOTE: we don't copy the entire `spec` because we can't overwrite the `spec.clusterIp` and similar fields

	// copy `spec.ports`
	if !equality.Semantic.DeepEqual(target.Spec.Ports, desired.Spec.Ports) {
		target.Spec.Ports = desired.Spec.Ports
		requireUpdate = true
	}

	// copy `spec.selector`
	if !equality.Semantic.DeepEqual(target.Spec.Selector, desired.Spec.Selector) {
		target.Spec.Selector = desired.Spec.Selector
		requireUpdate = true
	}

	// copy `spec.type`
	if target.Spec.Type != desired.Spec.Type {
		target.Spec.Type = desired.Spec.Type
		requireUpdate = true
	}

	return requireUpdate
}

// mergeStringMapFields sets every key of desired on target, returning the updated map and whether an update is required.
// NOTE: unlike copyLabelFields/copyAnnotationFields, keys that are only present on the target are preserved.
func mergeStringMapFields(desired map[string]string, target map[string]string) (map[string]string, bool) {
	requireUpdate := false

	for k, v := range desired {
		if target == nil {
			target = make(map[string]string, len(desired))
		}
		if target[k] != v {
			target[k] = v
			requireUpdate = true
		}
	}
	return target, requireUpdate
}

// CopyServiceAccountFields updates a target ServiceAccount with the fields from a desired ServiceAccount, returning true if an update is required.
func CopyServiceAccountFields(desired *corev1.ServiceAccount, target *corev1.ServiceAccount) bool {
	requireUpdate := false

	// NOTE: we merge rather than replace, because administrators and other controllers attach
	//       their own metadata to a ServiceAccount (e.g. the IAM annotations used by IRSA)

	var updated bool
	target.Labels, updated = mergeStringMapFields(desired.Labels, target.Labels)
	if updated {
		requireUpdate = true
	}

	target.Annotations, updated = mergeStringMapFields(desired.Annotations, target.Annotations)
	if updated {
		requireUpdate = true
	}

	return requireUpdate
}

// CopyRoleBindingFields updates a target RoleBinding with the fields from a desired RoleBinding, returning true if an update is required.
// NOTE: `roleRef` is immutable and so is NOT copied, the caller must compare it and recreate the RoleBinding when it has drifted.
func CopyRoleBindingFields(desired *rbacv1.RoleBinding, target *rbacv1.RoleBinding) bool {
	requireUpdate := false

	var updated bool
	target.Labels, updated = copyLabelFields(desired.Labels, target.Labels)
	if updated {
		requireUpdate = true
	}

	target.Annotations, updated = copyAnnotationFields(desired.Annotations, target.Annotations)
	if updated {
		requireUpdate = true
	}

	if !equality.Semantic.DeepEqual(target.Subjects, desired.Subjects) {
		target.Subjects = desired.Subjects
		requireUpdate = true
	}

	return requireUpdate
}

// CopyVirtualServiceFields updates a target VirtualService with the fields from a desired VirtualService, returning true if an update is required.
func CopyVirtualServiceFields(desired *istiov1.VirtualService, target *istiov1.VirtualService) bool {
	requireUpdate := false

	// copy `metadata.labels`
	var updated bool
	target.Labels, updated = copyLabelFields(desired.Labels, target.Labels)
	if updated {
		requireUpdate = true
	}

	// copy `metadata.annotations`
	target.Annotations, updated = copyAnnotationFields(desired.Annotations, target.Annotations)
	if updated {
		requireUpdate = true
	}

	// copy `spec`
	// NOTE: we use proto.Equal to compare the specs of Istio resources are protobuf messages
	//       and messages with the same value are not considered equal with reflect.DeepEqual
	if !proto.Equal(&target.Spec, &desired.Spec) {
		target.Spec = *desired.Spec.DeepCopy()
		requireUpdate = true
	}

	return requireUpdate
}
