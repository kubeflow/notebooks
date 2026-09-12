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

	istiov1 "istio.io/client-go/pkg/apis/networking/v1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/config"
)

const (
	IndexEventInvolvedObjectUidField            = ".involvedObject.uid"
	IndexWorkspaceOwnerField                    = ".metadata.controller"
	IndexWorkspaceKindField                     = ".spec.kind"
	IndexWorkspaceKindConfigMapImageSourceField = ".spec.configMapImageSource"

	OwnerKindWorkspace = "Workspace"
)

// indexByWorkspaceOwner indexes the given object type under `IndexWorkspaceOwnerField`,
// by the name of the Workspace which is its controller owner
func indexByWorkspaceOwner(mgr ctrl.Manager, obj client.Object) error {
	return mgr.GetFieldIndexer().IndexField(context.Background(), obj, IndexWorkspaceOwnerField, func(rawObj client.Object) []string {
		owner := metav1.GetControllerOf(rawObj)
		if owner == nil {
			return nil
		}
		if owner.APIVersion != kubefloworgv1beta1.GroupVersion.String() || owner.Kind != OwnerKindWorkspace {
			return nil
		}
		return []string{owner.Name}
	})
}

// SetupManagerFieldIndexers sets up field indexes on a controller-runtime manager
func SetupManagerFieldIndexers(mgr ctrl.Manager, cfg *config.EnvConfig) error {

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
	if err := indexByWorkspaceOwner(mgr, &appsv1.StatefulSet{}); err != nil {
		return err
	}

	// Index Service by its owner Workspace
	if err := indexByWorkspaceOwner(mgr, &corev1.Service{}); err != nil {
		return err
	}

	// Index ServiceAccount by its owner Workspace
	if err := indexByWorkspaceOwner(mgr, &corev1.ServiceAccount{}); err != nil {
		return err
	}

	// Index RoleBinding by its owner Workspace
	if err := indexByWorkspaceOwner(mgr, &rbacv1.RoleBinding{}); err != nil {
		return err
	}

	// Index VirtualService by its owner Workspace (only when Istio is enabled)
	if cfg.UseIstio {
		if err := indexByWorkspaceOwner(mgr, &istiov1.VirtualService{}); err != nil {
			return err
		}
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

	// Index WorkspaceKind by ConfigMap image sources
	if err := mgr.GetFieldIndexer().IndexField(context.Background(), &kubefloworgv1beta1.WorkspaceKind{}, IndexWorkspaceKindConfigMapImageSourceField, func(rawObj client.Object) []string {
		wsk := rawObj.(*kubefloworgv1beta1.WorkspaceKind)
		indexValues := make([]string, 0, 2)
		iconConfigMap := wsk.Spec.Spawner.Icon.ConfigMap
		logoConfigMap := wsk.Spec.Spawner.Logo.ConfigMap
		if iconConfigMap != nil {
			indexValues = append(indexValues, iconConfigMap.Namespace+"/"+iconConfigMap.Name)
		}
		if logoConfigMap != nil {
			indexValues = append(indexValues, logoConfigMap.Namespace+"/"+logoConfigMap.Name)
		}
		return indexValues
	}); err != nil {
		return err
	}

	return nil
}
