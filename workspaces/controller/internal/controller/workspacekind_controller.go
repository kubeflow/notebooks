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
	"fmt"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/equality"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/builder"
	"sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
	"sigs.k8s.io/controller-runtime/pkg/source"

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

	// ImageSourceCache is a filtered cache for ConfigMaps with the "notebooks.kubeflow.org/image-source=true" label.
	// The cache Transform pre-computes SHA256 hashes and stores them as virtual annotations.
	// It implements client.Reader (for Get/List) and is used as a watch source for ConfigMap changes.
	ImageSourceCache cache.Cache
}

// +kubebuilder:rbac:groups=kubeflow.org,resources=workspacekinds,verbs=create;delete;get;list;patch;update;watch
// +kubebuilder:rbac:groups=kubeflow.org,resources=workspacekinds/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=kubeflow.org,resources=workspacekinds/finalizers,verbs=update
// +kubebuilder:rbac:groups=kubeflow.org,resources=workspaces,verbs=get;list;watch
// +kubebuilder:rbac:groups="",resources=configmaps,verbs=get;list;watch

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

	// copy the current WorkspaceKind status, so we can avoid unnecessary updates if the status hasn't changed
	// NOTE: we dereference the DeepCopy of the status field because status fields are NOT pointers,
	//       so otherwise the `equality.Semantic.DeepEqual` will always return false.
	currentStatus := *workspaceKind.Status.DeepCopy()

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

	// populate the WorkspaceKind status
	workspaceKind.Status.Workspaces = int32(numWorkspace) //nolint:gosec
	workspaceKind.Status.PodTemplateOptions.ImageConfig = imageConfigMetrics
	workspaceKind.Status.PodTemplateOptions.PodConfig = podConfigMetrics

	// compute the asset status for the spawner icon and logo
	workspaceKind.Status.SpawnerIcon = r.reconcileAssetStatus(ctx, workspaceKind.Spec.Spawner.Icon)
	workspaceKind.Status.SpawnerLogo = r.reconcileAssetStatus(ctx, workspaceKind.Spec.Spawner.Logo)

	// update the WorkspaceKind status, if it has changed
	if !equality.Semantic.DeepEqual(currentStatus, workspaceKind.Status) {
		if err := r.Status().Update(ctx, workspaceKind); err != nil {
			if apierrors.IsConflict(err) {
				log.V(2).Info("update conflict while updating WorkspaceKind status, will requeue")
				return ctrl.Result{Requeue: true}, nil
			}
			log.Error(err, "unable to update WorkspaceKind status")
			return ctrl.Result{}, err
		}
	}

	return ctrl.Result{}, nil
}

