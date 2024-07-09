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

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/intstr"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/builder"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

const (
	// label keys
	workspaceNameLabel     = "notebooks.kubeflow.org/workspace-name"
	workspaceSelectorLabel = "statefulset"

	// KubeBuilder cache fields
	kbCacheWorkspaceOwnerKey  = ".metadata.controller"
	kbCacheWorkspaceKindField = ".spec.kind"

	// lengths for resource names
	generateNameSuffixLength = 6
	maxServiceNameLength     = 63
	maxStatefulSetNameLength = 52 // https://github.com/kubernetes/kubernetes/issues/64023

	// state message formats for Workspace status
	stateMsgError                     = "Workspace has error"
	stateMsgErrorInvalidWorkspaceKind = "Workspace has invalid WorkspaceKind: %s"
	stateMsgErrorMultipleStatefulSets = "Workspace has multiple StatefulSets: %s"
	stateMsgErrorMultipleServices     = "Workspace has multiple Services: %s"
	stateMsgErrorPodCrashLoopBackOff  = "Workspace Pod is not running (CrashLoopBackOff)"
	stateMsgErrorPodImagePullBackOff  = "Workspace Pod is not running (ImagePullBackOff)"
	stateMsgPaused                    = "Workspace is paused"
	stateMsgPending                   = "Workspace is pending"
	stateMsgRunning                   = "Workspace is running"
	stateMsgTerminating               = "Workspace is terminating"
	stateMsgUnknown                   = "Workspace is in an unknown state"
)

var (
	apiGroupVersionStr = kubefloworgv1beta1.GroupVersion.String()
)

// WorkspaceReconciler reconciles a Workspace object
type WorkspaceReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

// +kubebuilder:rbac:groups=kubeflow.org,resources=workspaces,verbs=create;delete;get;list;patch;update;watch
// +kubebuilder:rbac:groups=kubeflow.org,resources=workspacekinds,verbs=get;list;watch
// +kubebuilder:rbac:groups=kubeflow.org,resources=workspaces/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=kubeflow.org,resources=workspaces/finalizers,verbs=update
// +kubebuilder:rbac:groups=apps,resources=statefulsets,verbs=create;delete;get;list;patch;update;watch
// +kubebuilder:rbac:groups=core,resources=pods,verbs=get;list;watch
// +kubebuilder:rbac:groups=core,resources=configmaps,verbs=get;list;watch
// +kubebuilder:rbac:groups=core,resources=services,verbs=create;delete;get;list;patch;update;watch
// +kubebuilder:rbac:groups="networking.istio.io",resources=virtualservices,verbs=create;delete;get;list;patch;update;watch

