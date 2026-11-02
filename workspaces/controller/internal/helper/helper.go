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
	"fmt"

	"google.golang.org/protobuf/proto"
	istiov1 "istio.io/client-go/pkg/apis/networking/v1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	"k8s.io/apimachinery/pkg/api/equality"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

const (
	ControllerFieldOwner = "kubeflow-workspaces-controller"
)

// copyLabelFields copies metadata.labels from desired to target, returning the updated map and whether an update is required.
func copyLabelFields(desiredLabels map[string]string, targetLabels map[string]string) (map[string]string, bool) {
	requireUpdate := false

	// a key that changed or is only on the target (so it will be dropped)
	for k, v := range targetLabels {
		if desiredLabels[k] != v {
			requireUpdate = true
		}
	}
	// a key that is only on the desired side (so it must be added)
	for k, v := range desiredLabels {
		if targetLabels[k] != v {
			requireUpdate = true
		}
	}
	return desiredLabels, requireUpdate
}

// copyAnnotationFields copies metadata.annotations from desired to target, returning the updated map and whether an update is required.
func copyAnnotationFields(desiredAnnotations map[string]string, targetAnnotations map[string]string) (map[string]string, bool) {
	requireUpdate := false

	// a key that changed or is only on the target (so it will be dropped)
	for k, v := range targetAnnotations {
		if desiredAnnotations[k] != v {
			requireUpdate = true
		}
	}
	// a key that is only on the desired side (so it must be added)
	for k, v := range desiredAnnotations {
		if targetAnnotations[k] != v {
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

	// copy `spec.updateStrategy`
	if !equality.Semantic.DeepEqual(target.Spec.UpdateStrategy, desired.Spec.UpdateStrategy) {
		target.Spec.UpdateStrategy = desired.Spec.UpdateStrategy
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

// getFieldsOwnedByController returns the fields of obj that are owned by the controller,
// according to its `metadata.managedFields`.
// Only `Update` operations on the main resource are considered, because the controller never
// uses server-side apply and never writes to subresources of the objects it merges metadata into.
func getFieldsOwnedByController(obj metav1.Object) (*fieldpath.Set, error) {
	owned := &fieldpath.Set{}
	for index, entry := range obj.GetManagedFields() {
		if entry.Manager != ControllerFieldOwner ||
			entry.Operation != metav1.ManagedFieldsOperationUpdate ||
			entry.Subresource != "" {
			continue
		}
		if entry.FieldsType != "FieldsV1" {
			return nil, fmt.Errorf("unexpected managedFields entry at index %d: expected FieldsType=FieldsV1, got %s", index, entry.FieldsType)
		}
		entryFields := &fieldpath.Set{}
		if err := entryFields.FromJSON(entry.FieldsV1.GetRawReader()); err != nil {
			return nil, fmt.Errorf("unable to parse managedFields at index %d: %w", index, err)
		}
		owned = owned.Union(entryFields)
	}
	return owned, nil
}

// mergeStringMapFields sets every key of desired on target, returning the updated map and whether an update is required.
// Keys that are only present on the target are preserved, unless they are owned by the controller
// (i.e. `metadata.{mapField}.{key}` is in owned), in which case they are removed.
func mergeStringMapFields(desired map[string]string, target map[string]string, owned *fieldpath.Set, mapFieldPath fieldpath.Path) (map[string]string, bool) {
	requireUpdate := false

	// remove keys which are no longer desired, but only if the controller owns them
	// (i.e. it was the last manager to change their value)
	for k := range target {
		if _, ok := desired[k]; ok {
			continue
		}
		keyFieldPath := append(mapFieldPath, fieldpath.MakePathOrDie(k)...) //nolint:gocritic
		if owned.Has(keyFieldPath) {
			delete(target, k)
			requireUpdate = true
		}
	}

	// add or update the desired keys
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
func CopyServiceAccountFields(desired *corev1.ServiceAccount, target *corev1.ServiceAccount) (bool, error) {
	requireUpdate := false

	// NOTE: we merge rather than replace, because administrators and other controllers attach
	//       their own metadata to a ServiceAccount (e.g. the IAM annotations used by IRSA).
	//       A key that is no longer desired is only removed if the controller owns it in `metadata.managedFields`.
	//       Because we use `Update` (not server-side apply), the API server only gives us ownership of a key
	//       only when our write changes its value, and moves it to another manager when they change the
	//       value. As such, a key is removed only if we were the last to change its value, regardless of who
	//       first added it.
	owned, err := getFieldsOwnedByController(target)
	if err != nil {
		err = fmt.Errorf("unable to determine fields owned by controller for ServiceAccount %s/%s: %w", target.GetNamespace(), target.GetName(), err)
		return false, err
	}

	// copy `metadata.labels`, merging with existing labels
	var updated bool
	labelsFieldPath := fieldpath.MakePathOrDie("metadata", "labels")
	target.Labels, updated = mergeStringMapFields(desired.Labels, target.Labels, owned, labelsFieldPath)
	if updated {
		requireUpdate = true
	}

	// copy `metadata.annotations`, merging with existing annotations
	annotationsFieldPath := fieldpath.MakePathOrDie("metadata", "annotations")
	target.Annotations, updated = mergeStringMapFields(desired.Annotations, target.Annotations, owned, annotationsFieldPath)
	if updated {
		requireUpdate = true
	}

	return requireUpdate, nil
}

// CopyRoleBindingFields updates a target RoleBinding with the fields from a desired RoleBinding, returning true if an update is required.
// NOTE: `roleRef` is immutable and so is NOT copied, the caller should use it as the key to find the target RoleBinding to update.
func CopyRoleBindingFields(desired *rbacv1.RoleBinding, target *rbacv1.RoleBinding) bool {
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

	// copy `subjects`
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

// ReplaceWorkspaceAsController replaces the controller reference of the given object to a given workspace.
// Returns true if the controller reference was replaced, false if the object was already controlled by the workspace
// with the current APIVersion. Returns error if the object is owned by another non-Workspace controller.
func ReplaceWorkspaceAsController(obj metav1.Object, workspace *kubefloworgv1beta1.Workspace, scheme *runtime.Scheme) (bool, error) {
	currentController := metav1.GetControllerOf(obj)
	// do nothing if the current controller is already the given workspace with the current APIVersion
	// We do not use metav1.IsControlledBy(obj, workspace) because the reference should still be updated if only the version is different.
	if currentController != nil && currentController.UID == workspace.GetUID() && currentController.APIVersion == kubefloworgv1beta1.GroupVersion.String() {
		return false, nil
	}

	// the object is not controlled by the given workspace, we need to replace the controller reference
	if currentController != nil {
		// fail if the current controller is not a Workspace
		if !isWorkspaceControllerRef(currentController) {
			return false, fmt.Errorf("object %s/%s is controlled by %s/%s, which is not a Workspace",
				obj.GetNamespace(), obj.GetName(), currentController.Kind, currentController.Name)
		}

		// remove the current controller reference
		// NOTE: we do not use controllerutil.RemoveControllerReference()
		//       because it requires us to pass the current controller as a metav1.Object
		oldOwnerRefs := obj.GetOwnerReferences()
		newOwnerRefs := make([]metav1.OwnerReference, 0, len(oldOwnerRefs))
		for _, ref := range oldOwnerRefs {
			if ref.Controller != nil && *ref.Controller && ref.UID == currentController.UID {
				// skip the current controller reference
				continue
			}
			newOwnerRefs = append(newOwnerRefs, ref)
		}
		obj.SetOwnerReferences(newOwnerRefs)
	}

	// set the controller reference to the given workspace
	if err := controllerutil.SetControllerReference(workspace, obj, scheme); err != nil {
		return false, err
	}
	return true, nil
}