// reconcileAssetStatus computes the ImageAssetStatus for a given WorkspaceKindAsset.
// For URL-based assets, the status is empty (no hash needed).
// For ConfigMap-based assets, it fetches the ConfigMap via the ImageSourceClient,
// reads the pre-computed SHA256 hash from the virtual annotation, and reports any errors.
func (r *WorkspaceKindReconciler) reconcileAssetStatus(ctx context.Context, asset kubefloworgv1beta1.WorkspaceKindAsset) kubefloworgv1beta1.ImageAssetStatus {
	log := log.FromContext(ctx)

	// URL-based assets don't need a hash or ConfigMap status
	if asset.Url != nil {
		return kubefloworgv1beta1.ImageAssetStatus{}
	}

	// ConfigMap-based assets
	if asset.ConfigMap == nil {
		return kubefloworgv1beta1.ImageAssetStatus{}
	}

	cmRef := asset.ConfigMap
	cm := &corev1.ConfigMap{}
	cmKey := types.NamespacedName{
		Namespace: cmRef.Namespace,
		Name:      cmRef.Name,
	}

	if err := r.ImageSourceCache.Get(ctx, cmKey, cm); err != nil {
		if apierrors.IsNotFound(err) {
			log.V(1).Info("ConfigMap not found for asset",
				"configMap", cmKey, "key", cmRef.Key)
			errType := kubefloworgv1beta1.ConfigMapErrorNotFound
			errMsg := fmt.Sprintf("ConfigMap %q not found in namespace %q (ensure it has the %q label)",
				cmRef.Name, cmRef.Namespace, helper.ImageSourceLabel)
			return kubefloworgv1beta1.ImageAssetStatus{
				ConfigMap: &kubefloworgv1beta1.WorkspaceKindConfigMapStatus{
					Error:        &errType,
					ErrorMessage: &errMsg,
				},
			}
		}
		log.Error(err, "unable to fetch ConfigMap for asset", "configMap", cmKey)
		errType := kubefloworgv1beta1.ConfigMapErrorOther
		errMsg := fmt.Sprintf("failed to get ConfigMap %q in namespace %q: %v",
			cmRef.Name, cmRef.Namespace, err)
		return kubefloworgv1beta1.ImageAssetStatus{
			ConfigMap: &kubefloworgv1beta1.WorkspaceKindConfigMapStatus{
				Error:        &errType,
				ErrorMessage: &errMsg,
			},
		}
	}

	// read the pre-computed SHA256 hash from the virtual annotation set by TransformConfigMapSha256
	annotationKey := helper.SHA256AnnotationPrefix + cmRef.Key
	sha256Hash, found := cm.GetAnnotations()[annotationKey]
	if !found {
		// the key does not exist in the ConfigMap's Data or BinaryData
		log.V(1).Info("ConfigMap key not found for asset",
			"configMap", cmKey, "key", cmRef.Key)
		errType := kubefloworgv1beta1.ConfigMapErrorKeyNotFound
		errMsg := fmt.Sprintf("key %q not found in ConfigMap %q in namespace %q",
			cmRef.Key, cmRef.Name, cmRef.Namespace)
		return kubefloworgv1beta1.ImageAssetStatus{
			ConfigMap: &kubefloworgv1beta1.WorkspaceKindConfigMapStatus{
				Error:        &errType,
				ErrorMessage: &errMsg,
			},
		}
	}

	return kubefloworgv1beta1.ImageAssetStatus{
		Sha256: sha256Hash,
	}
}

// SetupWithManager sets up the controller with the Manager.
func (r *WorkspaceKindReconciler) SetupWithManager(mgr ctrl.Manager, opts controller.Options) error {

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

	// function to convert ConfigMap events to reconcile requests for WorkspaceKinds
	// that reference the ConfigMap in their icon or logo spec
	mapConfigMapToRequests := func(ctx context.Context, cm *corev1.ConfigMap) []reconcile.Request {
		log := log.FromContext(ctx)

		// list all WorkspaceKinds and find those that reference this ConfigMap
		workspaceKindList := &kubefloworgv1beta1.WorkspaceKindList{}
		if err := r.List(ctx, workspaceKindList); err != nil {
			log.Error(err, "unable to list WorkspaceKinds for ConfigMap watch")
			return nil
		}

		var requests []reconcile.Request
		for _, wk := range workspaceKindList.Items {
			if assetReferencesConfigMap(wk.Spec.Spawner.Icon, cm) ||
				assetReferencesConfigMap(wk.Spec.Spawner.Logo, cm) {
				requests = append(requests, reconcile.Request{
					NamespacedName: types.NamespacedName{
						Name: wk.Name,
					},
				})
			}
		}
		return requests
	}

	return ctrl.NewControllerManagedBy(mgr).
		WithOptions(opts).
		For(&kubefloworgv1beta1.WorkspaceKind{}).
		Watches(
			&kubefloworgv1beta1.Workspace{},
			handler.EnqueueRequestsFromMapFunc(mapWorkspaceToRequest),
			builder.WithPredicates(predicate.GenerationChangedPredicate{}),
		).
		WatchesRawSource(
			source.Kind(r.ImageSourceCache, &corev1.ConfigMap{},
				handler.TypedEnqueueRequestsFromMapFunc(mapConfigMapToRequests),
			),
		).
		Complete(r)
}

// assetReferencesConfigMap returns true if the given asset references the specified ConfigMap.
func assetReferencesConfigMap(asset kubefloworgv1beta1.WorkspaceKindAsset, cm *corev1.ConfigMap) bool {
	if asset.ConfigMap == nil {
		return false
	}
	return asset.ConfigMap.Name == cm.Name && asset.ConfigMap.Namespace == cm.Namespace
}
