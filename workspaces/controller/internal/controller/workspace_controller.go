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
	"reflect"
	"strings"

	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/go-logr/logr"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/builder"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/helper"
)

const (
	// label keys
	workspaceNameLabel     = "notebooks.kubeflow.org/workspace-name"
	workspaceSelectorLabel = "statefulset"

	// lengths for resource names
	generateNameSuffixLength = 6
	maxServiceNameLength     = 63
	maxStatefulSetNameLength = 52 // https://github.com/kubernetes/kubernetes/issues/64023

	// state message formats for Workspace status
	stateMsgErrorUnknownWorkspaceKind      = "Workspace references unknown WorkspaceKind: %s"
	stateMsgErrorInvalidImageConfig        = "Workspace has invalid imageConfig: %s"
	stateMsgErrorInvalidPodConfig          = "Workspace has invalid podConfig: %s"
	stateMsgErrorGenFailureStatefulSet     = "Workspace failed to generate StatefulSet with error: %s"
	stateMsgErrorGenFailureService         = "Workspace failed to generate Service with error: %s"
	stateMsgErrorMultipleStatefulSets      = "Workspace owns multiple StatefulSets: %s"
	stateMsgErrorMultipleServices          = "Workspace owns multiple Services: %s"
	stateMsgErrorStatefulSetWarningEvent   = "Workspace StatefulSet has warning event: %s"
	stateMsgErrorPodUnschedulable          = "Workspace Pod is unschedulable: %s"
	stateMsgErrorPodSchedulingGate         = "Workspace Pod is waiting for scheduling gate: %s"
	stateMsgErrorPodSchedulerError         = "Workspace Pod has scheduler error: %s"
	stateMsgErrorContainerCrashLoopBackOff = "Workspace Container is not running (CrashLoopBackOff)"
	stateMsgErrorContainerImagePullBackOff = "Workspace Container is not running (ImagePullBackOff)"
	stateMsgPaused                         = "Workspace is paused"
	stateMsgPending                        = "Workspace is pending"
	stateMsgRunning                        = "Workspace is running"
	stateMsgTerminating                    = "Workspace is terminating"
	stateMsgUnknown                        = "Workspace is in an unknown state"
)

// WorkspaceReconciler reconciles a Workspace object
type WorkspaceReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

// +kubebuilder:rbac:groups=kubeflow.org,resources=workspaces,verbs=create;delete;get;list;patch;update;watch
// +kubebuilder:rbac:groups=kubeflow.org,resources=workspaces/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=kubeflow.org,resources=workspaces/finalizers,verbs=update
// +kubebuilder:rbac:groups=kubeflow.org,resources=workspacekinds,verbs=get;list;watch
// +kubebuilder:rbac:groups=kubeflow.org,resources=workspacekinds/finalizers,verbs=update
// +kubebuilder:rbac:groups=apps,resources=statefulsets,verbs=create;delete;get;list;patch;update;watch
// +kubebuilder:rbac:groups=core,resources=events,verbs=get;list;watch
// +kubebuilder:rbac:groups=core,resources=configmaps,verbs=get;list;watch
// +kubebuilder:rbac:groups=core,resources=pods,verbs=get;list;watch
// +kubebuilder:rbac:groups=core,resources=services,verbs=create;delete;get;list;patch;update;watch
// +kubebuilder:rbac:groups=networking.istio.io,resources=virtualservices,verbs=create;delete;get;list;patch;update;watch