func (r *WorkspaceReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) { // nolint:gocyclo
	log := log.FromContext(ctx)
	log.WithValues("workspace", req.NamespacedName)
	log.V(1).Info("reconciling Workspace")

	// fetch the Workspace
	workspace := &kubefloworgv1beta1.Workspace{}
	if err := r.Get(ctx, req.NamespacedName, workspace); err != nil {
		log.Error(err, "unable to fetch Workspace")
		if client.IgnoreNotFound(err) == nil {
			// Request object not found, could have been deleted after reconcile request.
			// Owned objects are automatically garbage collected.
			// For additional cleanup logic use finalizers.
			// Return and don't requeue
			return ctrl.Result{}, nil
		}
		return ctrl.Result{}, err
	}
	if !workspace.GetDeletionTimestamp().IsZero() {
		log.V(1).Info("Workspace is being deleted")
		return ctrl.Result{}, nil
	}

	// fetch the WorkspaceKind
	workspaceKindName := workspace.Spec.Kind
	log.WithValues("workspaceKind", workspaceKindName)
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := r.Get(ctx, client.ObjectKey{Name: workspaceKindName}, workspaceKind); err != nil {
		if apierrors.IsNotFound(err) {
			workspace.Status.State = kubefloworgv1beta1.WorkspaceStateError
			workspace.Status.StateMessage = fmt.Sprintf(stateMsgErrorInvalidWorkspaceKind, workspaceKindName)
			if err := r.Status().Update(ctx, workspace); err != nil {
				log.Error(err, "unable to update Workspace status")
				return ctrl.Result{}, err
			}
			return ctrl.Result{}, nil
		}
		log.Error(err, "unable to fetch WorkspaceKind for Workspace")
		return ctrl.Result{}, err
	}

	// set the Workspace owner to the WorkspaceKind
	workspaceOwnerRef := metav1.GetControllerOf(workspace)
	if workspaceOwnerRef == nil {
		if err := ctrl.SetControllerReference(workspaceKind, workspace, r.Scheme); err != nil {
			log.Error(err, "unable to set controller reference on Workspace")
			return ctrl.Result{}, err
		}
		if err := r.Client.Update(ctx, workspace); err != nil {
			log.Error(err, "unable to update Workspace with WorkspaceKind owner")
			return ctrl.Result{}, err
		}
		log.V(1).Info("successfully set WorkspaceKind as owner of Workspace")
	} else if workspaceOwnerRef.UID != workspaceKind.GetUID() {
		//
		// TODO: handle the case that the WorkspaceKind has changed (LONG TERM GOAL)
		//       this will be non-trivial as we don't know if the new WorkspaceKind will have options that are
		//       compatible with the existing Workspace. For now, this case should not happen as we don't allow
		//       changing `spec.kind` and the Workspace is owned by the WorkspaceKind to prevent it from being deleted.
		//
		err := apierrors.NewBadRequest(fmt.Sprintf("Workspace has invalid owner: %s", workspaceOwnerRef.UID))
		log.Error(err, "Workspace has invalid controller owner")
		return ctrl.Result{}, err
	}

	// get the current and desired (after redirects) imageConfig
	currentImageConfig, desiredImageConfig, err := getImageConfig(workspace, workspaceKind)
	if err != nil {
		log.Error(err, "failed to get imageConfig for Workspace")
		return ctrl.Result{}, err
	}
	if desiredImageConfig != nil {
		workspace.Status.PendingRestart = true
		workspace.Status.PodTemplateOptions.ImageConfig = desiredImageConfig.Id
	} else {
		workspace.Status.PodTemplateOptions.ImageConfig = currentImageConfig.Id
	}

	// get the current and desired (after redirects) podConfig
	currentPodConfig, desiredPodConfig, err := getPodConfig(workspace, workspaceKind)
	if err != nil {
		log.Error(err, "failed to get podConfig for Workspace")
		return ctrl.Result{}, err
	}
	if desiredPodConfig != nil {
		workspace.Status.PendingRestart = true
		workspace.Status.PodTemplateOptions.PodConfig = desiredPodConfig.Id
	} else {
		workspace.Status.PodTemplateOptions.PodConfig = currentPodConfig.Id
	}

	//
	// TODO: in the future, we might want to use "pendingRestart" for other changes to WorkspaceKind that update the PodTemplate
	//       like `podMetadata`, `probes`, `extraEnv`, or `containerSecurityContext`. But for now, changes to these fields
	//       will result in a forced restart of all Workspaces using the WorkspaceKind.
	//

	// if the Workspace is paused and a restart is pending, update the Workspace with the new options
	if *workspace.Spec.Paused && workspace.Status.PendingRestart {
		workspace.Spec.PodTemplate.Options.ImageConfig = workspace.Status.PodTemplateOptions.ImageConfig
		workspace.Spec.PodTemplate.Options.PodConfig = workspace.Status.PodTemplateOptions.PodConfig
		workspace.Status.PendingRestart = false
		//
		// TODO: does `r.Update(` also update the `status`, if not, this needs to be done separately
		//
		if err := r.Update(ctx, workspace); err != nil {
			log.Error(err, "unable to update Workspace")
			//
			// TODO: do we actually need to set `Requeue: true`?
			//
			return ctrl.Result{Requeue: true}, err
		}
	}

	//
	// TODO: reconcile the Istio VirtualService to expose the Workspace
	//       and implement the `spec.podTemplate.httpProxy` options
	//

	// generate StatefulSet
	statefulSet := generateStatefulSet(workspace, workspaceKind, currentImageConfig.Spec, currentPodConfig.Spec)
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
		FieldSelector: fields.OneTermEqualSelector(kbCacheWorkspaceOwnerKey, workspace.Name),
		Namespace:     req.Namespace,
	}
	if err := r.List(ctx, ownedStatefulSets, listOpts); err != nil {
		log.Error(err, "unable to list StatefulSets")
		return ctrl.Result{}, err
	}

	// reconcile StatefulSet
	if len(ownedStatefulSets.Items) > 1 {
		var statefulSetList strings.Builder
		for _, sts := range ownedStatefulSets.Items {
			statefulSetList.WriteString(sts.Name)
			statefulSetList.WriteString(", ")
		}
		workspace.Status.State = kubefloworgv1beta1.WorkspaceStateError
		workspace.Status.StateMessage = fmt.Sprintf(stateMsgErrorMultipleStatefulSets, statefulSetList.String())
		if err := r.Status().Update(ctx, workspace); err != nil {
			log.Error(err, "unable to update Workspace status")
			return ctrl.Result{}, err
		}
		return ctrl.Result{}, nil
	} else if len(ownedStatefulSets.Items) == 0 {
		if err := r.Create(ctx, statefulSet); err != nil {
			log.Error(err, "unable to create StatefulSet")
			return ctrl.Result{}, err
		}
		statefulSetName = statefulSet.ObjectMeta.Name
		log.V(1).Info("StatefulSet created", "statefulSet", statefulSetName)
	} else {
		foundStatefulSet := &ownedStatefulSets.Items[0]
		statefulSetName = foundStatefulSet.ObjectMeta.Name
		//
		// TODO: confirm if this is the correct way to compare and update StatefulSets
		//
		if !reflect.DeepEqual(statefulSet.Spec, foundStatefulSet.Spec) {
			log.V(1).Info("Updating StatefulSet", "statefulSet", statefulSetName)
			foundStatefulSet.Spec = statefulSet.Spec
			if err := r.Update(ctx, foundStatefulSet); err != nil {
				log.Error(err, "unable to update StatefulSet")
				return ctrl.Result{}, err
			}
			log.V(1).Info("StatefulSet updated", "statefulSet", statefulSetName)
		}
	}

	// generate Service
	service := generateService(workspace, currentImageConfig.Spec)
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
		FieldSelector: fields.OneTermEqualSelector(kbCacheWorkspaceOwnerKey, workspace.Name),
		Namespace:     req.Namespace,
	}
	if err := r.List(ctx, ownedServices, listOpts); err != nil {
		log.Error(err, "unable to list Services")
		return ctrl.Result{}, err
	}

	// reconcile Service
	if len(ownedServices.Items) > 1 {
		var serviceList strings.Builder
		for _, svc := range ownedServices.Items {
			serviceList.WriteString(svc.Name)
			serviceList.WriteString(", ")
		}
		workspace.Status.State = kubefloworgv1beta1.WorkspaceStateError
		workspace.Status.StateMessage = fmt.Sprintf(stateMsgErrorMultipleServices, serviceList.String())
		if err := r.Status().Update(ctx, workspace); err != nil {
			log.Error(err, "unable to update Workspace status")
			return ctrl.Result{}, err
		}
		return ctrl.Result{}, nil
	} else if len(ownedServices.Items) == 0 {
		if err := r.Create(ctx, service); err != nil {
			log.Error(err, "unable to create Service")
			return ctrl.Result{}, err
		}
		serviceName = service.ObjectMeta.Name
		log.V(1).Info("Service created", "service", serviceName)
	} else {
		foundService := &ownedServices.Items[0]
		serviceName = foundService.ObjectMeta.Name
		//
		// TODO: confirm if this is the correct way to compare and update Services
		//
		if !reflect.DeepEqual(service.Spec, foundService.Spec) {
			log.V(1).Info("Updating Service", "service", serviceName)
			foundService.Spec = service.Spec
			if err := r.Update(ctx, foundService); err != nil {
				log.Error(err, "unable to update Service")
				return ctrl.Result{}, err
			}
			log.V(1).Info("Service updated", "service", serviceName)
		}
	}

	// fetch Pod
	// NOTE: the Pod will be named "{statefulSetName}-0"
	pod := &corev1.Pod{}
	if err := r.Get(ctx, client.ObjectKey{Name: fmt.Sprintf("%s-0", statefulSetName), Namespace: req.Namespace}, pod); err != nil {
		if apierrors.IsNotFound(err) {
			log.V(2).Info("no Pods are currently running for Workspace")
		} else {
			log.Error(err, "unable to fetch Pod")
			return ctrl.Result{}, err
		}
	}

	//
	// TODO: figure out how to set `status.pauseTime`, it will probably have to be done in a webhook
	//

	//
	// TODO: reduce the number of status update API calls by only updating the status when it changes
	//

	// update Workspace status
	workspaceStatus := generateWorkspaceStatus(workspace, pod)
	workspace.Status = workspaceStatus
	if err := r.Status().Update(ctx, workspace); err != nil {
		log.Error(err, "unable to update Workspace status")
		return ctrl.Result{}, err
	}
	log.V(1).Info("finished reconciling Workspace")
	return ctrl.Result{}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *WorkspaceReconciler) SetupWithManager(mgr ctrl.Manager) error {
	// Index StatefulSet by owner
	if err := mgr.GetFieldIndexer().IndexField(context.Background(), &appsv1.StatefulSet{}, kbCacheWorkspaceOwnerKey, func(rawObj client.Object) []string {
		statefulSet := rawObj.(*appsv1.StatefulSet)
		owner := metav1.GetControllerOf(statefulSet)
		if owner == nil {
			return nil
		}
		if owner.APIVersion != apiGroupVersionStr || owner.Kind != "Workspace" {
			return nil
		}
		return []string{owner.Name}
	}); err != nil {
		return err
	}

	// Index Service by owner
	if err := mgr.GetFieldIndexer().IndexField(context.Background(), &corev1.Service{}, kbCacheWorkspaceOwnerKey, func(rawObj client.Object) []string {
		service := rawObj.(*corev1.Service)
		owner := metav1.GetControllerOf(service)
		if owner == nil {
			return nil
		}
		if owner.APIVersion != apiGroupVersionStr || owner.Kind != "Workspace" {
			return nil
		}
		return []string{owner.Name}
	}); err != nil {
		return err
	}

	// Index Workspace by WorkspaceKind
	if err := mgr.GetFieldIndexer().IndexField(context.Background(), &kubefloworgv1beta1.Workspace{}, kbCacheWorkspaceKindField, func(rawObj client.Object) []string {
		ws := rawObj.(*kubefloworgv1beta1.Workspace)
		if ws.Spec.Kind == "" {
			return nil
		}
		return []string{ws.Spec.Kind}
	}); err != nil {
		return err
	}

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
			builder.WithPredicates(predicate.ResourceVersionChangedPredicate{}),
		).
		Watches(
			&corev1.Pod{},
			handler.EnqueueRequestsFromMapFunc(mapPodToRequest),
			builder.WithPredicates(predPodHasWSLabel),
		).
		Complete(r)
}

