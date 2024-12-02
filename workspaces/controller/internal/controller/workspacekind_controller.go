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

package controller

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/builder"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/helper"
)

const (
	WorkspaceKindFinalizer = "notebooks.kubeflow.org/workspacekind-protection"
)

// WorkspaceKindReconciler reconciles a WorkspaceKind object
type WorkspaceKindReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

// +kubebuilder:rbac:groups=kubeflow.org,resources=workspacekinds,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=kubeflow.org,resources=workspacekinds/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=kubeflow.org,resources=workspacekinds/finalizers,verbs=update
// +kubebuilder:rbac:groups=kubeflow.org,resources=workspaces,verbs=get;list;watch

func (r *WorkspaceKindReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.FromContext(ctx)
	log.V(2).Info("reconciling WorkspaceKind")

	// fetch the WorkspaceKind
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := r.Get(ctx, req.NamespacedName, workspaceKind); err != nil {
		if client.IgnoreNotFound(err) == nil {
			// Request object not found, could have been deleted after reconcile request.
			// Owned objects are automatically garbage collected.
			// For additional cleanup logic use finalizers.
			// Return and don't requeue.
			return ctrl.Result{}, nil
		}
		log.Error(err, "unable to fetch WorkspaceKind")
		return ctrl.Result{}, err
	}

	// fetch all Workspaces that are using this WorkspaceKind
	workspaces := &kubefloworgv1beta1.WorkspaceList{}
	listOpts := &client.ListOptions{
		FieldSelector: fields.OneTermEqualSelector(helper.IndexWorkspaceKindField, workspaceKind.Name),
		Namespace:     "", // fetch Workspaces in all namespaces
	}
	if err := r.List(ctx, workspaces, listOpts); err != nil {
		log.Error(err, "unable to list Workspaces")
		return ctrl.Result{}, err
	}

	// if no Workspaces are using this WorkspaceKind, remove the finalizer
	numWorkspace := len(workspaces.Items)
	if numWorkspace == 0 {
		if controllerutil.ContainsFinalizer(workspaceKind, WorkspaceKindFinalizer) {
			controllerutil.RemoveFinalizer(workspaceKind, WorkspaceKindFinalizer)
			if err := r.Update(ctx, workspaceKind); err != nil {
				if apierrors.IsConflict(err) {
					log.V(2).Info("update conflict while removing finalizer from WorkspaceKind, will requeue")
					return ctrl.Result{Requeue: true}, nil
				}
				log.Error(err, "unable to remove finalizer from WorkspaceKind")
				return ctrl.Result{}, err
			}
		}
	}

	// count the number of Workspaces using each option
	imageConfigCount := make(map[string]int32)
	podConfigCount := make(map[string]int32)
	for _, imageConfig := range workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values {
		imageConfigCount[imageConfig.Id] = 0
	}
	for _, podConfig := range workspaceKind.Spec.PodTemplate.Options.PodConfig.Values {
		podConfigCount[podConfig.Id] = 0
	}
	for _, ws := range workspaces.Items {
		imageConfigCount[ws.Spec.PodTemplate.Options.ImageConfig]++
		podConfigCount[ws.Spec.PodTemplate.Options.PodConfig]++
	}

	// calculate the metrics for the WorkspaceKind
	imageConfigMetrics := make([]kubefloworgv1beta1.OptionMetric, len(workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values))
	podConfigMetrics := make([]kubefloworgv1beta1.OptionMetric, len(workspaceKind.Spec.PodTemplate.Options.PodConfig.Values))
	for i, imageConfig := range workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values {
		imageConfigMetrics[i] = kubefloworgv1beta1.OptionMetric{
			Id:         imageConfig.Id,
			Workspaces: imageConfigCount[imageConfig.Id],
		}
	}
	for i, podConfig := range workspaceKind.Spec.PodTemplate.Options.PodConfig.Values {
		podConfigMetrics[i] = kubefloworgv1beta1.OptionMetric{
			Id:         podConfig.Id,
			Workspaces: podConfigCount[podConfig.Id],
		}
	}

	// update the WorkspaceKind status
	workspaceKind.Status.Workspaces = int32(numWorkspace) //nolint:gosec
	workspaceKind.Status.PodTemplateOptions.ImageConfig = imageConfigMetrics
	workspaceKind.Status.PodTemplateOptions.PodConfig = podConfigMetrics
	if err := r.Status().Update(ctx, workspaceKind); err != nil {
		if apierrors.IsConflict(err) {
			log.V(2).Info("update conflict while updating WorkspaceKind status, will requeue")
			return ctrl.Result{Requeue: true}, nil
		}
		log.Error(err, "unable to update WorkspaceKind status")
		return ctrl.Result{}, err
	}

	return ctrl.Result{}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *WorkspaceKindReconciler) SetupWithManager(mgr ctrl.Manager) error {

	// NOTE: the SetupManagerFieldIndexers() helper in `helper/index.go` should have already been
	//       called on `mgr` by the time this function is called, so the indexes are already set up

	// function to convert Workspace events to reconcile requests for WorkspaceKinds
	mapWorkspaceToRequest := func(ctx context.Context, object client.Object) []reconcile.Request {
		return []reconcile.Request{
			{
				NamespacedName: types.NamespacedName{
					Name: object.(*kubefloworgv1beta1.Workspace).Spec.Kind,
				},
			},
		}
	}

	return ctrl.NewControllerManagedBy(mgr).
		For(&kubefloworgv1beta1.WorkspaceKind{}).
		Watches(
			&kubefloworgv1beta1.Workspace{},
			handler.EnqueueRequestsFromMapFunc(mapWorkspaceToRequest),
			builder.WithPredicates(predicate.GenerationChangedPredicate{}),
		).
		Complete(r)
}