func (r *WorkspaceReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) { //nolint:gocyclo
	log := log.FromContext(ctx)
	log.V(2).Info("reconciling Workspace")

	// fetch the Workspace
	workspace := &kubefloworgv1beta1.Workspace{}
	if err := r.Get(ctx, req.NamespacedName, workspace); err != nil {
		if client.IgnoreNotFound(err) == nil {
			// Request object not found, could have been deleted after reconcile request.
			// Owned objects are automatically garbage collected.
			// For additional cleanup logic use finalizers.
			// Return and don't requeue.
			return ctrl.Result{}, nil
		}
		log.Error(err, "unable to fetch Workspace")
		return ctrl.Result{}, err
	}
	if !workspace.GetDeletionTimestamp().IsZero() {
		log.V(2).Info("Workspace is being deleted")
		return ctrl.Result{}, nil
	}

	// fetch the WorkspaceKind
	workspaceKindName := workspace.Spec.Kind
	log = log.WithValues("workspaceKind", workspaceKindName)
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := r.Get(ctx, client.ObjectKey{Name: workspaceKindName}, workspaceKind); err != nil {
		if apierrors.IsNotFound(err) {
			log.V(0).Info("Workspace references unknown WorkspaceKind")
			return r.updateWorkspaceState(ctx, log, workspace,
				kubefloworgv1beta1.WorkspaceStateError,
				fmt.Sprintf(stateMsgErrorUnknownWorkspaceKind, workspaceKindName),
			)
		}
		log.Error(err, "unable to fetch WorkspaceKind for Workspace")
		return ctrl.Result{}, err
	}

	// add finalizer to WorkspaceKind
	// NOTE: finalizers can only be added to non-deleted objects
	if workspaceKind.GetDeletionTimestamp().IsZero() {
		if !controllerutil.ContainsFinalizer(workspaceKind, WorkspaceKindFinalizer) {
			controllerutil.AddFinalizer(workspaceKind, WorkspaceKindFinalizer)
			if err := r.Update(ctx, workspaceKind); err != nil {
				if apierrors.IsConflict(err) {
					log.V(2).Info("update conflict while adding finalizer to WorkspaceKind, will requeue")
					return ctrl.Result{Requeue: true}, nil
				}
				log.Error(err, "unable to add finalizer to WorkspaceKind")
				return ctrl.Result{}, err
			}
		}
	}

	// get the current and desired (after redirects) imageConfig
	currentImageConfig, desiredImageConfig, imageConfigRedirectChain, err := getImageConfig(workspace, workspaceKind)
	if err != nil {
		log.V(0).Info("failed to get imageConfig for Workspace", "error", err.Error())
		return r.updateWorkspaceState(ctx, log, workspace,
			kubefloworgv1beta1.WorkspaceStateError,
			fmt.Sprintf(stateMsgErrorInvalidImageConfig, err.Error()),
		)
	}
	if desiredImageConfig != nil {
		workspace.Status.PendingRestart = true
		workspace.Status.PodTemplateOptions.ImageConfig.Desired = desiredImageConfig.Id
		workspace.Status.PodTemplateOptions.ImageConfig.RedirectChain = imageConfigRedirectChain
	} else {
		workspace.Status.PodTemplateOptions.ImageConfig.Desired = currentImageConfig.Id
		workspace.Status.PodTemplateOptions.ImageConfig.RedirectChain = nil
	}

	// get the current and desired (after redirects) podConfig
	currentPodConfig, desiredPodConfig, podConfigRedirectChain, err := getPodConfig(workspace, workspaceKind)
	if err != nil {
		log.V(0).Info("failed to get podConfig for Workspace", "error", err.Error())
		return r.updateWorkspaceState(ctx, log, workspace,
			kubefloworgv1beta1.WorkspaceStateError,
			fmt.Sprintf(stateMsgErrorInvalidPodConfig, err.Error()),
		)
	}
	if desiredPodConfig != nil {
		workspace.Status.PendingRestart = true
		workspace.Status.PodTemplateOptions.PodConfig.Desired = desiredPodConfig.Id
		workspace.Status.PodTemplateOptions.PodConfig.RedirectChain = podConfigRedirectChain
	} else {
		workspace.Status.PodTemplateOptions.PodConfig.Desired = currentPodConfig.Id
		workspace.Status.PodTemplateOptions.PodConfig.RedirectChain = nil
	}

	//
	// TODO: in the future, we might want to use "pendingRestart" for other changes to WorkspaceKind that update the PodTemplate
	//       like `podMetadata`, `probes`, `extraEnv`, or `containerSecurityContext`. But for now, changes to these fields
	//       will result in a forced restart of all Workspaces using the WorkspaceKind.
	//

	// if the Workspace is paused and a restart is pending, update the Workspace with the new options
	if *workspace.Spec.Paused && workspace.Status.PendingRestart && !*workspace.Spec.DeferUpdates {
		workspace.Spec.PodTemplate.Options.ImageConfig = workspace.Status.PodTemplateOptions.ImageConfig.Desired
		workspace.Spec.PodTemplate.Options.PodConfig = workspace.Status.PodTemplateOptions.PodConfig.Desired
		if err := r.Update(ctx, workspace); err != nil {
			if apierrors.IsConflict(err) {
				log.V(2).Info("update conflict while updating Workspace, will requeue")
				return ctrl.Result{Requeue: true}, nil
			}
			log.Error(err, "unable to update Workspace")
			return ctrl.Result{}, err
		}
		workspace.Status.PendingRestart = false
		if err := r.Status().Update(ctx, workspace); err != nil {
			if apierrors.IsConflict(err) {
				log.V(2).Info("update conflict while updating Workspace status, will requeue")
				return ctrl.Result{Requeue: true}, nil
			}
			log.Error(err, "unable to update Workspace status")
			return ctrl.Result{}, err
		}
	}

	// generate StatefulSet
	statefulSet, err := generateStatefulSet(workspace, workspaceKind, currentImageConfig.Spec, currentPodConfig.Spec)
	if err != nil {
		log.V(0).Info("failed to generate StatefulSet for Workspace", "error", err.Error())
		return r.updateWorkspaceState(ctx, log, workspace,
			kubefloworgv1beta1.WorkspaceStateError,
			fmt.Sprintf(stateMsgErrorGenFailureStatefulSet, err.Error()),
		)
	}
	if err := ctrl.SetControllerReference(workspace, statefulSet, r.Scheme); err != nil {
		log.Error(err, "unable to set controller reference on StatefulSet")
		return ctrl.Result{}, err
	}

	// fetch StatefulSets
	// NOTE: we filter by StatefulSets that are owned by the Workspace, not by name
	//	     this allows us to generate a random name for the StatefulSet with `metadata.generateName`
	var statefulSetName string
	ownedStatefulSets := &appsv1.StatefulSetList{}
	listOpts := &client.ListOptions{
		FieldSelector: fields.OneTermEqualSelector(helper.IndexWorkspaceOwnerField, workspace.Name),
		Namespace:     req.Namespace,
	}
	if err := r.List(ctx, ownedStatefulSets, listOpts); err != nil {
		log.Error(err, "unable to list StatefulSets")
		return ctrl.Result{}, err
	}

	// reconcile StatefulSet
	switch numSts := len(ownedStatefulSets.Items); {
	case numSts > 1:
		statefulSetList := make([]string, len(ownedStatefulSets.Items))
		for i, sts := range ownedStatefulSets.Items {
			statefulSetList[i] = sts.Name
		}
		statefulSetListString := strings.Join(statefulSetList, ", ")
		log.Error(nil, "Workspace owns multiple StatefulSets", "statefulSets", statefulSetListString)
		return r.updateWorkspaceState(ctx, log, workspace,
			kubefloworgv1beta1.WorkspaceStateError,
			fmt.Sprintf(stateMsgErrorMultipleStatefulSets, statefulSetListString),
		)
	case numSts == 0:
		if err := r.Create(ctx, statefulSet); err != nil {
			log.Error(err, "unable to create StatefulSet")
			return ctrl.Result{}, err
		}
		statefulSetName = statefulSet.ObjectMeta.Name
		log.V(2).Info("StatefulSet created", "statefulSet", statefulSetName)
	default:
		foundStatefulSet := &ownedStatefulSets.Items[0]
		statefulSetName = foundStatefulSet.ObjectMeta.Name
		if helper.CopyStatefulSetFields(statefulSet, foundStatefulSet) {
			if err := r.Update(ctx, foundStatefulSet); err != nil {
				if apierrors.IsConflict(err) {
					log.V(2).Info("update conflict while updating StatefulSet, will requeue")
					return ctrl.Result{Requeue: true}, nil
				}
				log.Error(err, "unable to update StatefulSet")
				return ctrl.Result{}, err
			}
			log.V(2).Info("StatefulSet updated", "statefulSet", statefulSetName)
		}
		statefulSet = foundStatefulSet
	}

	// generate Service
	service, err := generateService(workspace, currentImageConfig.Spec)
	if err != nil {
		log.V(0).Info("failed to generate Service for Workspace", "error", err.Error())
		return r.updateWorkspaceState(ctx, log, workspace,
			kubefloworgv1beta1.WorkspaceStateError,
			fmt.Sprintf(stateMsgErrorGenFailureService, err.Error()),
		)
	}
	if err := ctrl.SetControllerReference(workspace, service, r.Scheme); err != nil {
		log.Error(err, "unable to set controller reference on Service")
		return ctrl.Result{}, err
	}

	// fetch Services
	// NOTE: we filter by Services that are owned by the Workspace, not by name
	//	     this allows us to generate a random name for the Service with `metadata.generateName`
	var serviceName string
	ownedServices := &corev1.ServiceList{}
	listOpts = &client.ListOptions{
		FieldSelector: fields.OneTermEqualSelector(helper.IndexWorkspaceOwnerField, workspace.Name),
		Namespace:     req.Namespace,
	}
	if err := r.List(ctx, ownedServices, listOpts); err != nil {
		log.Error(err, "unable to list Services")
		return ctrl.Result{}, err
	}

	// reconcile Service
	switch numServices := len(ownedServices.Items); {
	case numServices > 1:
		serviceList := make([]string, len(ownedServices.Items))
		for i, svc := range ownedServices.Items {
			serviceList[i] = svc.Name
		}
		serviceListString := strings.Join(serviceList, ", ")
		log.Error(nil, "Workspace owns multiple Services", "services", serviceListString)
		return r.updateWorkspaceState(ctx, log, workspace,
			kubefloworgv1beta1.WorkspaceStateError,
			fmt.Sprintf(stateMsgErrorMultipleServices, serviceListString),
		)
	case numServices == 0:
		if err := r.Create(ctx, service); err != nil {
			log.Error(err, "unable to create Service")
			return ctrl.Result{}, err
		}
		serviceName = service.ObjectMeta.Name
		log.V(2).Info("Service created", "service", serviceName)
	default:
		foundService := &ownedServices.Items[0]
		serviceName = foundService.ObjectMeta.Name
		if helper.CopyServiceFields(service, foundService) {
			if err := r.Update(ctx, foundService); err != nil {
				if apierrors.IsConflict(err) {
					log.V(2).Info("update conflict while updating Service, will requeue")
					return ctrl.Result{Requeue: true}, nil
				}
				log.Error(err, "unable to update Service")
				return ctrl.Result{}, err
			}
			log.V(2).Info("Service updated", "service", serviceName)
		}
	}

	//
	// TODO: reconcile the Istio VirtualService to expose the Workspace
	//       and implement the `spec.podTemplate.httpProxy` options
	//

	// fetch Pod
	// NOTE: the first StatefulSet Pod is always called "{statefulSetName}-0"
	podName := fmt.Sprintf("%s-0", statefulSetName)
	pod := &corev1.Pod{}
	if err := r.Get(ctx, client.ObjectKey{Name: podName, Namespace: req.Namespace}, pod); err != nil {
		if apierrors.IsNotFound(err) {
			pod = nil
		} else {
			log.Error(err, "unable to fetch Pod")
			return ctrl.Result{}, err
		}
	}

	// update Workspace status
	workspaceStatus, err := r.generateWorkspaceStatus(ctx, log, workspace, pod, statefulSet)
	if err != nil {
		return ctrl.Result{}, err
	}
	if !reflect.DeepEqual(workspace.Status, workspaceStatus) {
		workspace.Status = workspaceStatus
		if err := r.Status().Update(ctx, workspace); err != nil {
			if apierrors.IsConflict(err) {
				log.V(2).Info("update conflict while updating Workspace status, will requeue")
				return ctrl.Result{Requeue: true}, nil
			}
			log.Error(err, "unable to update Workspace status")
			return ctrl.Result{}, err
		}
	}

	return ctrl.Result{}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *WorkspaceReconciler) SetupWithManager(mgr ctrl.Manager) error {

	// NOTE: the SetupManagerFieldIndexers() helper in `helper/index.go` should have already been
	//       called on `mgr` by the time this function is called, so the indexes are already set up

	// function to convert pod events to reconcile requests for workspaces
	mapPodToRequest := func(ctx context.Context, object client.Object) []reconcile.Request {
		return []reconcile.Request{
			{
				NamespacedName: types.NamespacedName{
					Name:      object.GetLabels()[workspaceNameLabel],
					Namespace: object.GetNamespace(),
				},
			},
		}
	}

	// predicate function to filter pods that are labeled with the "workspace-name" label key
	predPodHasWSLabel := predicate.NewPredicateFuncs(func(object client.Object) bool {
		_, labelExists := object.GetLabels()[workspaceNameLabel]
		return labelExists
	})

	return ctrl.NewControllerManagedBy(mgr).
		For(&kubefloworgv1beta1.Workspace{}).
		Owns(&appsv1.StatefulSet{}).
		Owns(&corev1.Service{}).
		Watches(
			&kubefloworgv1beta1.WorkspaceKind{},
			handler.EnqueueRequestsFromMapFunc(r.mapWorkspaceKindToRequest),
			builder.WithPredicates(predicate.GenerationChangedPredicate{}),
		).
		Watches(
			&corev1.Pod{},
			handler.EnqueueRequestsFromMapFunc(mapPodToRequest),
			builder.WithPredicates(predicate.ResourceVersionChangedPredicate{}, predPodHasWSLabel),
		).
		Complete(r)
}

