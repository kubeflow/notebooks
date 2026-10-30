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
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// StripEventForCache is a `cache.TransformFunc` which drops the parts of an Event that the
// controller never reads, before the Event is stored in the manager's cache.
//
// Events are the highest-churn object in a Kubernetes cluster, and the Event cache is cluster-wide
// (Kubernetes field selectors cannot express "only Events for Pods/StatefulSets owned by a
// Workspace", so every Warning Event in the cluster is cached). During an event storm, the number
// of cached Events is bounded only by the API server's `--event-ttl` (1 hour by default), so
// shrinking each cached Event directly shrinks the controller's worst-case memory usage.
//
// The fields which MUST be preserved are:
//   - `involvedObject.uid`       : used by the `IndexEventInvolvedObjectUidField` field index
//   - `involvedObject.kind`      : used by the Warning Event predicate and map function
//   - `involvedObject.namespace` : used by the map function to find the owning Workspace
//   - `involvedObject.name`      : used for logging/debugging
//   - `type`                     : used by the Warning Event predicate
//   - `reason`                   : short, and useful when debugging
//   - `message`                  : surfaced in `status.stateMessage`
//   - `lastTimestamp`            : used to pick the most recent Warning Event
//
// NOTE: this must be idempotent, as controller-runtime may call it on an already-transformed
//
//	object (e.g. on a re-sync).
func StripEventForCache(obj any) (any, error) {
	event, ok := obj.(*corev1.Event)
	if !ok {
		// not an Event (e.g. a `cache.DeletedFinalStateUnknown` tombstone), leave it untouched
		return obj, nil
	}

	// `managedFields` is frequently the single largest part of an Event, and is never read
	event.ManagedFields = nil

	// annotations are never read, and may contain large blobs
	// (e.g. `kubectl.kubernetes.io/last-applied-configuration`)
	event.Annotations = nil

	// clear the parts of the involved object reference which are never read
	event.InvolvedObject.APIVersion = ""
	event.InvolvedObject.ResourceVersion = ""
	event.InvolvedObject.FieldPath = ""

	// clear the top-level fields which are never read
	event.Source = corev1.EventSource{}
	event.FirstTimestamp = metav1.Time{}
	event.EventTime = metav1.MicroTime{}
	event.Series = nil
	event.Action = ""
	event.Related = nil
	event.ReportingController = ""
	event.ReportingInstance = ""

	return event, nil
}
