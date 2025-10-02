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
	"reflect"

	"google.golang.org/protobuf/proto"
	istiov1 "istio.io/client-go/pkg/apis/networking/v1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
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

// NormalizePodConfigSpec normalizes a PodConfigSpec so that it can be compared with reflect.DeepEqual
func NormalizePodConfigSpec(spec kubefloworgv1beta1.PodConfigSpec) error {

	// normalize Affinity
	if spec.Affinity != nil {

		// set Affinity to nil if it is empty
		if reflect.DeepEqual(spec.Affinity, corev1.Affinity{}) {
			spec.Affinity = nil
		}
	}

	// normalize NodeSelector
	if spec.NodeSelector != nil {

		// set NodeSelector to nil if it is empty
		if len(spec.NodeSelector) == 0 {
			spec.NodeSelector = nil
		}
	}

	// normalize Tolerations
	if spec.Tolerations != nil {

		// set Tolerations to nil if it is empty
		if len(spec.Tolerations) == 0 {
			spec.Tolerations = nil
		}
	}

	// normalize Resources
	if spec.Resources != nil {

		// if Resources.Requests is empty, set it to nil
		if len(spec.Resources.Requests) == 0 {
			spec.Resources.Requests = nil
		} else {
			// otherwise, normalize the values in Resources.Requests
			for key, value := range spec.Resources.Requests {
				q, err := resource.ParseQuantity(value.String())
				if err != nil {
					return err
				}
				spec.Resources.Requests[key] = q
			}
		}

		// if Resources.Limits is empty, set it to nil
		if len(spec.Resources.Limits) == 0 {
			spec.Resources.Limits = nil
		} else {
			// otherwise, normalize the values in Resources.Limits
			for key, value := range spec.Resources.Limits {
				q, err := resource.ParseQuantity(value.String())
				if err != nil {
					return err
				}
				spec.Resources.Limits[key] = q
			}
		}
	}

	return nil
}
