package helper

import (
	"errors"
	"reflect"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
)

func CopyStatefulSetFields(from, to *appsv1.StatefulSet) bool {
	requireUpdate := false
	for k, v := range to.Labels {
		if from.Labels[k] != v {
			requireUpdate = true
		}
	}
	to.Labels = from.Labels

	for k, v := range to.Annotations {
		if from.Annotations[k] != v {
			requireUpdate = true
		}
	}
	to.Annotations = from.Annotations

	if *from.Spec.Replicas != *to.Spec.Replicas {
		*to.Spec.Replicas = *from.Spec.Replicas
		requireUpdate = true
	}

	if !reflect.DeepEqual(to.Spec.Template.Spec, from.Spec.Template.Spec) {
		requireUpdate = true
	}
	to.Spec.Template.Spec = from.Spec.Template.Spec

	return requireUpdate
}

// CopyServiceFields copies the owned fields from one Service to another
func CopyServiceFields(from, to *corev1.Service) bool {
	requireUpdate := false
	for k, v := range to.Labels {
		if from.Labels[k] != v {
			requireUpdate = true
		}
	}
	to.Labels = from.Labels

	for k, v := range to.Annotations {
		if from.Annotations[k] != v {
			requireUpdate = true
		}
	}
	to.Annotations = from.Annotations

	// Don't copy the entire Spec, because we can't overwrite the clusterIp field

	if !reflect.DeepEqual(to.Spec.Selector, from.Spec.Selector) {
		requireUpdate = true
	}
	to.Spec.Selector = from.Spec.Selector

	if !reflect.DeepEqual(to.Spec.Ports, from.Spec.Ports) {
		requireUpdate = true
	}
	to.Spec.Ports = from.Spec.Ports

	return requireUpdate
}

// StopRetry is returned to tell the Retry function to stop retrying.
type StopRetry struct{ Err error }

// Error implements the error interface
func (s *StopRetry) Error() string { return s.Err.Error() }

// Retry will retry the given function until either the maximum attempts is reached or
// a stop error is returned.
func Retry(attempts int, sleep time.Duration, f func() error) error {
	if err := f(); err != nil {
		var stop *StopRetry
		if errors.As(err, &stop) {
			return stop.Err
		}
		// user can pass -1 to retry indefinitely
		if attempts--; attempts != 0 {
			time.Sleep(sleep)
			return Retry(attempts, 2*sleep, f)
		}
		return err
	}

	return nil
}