// updateWorkspaceState attempts to immediately update the Workspace status with the provided state and message
func (r *WorkspaceReconciler) updateWorkspaceState(ctx context.Context, log logr.Logger, workspace *kubefloworgv1beta1.Workspace, state kubefloworgv1beta1.WorkspaceState, message string) (ctrl.Result, error) { //nolint:unparam
	if workspace == nil {
		return ctrl.Result{}, fmt.Errorf("provided Workspace was nil")
	}
	if workspace.Status.State != state || workspace.Status.StateMessage != message {
		workspace.Status.State = state
		workspace.Status.StateMessage = message
		if err := r.Status().Update(ctx, workspace); err != nil {
			if apierrors.IsConflict(err) {
				log.V(2).Info("update conflict while updating Workspace status, will requeue")
				return ctrl.Result{Requeue: true}, nil
			}
			log.Error(err, "unable to update Workspace status")
			return ctrl.Result{}, err
		}
	}
	return ctrl.Result{}, nil
}

// mapWorkspaceKindToRequest converts WorkspaceKind events to reconcile requests for Workspaces
func (r *WorkspaceReconciler) mapWorkspaceKindToRequest(ctx context.Context, workspaceKind client.Object) []reconcile.Request {
	attachedWorkspaces := &kubefloworgv1beta1.WorkspaceList{}
	listOps := &client.ListOptions{
		FieldSelector: fields.OneTermEqualSelector(helper.IndexWorkspaceKindField, workspaceKind.GetName()),
		Namespace:     "", // fetch Workspaces in all namespaces
	}
	err := r.List(ctx, attachedWorkspaces, listOps)
	if err != nil {
		return []reconcile.Request{}
	}

	requests := make([]reconcile.Request, len(attachedWorkspaces.Items))
	for i, item := range attachedWorkspaces.Items {
		requests[i] = reconcile.Request{
			NamespacedName: types.NamespacedName{
				Name:      item.GetName(),
				Namespace: item.GetNamespace(),
			},
		}
	}
	return requests
}