// mapWorkspaceKindToRequest converts WorkspaceKind events to reconcile requests for Workspaces
func (r *WorkspaceReconciler) mapWorkspaceKindToRequest(ctx context.Context, workspaceKind client.Object) []reconcile.Request {
	attachedWorkspaces := &kubefloworgv1beta1.WorkspaceList{}
	listOps := &client.ListOptions{
		FieldSelector: fields.OneTermEqualSelector(kbCacheWorkspaceKindField, workspaceKind.GetName()),
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
func getImageConfig(workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind) (*kubefloworgv1beta1.ImageConfigValue, *kubefloworgv1beta1.ImageConfigValue, error) {
	imageConfigIdMap := make(map[string]kubefloworgv1beta1.ImageConfigValue)
	for _, imageConfig := range workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values {
		imageConfigIdMap[imageConfig.Id] = imageConfig
	}

	// get currently selected imageConfig (ignoring any redirects)
	currentImageConfigKey := workspace.Spec.PodTemplate.Options.ImageConfig
	currentImageConfig, ok := imageConfigIdMap[currentImageConfigKey]
	if !ok {
		return nil, nil, fmt.Errorf("imageConfig with id '%s' not found", currentImageConfigKey)
	}

	// follow any redirects to get the desired imageConfig
	desiredImageConfig := currentImageConfig
	visitedNodes := map[string]bool{currentImageConfig.Id: true}
	for {
		if desiredImageConfig.Redirect == nil {
			break
		}
		if visitedNodes[desiredImageConfig.Redirect.To] {
			return nil, nil, fmt.Errorf("imageConfig with id '%s' has a circular redirect", desiredImageConfig.Id)
		}
		nextNode, ok := imageConfigIdMap[desiredImageConfig.Redirect.To]
		if !ok {
			return nil, nil, fmt.Errorf("imageConfig with id '%s' not found, was redirected from '%s'", desiredImageConfig.Redirect.To, desiredImageConfig.Id)
		}
		desiredImageConfig = nextNode
		visitedNodes[desiredImageConfig.Id] = true
	}

	// if the current imageConfig and desired imageConfig are different, return both
	if currentImageConfig.Id != desiredImageConfig.Id {
		return &currentImageConfig, &desiredImageConfig, nil
	} else {
		return &currentImageConfig, nil, nil
	}
}

// getPodConfig returns the current and desired (after redirects) PodConfigValues for the Workspace
func getPodConfig(workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind) (*kubefloworgv1beta1.PodConfigValue, *kubefloworgv1beta1.PodConfigValue, error) {
	podConfigIdMap := make(map[string]kubefloworgv1beta1.PodConfigValue)
	for _, podConfig := range workspaceKind.Spec.PodTemplate.Options.PodConfig.Values {
		podConfigIdMap[podConfig.Id] = podConfig
	}

	// get currently selected podConfig (ignoring any redirects)
	currentPodConfigKey := workspace.Spec.PodTemplate.Options.PodConfig
	currentPodConfig, ok := podConfigIdMap[currentPodConfigKey]
	if !ok {
		return nil, nil, fmt.Errorf("podConfig with id '%s' not found", currentPodConfigKey)
	}

	// follow any redirects to get the desired podConfig
	desiredPodConfig := currentPodConfig
	visitedNodes := map[string]bool{currentPodConfig.Id: true}
	for {
		if desiredPodConfig.Redirect == nil {
			break
		}
		if visitedNodes[desiredPodConfig.Redirect.To] {
			return nil, nil, fmt.Errorf("podConfig with id '%s' has a circular redirect", desiredPodConfig.Id)
		}
		nextNode, ok := podConfigIdMap[desiredPodConfig.Redirect.To]
		if !ok {
			return nil, nil, fmt.Errorf("podConfig with id '%s' not found, was redirected from '%s'", desiredPodConfig.Redirect.To, desiredPodConfig.Id)
		}
		desiredPodConfig = nextNode
		visitedNodes[desiredPodConfig.Id] = true
	}

	// if the current podConfig and desired podConfig are different, return both
	if currentPodConfig.Id != desiredPodConfig.Id {
		return &currentPodConfig, &desiredPodConfig, nil
	} else {
		return &currentPodConfig, nil, nil
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
func generateStatefulSet(workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind, imageConfigSpec kubefloworgv1beta1.ImageConfigSpec, podConfigSpec kubefloworgv1beta1.PodConfigSpec) *appsv1.StatefulSet {
	// generate name prefix
	namePrefix := generateNamePrefix(workspace.Name, maxStatefulSetNameLength)

	// generate replica count
	replicas := int32(1)
	if *workspace.Spec.Paused {
		replicas = int32(0)
	}

	// generate pod metadata
	podAnnotations := labels.Merge(workspaceKind.Spec.PodTemplate.PodMetadata.Annotations, workspace.Spec.PodTemplate.PodMetadata.Annotations)
	podLabels := labels.Merge(workspaceKind.Spec.PodTemplate.PodMetadata.Labels, workspace.Spec.PodTemplate.PodMetadata.Labels)

	// generate container imagePullPolicy
	imagePullPolicy := corev1.PullIfNotPresent
	if imageConfigSpec.ImagePullPolicy != nil {
		imagePullPolicy = *imageConfigSpec.ImagePullPolicy
	}

	// generate container ports
	containerPorts := make([]corev1.ContainerPort, len(imageConfigSpec.Ports))
	for i, port := range imageConfigSpec.Ports {
		containerPorts[i] = corev1.ContainerPort{
			Name:          fmt.Sprintf("http-%d", i),
			ContainerPort: port.Port,
			Protocol:      corev1.ProtocolTCP,
		}
	}

	// generate container resources
	containerResources := corev1.ResourceRequirements{}
	if podConfigSpec.Resources != nil {
		containerResources = *podConfigSpec.Resources
	}

	// generate pod volumes
	volumes := []corev1.Volume{
		{
			Name: "home-volume",
			VolumeSource: corev1.VolumeSource{
				PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
					ClaimName: workspace.Spec.PodTemplate.Volumes.Home,
				},
			},
		},
	}
	for i, data := range workspace.Spec.PodTemplate.Volumes.Data {
		volumes = append(volumes, corev1.Volume{
			Name: fmt.Sprintf("data-volume-%d", i),
			VolumeSource: corev1.VolumeSource{
				PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
					ClaimName: data.Name,
				},
			},
		})
	}

	// generate container volume mounts
	volumeMounts := []corev1.VolumeMount{
		{
			Name:      "home-volume",
			MountPath: workspaceKind.Spec.PodTemplate.VolumeMounts.Home,
		},
	}
	for i, data := range workspace.Spec.PodTemplate.Volumes.Data {
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      fmt.Sprintf("data-volume-%d", i),
			MountPath: data.MountPath,
		})
	}

	return &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: namePrefix,
			Namespace:    workspace.Namespace,
		},
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
							ReadinessProbe:  workspaceKind.Spec.PodTemplate.Probes.ReadinessProbe,
							LivenessProbe:   workspaceKind.Spec.PodTemplate.Probes.LivenessProbe,
							StartupProbe:    workspaceKind.Spec.PodTemplate.Probes.StartupProbe,
							SecurityContext: workspaceKind.Spec.PodTemplate.ContainerSecurityContext,
							VolumeMounts:    volumeMounts,
							//
							// TODO: add support for templates in env values like `{{ .PathPrefix }}`
							//
							Env:       workspaceKind.Spec.PodTemplate.ExtraEnv,
							Resources: containerResources,
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
}

