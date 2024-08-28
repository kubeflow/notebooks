package helper

import (
	"reflect"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"k8s.io/apimachinery/pkg/api/resource"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
)

// CopyStatefulSetFields updates a target StatefulSet with the fields from a desired StatefulSet, returning true if an update is required.
func CopyStatefulSetFields(desired *appsv1.StatefulSet, target *appsv1.StatefulSet) bool {
	requireUpdate := false

	// copy `metadata.labels`
	for k, v := range target.Labels {
		if desired.Labels[k] != v {
			requireUpdate = true
		}
	}
	target.Labels = desired.Labels

	// copy `metadata.annotations`
	for k, v := range target.Annotations {
		if desired.Annotations[k] != v {
			requireUpdate = true
		}
	}
	target.Annotations = desired.Annotations

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
	if !reflect.DeepEqual(target.Spec.Selector, desired.Spec.Selector) {
		target.Spec.Selector = desired.Spec.Selector
		requireUpdate = true
	}

	// copy `spec.template`
	//
	// TODO: confirm if there is a problem with doing the update at the `spec.template` level
	//       or if only `spec.template.spec` should be updated
	//
	if !reflect.DeepEqual(target.Spec.Template, desired.Spec.Template) {
		target.Spec.Template = desired.Spec.Template
		requireUpdate = true
	}

	return requireUpdate
}

// CopyServiceFields updates a target Service with the fields from a desired Service, returning true if an update is required.
func CopyServiceFields(desired *corev1.Service, target *corev1.Service) bool {
	requireUpdate := false

	// copy `metadata.labels`
	for k, v := range target.Labels {
		if desired.Labels[k] != v {
			requireUpdate = true
		}
	}
	target.Labels = desired.Labels

	// copy `metadata.annotations`
	for k, v := range target.Annotations {
		if desired.Annotations[k] != v {
			requireUpdate = true
		}
	}
	target.Annotations = desired.Annotations

	// NOTE: we don't copy the entire `spec` because we can't overwrite the `spec.clusterIp` and similar fields

	// copy `spec.ports`
	if !reflect.DeepEqual(target.Spec.Ports, desired.Spec.Ports) {
		target.Spec.Ports = desired.Spec.Ports
		requireUpdate = true
	}

	// copy `spec.selector`
	if !reflect.DeepEqual(target.Spec.Selector, desired.Spec.Selector) {
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

// NormalizePodConfigSpec normalizes a PodConfigSpec so that it can be compared with reflect.DeepEqual
func NormalizePodConfigSpec(spec kubefloworgv1beta1.PodConfigSpec) error {
	// Normalize Affinity
	if spec.Affinity != nil && reflect.DeepEqual(spec.Affinity, corev1.Affinity{}) {
		spec.Affinity = nil
	}

	// Normalize NodeSelector
	if spec.NodeSelector != nil && len(spec.NodeSelector) == 0 {
		spec.NodeSelector = nil
	}

	// Normalize Tolerations
	if spec.Tolerations != nil && len(spec.Tolerations) == 0 {
		spec.Tolerations = nil
	}

	// Normalize Resources.Requests
	if reflect.DeepEqual(spec.Resources.Requests, corev1.ResourceList{}) {
		spec.Resources.Requests = nil
	}
	if spec.Resources.Requests != nil {
		for key, value := range spec.Resources.Requests {
			q, err := resource.ParseQuantity(value.String())
			if err != nil {
				return err
			}
			spec.Resources.Requests[key] = q
		}
	}

	// Normalize Resources.Limits
	if reflect.DeepEqual(spec.Resources.Limits, corev1.ResourceList{}) {
		spec.Resources.Limits = nil
	}
	if spec.Resources.Limits != nil {
		for key, value := range spec.Resources.Limits {
			q, err := resource.ParseQuantity(value.String())
			if err != nil {
				return err
			}
			spec.Resources.Limits[key] = q
		}
	}

	return nil
}