// getImageConfig returns the current and desired (after redirects) ImageConfigValues for the Workspace
func getImageConfig(workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind) (*kubefloworgv1beta1.ImageConfigValue, *kubefloworgv1beta1.ImageConfigValue, []kubefloworgv1beta1.WorkspacePodOptionRedirectStep, error) {
	imageConfigIdMap := make(map[string]kubefloworgv1beta1.ImageConfigValue)
	for _, imageConfig := range workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values {
		imageConfigIdMap[imageConfig.Id] = imageConfig
	}

	// get currently selected imageConfig (ignoring any redirects)
	currentImageConfigKey := workspace.Spec.PodTemplate.Options.ImageConfig
	currentImageConfig, ok := imageConfigIdMap[currentImageConfigKey]
	if !ok {
		return nil, nil, nil, fmt.Errorf("imageConfig with id %q not found", currentImageConfigKey)
	}

	// follow any redirects to get the desired imageConfig
	desiredImageConfig := currentImageConfig
	var redirectChain []kubefloworgv1beta1.WorkspacePodOptionRedirectStep
	visitedNodes := map[string]bool{currentImageConfig.Id: true}
	for {
		if desiredImageConfig.Redirect == nil {
			break
		}
		if visitedNodes[desiredImageConfig.Redirect.To] {
			return nil, nil, nil, fmt.Errorf("imageConfig with id %q has a circular redirect", desiredImageConfig.Id)
		}
		nextNode, ok := imageConfigIdMap[desiredImageConfig.Redirect.To]
		if !ok {
			return nil, nil, nil, fmt.Errorf("imageConfig with id %q not found, was redirected from %q", desiredImageConfig.Redirect.To, desiredImageConfig.Id)
		}
		redirectChain = append(redirectChain, kubefloworgv1beta1.WorkspacePodOptionRedirectStep{
			Source: desiredImageConfig.Id,
			Target: nextNode.Id,
		})
		desiredImageConfig = nextNode
		visitedNodes[desiredImageConfig.Id] = true
	}

	// if the current imageConfig and desired imageConfig are different, return both
	if currentImageConfig.Id != desiredImageConfig.Id {
		return &currentImageConfig, &desiredImageConfig, redirectChain, nil
	} else {
		return &currentImageConfig, nil, nil, nil
	}
}

