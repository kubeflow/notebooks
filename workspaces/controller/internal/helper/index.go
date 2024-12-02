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
	"context"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

const (
	IndexEventInvolvedObjectUidField = ".involvedObject.uid"
	IndexWorkspaceOwnerField         = ".metadata.controller"
	IndexWorkspaceKindField          = ".spec.kind"
)

// SetupManagerFieldIndexers sets up field indexes on a controller-runtime manager
func SetupManagerFieldIndexers(mgr ctrl.Manager) error {

	// Index Event by `involvedObject.uid`
	if err := mgr.GetFieldIndexer().IndexField(context.Background(), &corev1.Event{}, IndexEventInvolvedObjectUidField, func(rawObj client.Object) []string {
		event := rawObj.(*corev1.Event)
		if event.InvolvedObject.UID == "" {
			return nil
		}
		return []string{string(event.InvolvedObject.UID)}
	}); err != nil {
		return err
	}

	// Index StatefulSet by its owner Workspace
	if err := mgr.GetFieldIndexer().IndexField(context.Background(), &appsv1.StatefulSet{}, IndexWorkspaceOwnerField, func(rawObj client.Object) []string {
		statefulSet := rawObj.(*appsv1.StatefulSet)
		owner := metav1.GetControllerOf(statefulSet)
		if owner == nil {
			return nil
		}
		if owner.APIVersion != kubefloworgv1beta1.GroupVersion.String() || owner.Kind != "Workspace" {
			return nil
		}
		return []string{owner.Name}
	}); err != nil {
		return err
	}

	// Index Service by its owner Workspace
	if err := mgr.GetFieldIndexer().IndexField(context.Background(), &corev1.Service{}, IndexWorkspaceOwnerField, func(rawObj client.Object) []string {
		service := rawObj.(*corev1.Service)
		owner := metav1.GetControllerOf(service)
		if owner == nil {
			return nil
		}
		if owner.APIVersion != kubefloworgv1beta1.GroupVersion.String() || owner.Kind != "Workspace" {
			return nil
		}
		return []string{owner.Name}
	}); err != nil {
		return err
	}

	// Index Workspace by WorkspaceKind
	if err := mgr.GetFieldIndexer().IndexField(context.Background(), &kubefloworgv1beta1.Workspace{}, IndexWorkspaceKindField, func(rawObj client.Object) []string {
		ws := rawObj.(*kubefloworgv1beta1.Workspace)
		if ws.Spec.Kind == "" {
			return nil
		}
		return []string{ws.Spec.Kind}
	}); err != nil {
		return err
	}

	return nil
}