// generateService generates a Service for a Workspace
func generateService(workspace *kubefloworgv1beta1.Workspace, imageConfigSpec kubefloworgv1beta1.ImageConfigSpec) *corev1.Service {
	// generate name prefix
	namePrefix := generateNamePrefix(workspace.Name, maxServiceNameLength)

	// generate service ports
	servicePorts := make([]corev1.ServicePort, len(imageConfigSpec.Ports))
	for i, port := range imageConfigSpec.Ports {
		servicePorts[i] = corev1.ServicePort{
			Name:       fmt.Sprintf("http-%d", i),
			TargetPort: intstr.FromInt32(port.Port),
			Port:       port.Port,
			Protocol:   corev1.ProtocolTCP,
		}
	}

	return &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: namePrefix,
			Namespace:    workspace.Namespace,
		},
		Spec: corev1.ServiceSpec{
			Ports: servicePorts,
			Selector: map[string]string{
				workspaceNameLabel:     workspace.Name,
				workspaceSelectorLabel: workspace.Name,
			},
			Type: corev1.ServiceTypeClusterIP,
		},
	}
}

// generateWorkspaceStatus generates a WorkspaceStatus for a Workspace
func generateWorkspaceStatus(workspace *kubefloworgv1beta1.Workspace, pod *corev1.Pod) kubefloworgv1beta1.WorkspaceStatus {
	status := workspace.Status

	//
	// TODO: review this logic, and ensure that the checks are ordered correctly so that the correct status is set
	//

	// STATUS: Terminating
	if pod.GetDeletionTimestamp() != nil {
		status.State = kubefloworgv1beta1.WorkspaceStateTerminating
		status.StateMessage = stateMsgTerminating
		return status
	}

	// STATUS: Paused
	if *workspace.Spec.Paused && pod == nil {
		status.State = kubefloworgv1beta1.WorkspaceStatePaused
		status.StateMessage = stateMsgPaused
		return status
	}

	// update the Workspace status based on the Pod
	if pod != nil {
		// get the pod phase
		// https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-phase
		podPhase := pod.Status.Phase

		// get the pod conditions
		// https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-conditions
		podReady := false
		for _, condition := range pod.Status.Conditions {
			switch condition.Type {
			case corev1.PodReady:
				podReady = condition.Status == corev1.ConditionTrue
			}
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

		// STATUS: Running
		if podPhase == corev1.PodRunning && podReady {
			status.State = kubefloworgv1beta1.WorkspaceStateRunning
			status.StateMessage = stateMsgRunning
			return status
		}

		// STATUS: Error
		if containerState.Waiting != nil {
			if containerState.Waiting.Reason == "CrashLoopBackOff" {
				status.State = kubefloworgv1beta1.WorkspaceStateError
				status.StateMessage = stateMsgErrorPodCrashLoopBackOff
				return status
			}
			if containerState.Waiting.Reason == "ImagePullBackOff" {
				status.State = kubefloworgv1beta1.WorkspaceStateError
				status.StateMessage = stateMsgErrorPodImagePullBackOff
				return status
			}
		}

		// STATUS: Pending
		if podPhase == corev1.PodPending {
			status.State = kubefloworgv1beta1.WorkspaceStatePending
			status.StateMessage = stateMsgPending
			return status
		}
	}

	// STATUS: Unknown
	status.State = kubefloworgv1beta1.WorkspaceStateUnknown
	status.StateMessage = stateMsgUnknown
	return status
}