// getPodConfig returns the current and desired (after redirects) PodConfigValues for the Workspace
func getPodConfig(workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind) (*kubefloworgv1beta1.PodConfigValue, *kubefloworgv1beta1.PodConfigValue, []kubefloworgv1beta1.WorkspacePodOptionRedirectStep, error) {
	podConfigIdMap := make(map[string]kubefloworgv1beta1.PodConfigValue)
	for _, podConfig := range workspaceKind.Spec.PodTemplate.Options.PodConfig.Values {
		podConfigIdMap[podConfig.Id] = podConfig
	}

	// get currently selected podConfig (ignoring any redirects)
	currentPodConfigKey := workspace.Spec.PodTemplate.Options.PodConfig
	currentPodConfig, ok := podConfigIdMap[currentPodConfigKey]
	if !ok {
		return nil, nil, nil, fmt.Errorf("podConfig with id %q not found", currentPodConfigKey)
	}

	// follow any redirects to get the desired podConfig
	desiredPodConfig := currentPodConfig
	var redirectChain []kubefloworgv1beta1.WorkspacePodOptionRedirectStep
	visitedNodes := map[string]bool{currentPodConfig.Id: true}
	for {
		if desiredPodConfig.Redirect == nil {
			break
		}
		if visitedNodes[desiredPodConfig.Redirect.To] {
			return nil, nil, nil, fmt.Errorf("podConfig with id %q has a circular redirect", desiredPodConfig.Id)
		}
		nextNode, ok := podConfigIdMap[desiredPodConfig.Redirect.To]
		if !ok {
			return nil, nil, nil, fmt.Errorf("podConfig with id %q not found, was redirected from %q", desiredPodConfig.Redirect.To, desiredPodConfig.Id)
		}
		redirectChain = append(redirectChain, kubefloworgv1beta1.WorkspacePodOptionRedirectStep{
			Source: desiredPodConfig.Id,
			Target: nextNode.Id,
		})
		desiredPodConfig = nextNode
		visitedNodes[desiredPodConfig.Id] = true
	}

	// if the current podConfig and desired podConfig are different, return both
	if currentPodConfig.Id != desiredPodConfig.Id {
		return &currentPodConfig, &desiredPodConfig, redirectChain, nil
	} else {
		return &currentPodConfig, nil, nil, nil
	}
}

// generateNamePrefix generates a name prefix for a Workspace
// the format is "ws-{WORKSPACE_NAME}-" the workspace name is truncated to fit within the max length
func generateNamePrefix(workspaceName string, maxLength int) string {
	namePrefix := fmt.Sprintf("ws-%s", workspaceName)
	maxLength = maxLength - generateNameSuffixLength // subtract 6 for the `metadata.generateName` suffix
	maxLength = maxLength - 1                        // subtract 1 for the trailing "-"
	if len(namePrefix) > maxLength {
		namePrefix = namePrefix[:min(len(namePrefix), maxLength)]
	}
	if namePrefix[len(namePrefix)-1] != '-' {
		namePrefix = namePrefix + "-"
	}
	return namePrefix
}

// generateStatefulSet generates a StatefulSet for a Workspace
func generateStatefulSet(workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind, imageConfigSpec kubefloworgv1beta1.ImageConfigSpec, podConfigSpec kubefloworgv1beta1.PodConfigSpec) (*appsv1.StatefulSet, error) {
	// generate name prefix
	namePrefix := generateNamePrefix(workspace.Name, maxStatefulSetNameLength)

	// generate replica count
	replicas := int32(1)
	if *workspace.Spec.Paused {
		replicas = int32(0)
	}

	// generate pod metadata
	// NOTE: pod metadata from the Workspace takes precedence over the WorkspaceKind
	podAnnotations := make(map[string]string)
	podLabels := make(map[string]string)
	if workspaceKind.Spec.PodTemplate.PodMetadata != nil {
		for k, v := range workspaceKind.Spec.PodTemplate.PodMetadata.Annotations {
			podAnnotations[k] = v
		}
		for k, v := range workspaceKind.Spec.PodTemplate.PodMetadata.Labels {
			podLabels[k] = v
		}
	}
	if workspace.Spec.PodTemplate.PodMetadata != nil {
		for k, v := range workspace.Spec.PodTemplate.PodMetadata.Annotations {
			podAnnotations[k] = v
		}
		for k, v := range workspace.Spec.PodTemplate.PodMetadata.Labels {
			podLabels[k] = v
		}
	}

	// generate container imagePullPolicy
	imagePullPolicy := corev1.PullIfNotPresent
	if imageConfigSpec.ImagePullPolicy != nil {
		imagePullPolicy = *imageConfigSpec.ImagePullPolicy
	}

	// define go string template functions
	// NOTE: these are used in places like the `extraEnv` values
	containerPortsIdMap := make(map[string]kubefloworgv1beta1.ImagePort)
	httpPathPrefixFunc := func(portId string) string {
		port, ok := containerPortsIdMap[portId]
		if ok {
			return fmt.Sprintf("/workspace/%s/%s/%s/", workspace.Namespace, workspace.Name, port.Id)
		} else {
			return ""
		}
	}

	// generate container ports
	containerPorts := make([]corev1.ContainerPort, len(imageConfigSpec.Ports))
	seenPorts := make(map[int32]bool)
	for i, port := range imageConfigSpec.Ports {
		if seenPorts[port.Port] {
			return nil, fmt.Errorf("duplicate port number %d in imageConfig", port.Port)
		}
		containerPorts[i] = corev1.ContainerPort{
			Name:          fmt.Sprintf("http-%d", port.Port),
			ContainerPort: port.Port,
			Protocol:      corev1.ProtocolTCP,
		}
		seenPorts[port.Port] = true

		// NOTE: we construct this map for use in the go string templates
		containerPortsIdMap[port.Id] = port
	}

	// generate container env
	containerEnv := make([]corev1.EnvVar, len(workspaceKind.Spec.PodTemplate.ExtraEnv))
	for i, env := range workspaceKind.Spec.PodTemplate.ExtraEnv {
		env := env.DeepCopy() // copy to avoid modifying the original
		if env.Value != "" {
			rawValue := env.Value
			outValue, err := helper.RenderExtraEnvValueTemplate(rawValue, httpPathPrefixFunc)
			if err != nil {
				return nil, fmt.Errorf("failed to render extraEnv %q: %w", env.Name, err)
			}
			env.Value = outValue
		}
		containerEnv[i] = *env
	}

	// generate container resources
	containerResources := corev1.ResourceRequirements{}
	if podConfigSpec.Resources != nil {
		containerResources = *podConfigSpec.Resources
	}

	// generate container probes
	var readinessProbe *corev1.Probe
	var livenessProbe *corev1.Probe
	var startupProbe *corev1.Probe
	if workspaceKind.Spec.PodTemplate.Probes != nil {
		if workspaceKind.Spec.PodTemplate.Probes.ReadinessProbe != nil {
			readinessProbe = workspaceKind.Spec.PodTemplate.Probes.ReadinessProbe
		}
		if workspaceKind.Spec.PodTemplate.Probes.LivenessProbe != nil {
			livenessProbe = workspaceKind.Spec.PodTemplate.Probes.LivenessProbe
		}
		if workspaceKind.Spec.PodTemplate.Probes.StartupProbe != nil {
			startupProbe = workspaceKind.Spec.PodTemplate.Probes.StartupProbe
		}
	}

	// generate volumes and volumeMounts
	volumes := make([]corev1.Volume, 0)
	volumeMounts := make([]corev1.VolumeMount, 0)
	seenVolumeNames := make(map[string]bool)
	seenVolumeMountPaths := make(map[string]bool)

	// add home volume
	if workspace.Spec.PodTemplate.Volumes.Home != nil {
		homeVolume := corev1.Volume{
			Name: "home-volume",
			VolumeSource: corev1.VolumeSource{
				PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
					ClaimName: *workspace.Spec.PodTemplate.Volumes.Home,
				},
			},
		}
		homeVolumeMount := corev1.VolumeMount{
			Name:      homeVolume.Name,
			MountPath: workspaceKind.Spec.PodTemplate.VolumeMounts.Home,
		}
		seenVolumeNames[homeVolume.Name] = true
		seenVolumeMountPaths[homeVolumeMount.MountPath] = true
		volumes = append(volumes, homeVolume)
		volumeMounts = append(volumeMounts, homeVolumeMount)
	}

	// add data volumes
	for i, data := range workspace.Spec.PodTemplate.Volumes.Data {
		dataVolume := corev1.Volume{
			Name: fmt.Sprintf("data-volume-%d", i),
			VolumeSource: corev1.VolumeSource{
				PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
					ClaimName: data.PVCName,
				},
			},
		}
		dataVolumeMount := corev1.VolumeMount{
			Name:      dataVolume.Name,
			MountPath: data.MountPath,
		}
		if *data.ReadOnly {
			dataVolume.PersistentVolumeClaim.ReadOnly = true
			dataVolumeMount.ReadOnly = true
		}
		if seenVolumeNames[dataVolume.Name] {
			// silently skip duplicate volume names
			// NOTE: should not be possible because the home volume uses a different name structure
			continue
		}
		if seenVolumeMountPaths[dataVolumeMount.MountPath] {
			// silently skip duplicate mount paths
			// NOTE: this will only happen if the user tries to mount a data volume at the same path as the home
			continue
		}
		seenVolumeNames[dataVolume.Name] = true
		seenVolumeMountPaths[dataVolumeMount.MountPath] = true
		volumes = append(volumes, dataVolume)
		volumeMounts = append(volumeMounts, dataVolumeMount)
	}

	// add extra volumes
	for _, extraVolume := range workspaceKind.Spec.PodTemplate.ExtraVolumes {
		if seenVolumeNames[extraVolume.Name] {
			// silently skip duplicate volume names
			continue
		}
		volumes = append(volumes, extraVolume)
		seenVolumeNames[extraVolume.Name] = true
	}

	// add extra volumeMounts
	for _, extraVolumeMount := range workspaceKind.Spec.PodTemplate.ExtraVolumeMounts {
		if seenVolumeMountPaths[extraVolumeMount.MountPath] {
			// silently skip duplicate mount paths
			continue
		}
		if !seenVolumeNames[extraVolumeMount.Name] {
			// silently skip mount paths that reference non-existent volume names
			continue
		}
		volumeMounts = append(volumeMounts, extraVolumeMount)
		seenVolumeMountPaths[extraVolumeMount.MountPath] = true
	}

	// generate StatefulSet
	statefulSet := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: namePrefix,
			Namespace:    workspace.Namespace,
			Labels: map[string]string{
				workspaceNameLabel: workspace.Name,
			},
		},
		//
		// NOTE: if you add new fields, ensure they are reflected in `helper.CopyStatefulSetFields()`
		//
		Spec: appsv1.StatefulSetSpec{
			Replicas: &replicas,
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{
					workspaceNameLabel:     workspace.Name,
					workspaceSelectorLabel: workspace.Name,
				},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Annotations: podAnnotations,
					Labels: labels.Merge(
						podLabels,
						map[string]string{
							workspaceNameLabel:     workspace.Name,
							workspaceSelectorLabel: workspace.Name,
						},
					),
				},
				Spec: corev1.PodSpec{
					Affinity: podConfigSpec.Affinity,
					Containers: []corev1.Container{
						{
							Name:            "main",
							Image:           imageConfigSpec.Image,
							ImagePullPolicy: imagePullPolicy,
							Ports:           containerPorts,
							ReadinessProbe:  readinessProbe,
							LivenessProbe:   livenessProbe,
							StartupProbe:    startupProbe,
							SecurityContext: workspaceKind.Spec.PodTemplate.ContainerSecurityContext,
							VolumeMounts:    volumeMounts,
							Env:             containerEnv,
							Resources:       containerResources,
						},
					},
					NodeSelector:       podConfigSpec.NodeSelector,
					SecurityContext:    workspaceKind.Spec.PodTemplate.SecurityContext,
					ServiceAccountName: workspaceKind.Spec.PodTemplate.ServiceAccount.Name,
					Tolerations:        podConfigSpec.Tolerations,
					Volumes:            volumes,
				},
			},
		},
	}

	return statefulSet, nil
}

// generateService generates a Service for a Workspace
func generateService(workspace *kubefloworgv1beta1.Workspace, imageConfigSpec kubefloworgv1beta1.ImageConfigSpec) (*corev1.Service, error) {
	// generate name prefix
	namePrefix := generateNamePrefix(workspace.Name, maxServiceNameLength)

	// generate service ports
	servicePorts := make([]corev1.ServicePort, len(imageConfigSpec.Ports))
	seenPorts := make(map[int32]bool)
	for i, port := range imageConfigSpec.Ports {
		if seenPorts[port.Port] {
			return nil, fmt.Errorf("duplicate port number %d in imageConfig", port.Port)
		}
		servicePorts[i] = corev1.ServicePort{
			Name:       fmt.Sprintf("http-%d", port.Port),
			TargetPort: intstr.FromInt32(port.Port),
			Port:       port.Port,
			Protocol:   corev1.ProtocolTCP,
		}
		seenPorts[port.Port] = true
	}

	// generate Service
	service := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: namePrefix,
			Namespace:    workspace.Namespace,
			Labels: map[string]string{
				workspaceNameLabel: workspace.Name,
			},
		},
		//
		// NOTE: if you add new fields, ensure they are reflected in `helper.CopyServiceFields()`
		//
		Spec: corev1.ServiceSpec{
			Ports: servicePorts,
			Selector: map[string]string{
				workspaceNameLabel:     workspace.Name,
				workspaceSelectorLabel: workspace.Name,
			},
			Type: corev1.ServiceTypeClusterIP,
		},
	}

	return service, nil
}

// generateWorkspaceStatus generates a WorkspaceStatus for a Workspace
func (r *WorkspaceReconciler) generateWorkspaceStatus(ctx context.Context, log logr.Logger, workspace *kubefloworgv1beta1.Workspace, pod *corev1.Pod, statefulSet *appsv1.StatefulSet) (kubefloworgv1beta1.WorkspaceStatus, error) {
	status := workspace.Status

	// if workspace is paused, update the `status.pauseTime`
	// NOTE: when the workspace is not paused, the pauseTime should be 0
	if *workspace.Spec.Paused {
		if status.PauseTime == 0 {
			status.PauseTime = metav1.Now().Unix()
		}
	} else {
		if status.PauseTime != 0 {
			status.PauseTime = 0
		}
	}

	// cases where the Pod does not exist
	if pod == nil {
		// STATUS: Paused
		if *workspace.Spec.Paused {
			status.State = kubefloworgv1beta1.WorkspaceStatePaused
			status.StateMessage = stateMsgPaused
			return status, nil
		}

		// there might be StatefulSet events
		statefulSetEvents := &corev1.EventList{}
		listOpts := &client.ListOptions{
			FieldSelector: fields.OneTermEqualSelector(helper.IndexEventInvolvedObjectUidField, string(statefulSet.UID)),
			Namespace:     statefulSet.Namespace,
		}
		if err := r.List(ctx, statefulSetEvents, listOpts); err != nil {
			log.Error(err, "unable to list StatefulSet events")
			return status, err
		}

		// find the last StatefulSet warning event
		var lastStsWarningEvent *corev1.Event
		if len(statefulSetEvents.Items) > 0 {
			for i, event := range statefulSetEvents.Items {
				if event.Type == corev1.EventTypeWarning {
					//
					// TODO: ensure this actually works when there are multiple Warning events for this object
					//
					if lastStsWarningEvent == nil || lastStsWarningEvent.LastTimestamp.Time.Before(event.LastTimestamp.Time) {
						lastStsWarningEvent = &statefulSetEvents.Items[i]
					}
				}
			}
		}

		// STATUS: Error (StatefulSet warning event)
		if lastStsWarningEvent != nil {
			status.State = kubefloworgv1beta1.WorkspaceStateError
			status.StateMessage = fmt.Sprintf(stateMsgErrorStatefulSetWarningEvent, lastStsWarningEvent.Message)
			return status, nil
		}
	}

	// cases where the Pod exists
	if pod != nil {
		// STATUS: Terminating
		if pod.GetDeletionTimestamp() != nil {
			status.State = kubefloworgv1beta1.WorkspaceStateTerminating
			status.StateMessage = stateMsgTerminating
			return status, nil
		}

		// get the pod phase
		// https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-phase
		podPhase := pod.Status.Phase

		// get the pod conditions
		// https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-conditions
		var podScheduledCondition corev1.PodCondition
		var podReadyCondition corev1.PodCondition
		for _, condition := range pod.Status.Conditions {
			switch condition.Type { //nolint:exhaustive
			case corev1.PodScheduled:
				podScheduledCondition = condition
			case corev1.PodReady:
				podReadyCondition = condition
			}
		}

		// unpack the pod conditions
		podScheduled := podScheduledCondition.Status == corev1.ConditionTrue
		podReady := podReadyCondition.Status == corev1.ConditionTrue

		// STATUS: Error (pod conditions)
		if !podScheduled {
			switch podScheduledCondition.Reason {
			case corev1.PodReasonUnschedulable:
				status.State = kubefloworgv1beta1.WorkspaceStateError
				status.StateMessage = fmt.Sprintf(stateMsgErrorPodUnschedulable, podScheduledCondition.Message)
				return status, nil
			case corev1.PodReasonSchedulingGated:
				status.State = kubefloworgv1beta1.WorkspaceStateError
				status.StateMessage = fmt.Sprintf(stateMsgErrorPodSchedulingGate, podScheduledCondition.Message)
				return status, nil
			case corev1.PodReasonSchedulerError:
				status.State = kubefloworgv1beta1.WorkspaceStateError
				status.StateMessage = fmt.Sprintf(stateMsgErrorPodSchedulerError, podScheduledCondition.Message)
				return status, nil
			}
		}

		// STATUS: Running
		if podPhase == corev1.PodRunning && podReady {
			status.State = kubefloworgv1beta1.WorkspaceStateRunning
			status.StateMessage = stateMsgRunning
			return status, nil
		}

		// get container status
		// https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-states
		var containerStatus corev1.ContainerStatus
		for _, container := range pod.Status.ContainerStatuses {
			if container.Name == "main" {
				containerStatus = container
				break
			}
		}

		// get the container state
		containerState := containerStatus.State

		// STATUS: Error (container state)
		if containerState.Waiting != nil {
			if containerState.Waiting.Reason == "CrashLoopBackOff" {
				status.State = kubefloworgv1beta1.WorkspaceStateError
				status.StateMessage = stateMsgErrorContainerCrashLoopBackOff
				return status, nil
			}
			if containerState.Waiting.Reason == "ImagePullBackOff" {
				status.State = kubefloworgv1beta1.WorkspaceStateError
				status.StateMessage = stateMsgErrorContainerImagePullBackOff
				return status, nil
			}
		}

		// STATUS: Pending
		if podPhase == corev1.PodPending {
			status.State = kubefloworgv1beta1.WorkspaceStatePending
			status.StateMessage = stateMsgPending
			return status, nil
		}
	}

	// STATUS: Unknown
	status.State = kubefloworgv1beta1.WorkspaceStateUnknown
	status.StateMessage = stateMsgUnknown
	return status, nil
}
