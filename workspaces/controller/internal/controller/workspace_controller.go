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
	"github.com/go-logr/logr"
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/helper"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
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
	"sigs.k8s.io/controller-runtime/pkg/predicate"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
	"time"
)

const (
	DefaultWorkspaceImage         = "kubeflownotebookswg/jupyter-scipy:v1.8.0"
	DefaultContainerPort          = 8888
	RetryInterval                 = 200 * time.Millisecond
	RetryAttempts                 = 5
	workspaceSelectorLabel        = "statefulset"
	workspaceNameLabel            = "workspace-name"
	workspaceOwnerKey             = ".metadata.controller"
	workspaceKindField            = ".spec.kind"
	multipleStatefulSetsMsgFormat = "Multiple StatefulSets found for Workspace %s."
	multipleServiceMsgFormat      = "Multiple Services found for Workspace %s."
	pausedWSMsgFormat             = "Workspace %s is currently paused."
	terminatingWSMsgFormat        = "Workspace %s is in the process of terminating."
	runningWSMsgFormat            = "Workspace %s is currently running."
	containerCreatingWSMsgFormat  = "Workspace %s is in the process of creating containers."
	crashLoopingWSMsgFormat       = "Workspace %s pod container is experiencing a crash loop."
	pullBackOffWSMsgFormat        = "Workspace %s pod container is unable to pull the image (ImagePullBackOff)."
	pendingWSMsgFormat            = "Workspace %s pod is in a pending state."
	unknownWSMsgFormat            = "Workspace %s pod is in an unknown state."
)

var (
	apiGroupVersionStr = kubefloworgv1beta1.GroupVersion.String()
)

// WorkspaceReconciler reconciles a Workspace object
type WorkspaceReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

//+kubebuilder:rbac:groups=kubeflow.org,resources=workspaces,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=kubeflow.org,resources=workspacekinds,verbs=list;watch
//+kubebuilder:rbac:groups=kubeflow.org,resources=workspaces/status,verbs=get;update;patch
//+kubebuilder:rbac:groups=kubeflow.org,resources=workspaces/finalizers,verbs=update
// +kubebuilder:rbac:groups=apps,resources=statefulsets,verbs=get;update;patch;create;delete
// +kubebuilder:rbac:groups=core,resources=services,verbs=get;update;patch;create;delete
// +kubebuilder:rbac:groups="networking.istio.io",resources=virtualservices,verbs=get;update;patch;create;delete

func (r *WorkspaceReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	logger := ctrl.Log.WithValues("workspace", req.NamespacedName)
	logger.Info("Reconciling Workspace")
	workspace := &kubefloworgv1beta1.Workspace{}
	if err := r.Get(ctx, req.NamespacedName, workspace); err != nil {
		logger.Error(err, "unable to fetch Workspace")
		if client.IgnoreNotFound(err) == nil {
			// Request object not found, could have been deleted after reconcile request.
			// Owned objects are automatically garbage collected. For additional cleanup logic use finalizers.
			// Return and don't requeue
			return ctrl.Result{}, nil
		}
		return ctrl.Result{}, err
	}
	if !workspace.GetDeletionTimestamp().IsZero() {
		logger.Info("Deleting Workspace")
		return ctrl.Result{}, nil
	}
	// Fetch the WorkspaceKind
	workspaceKindName := workspace.Spec.Kind
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := r.Get(ctx, client.ObjectKey{Name: workspaceKindName}, workspaceKind); err != nil {
		logger.Error(err, "unable to fetch Workspace Kind")
		if client.IgnoreNotFound(err) == nil {
			return ctrl.Result{}, nil
		}
		return ctrl.Result{}, err
	}
	// check if workspace is set owned by workspaceKind if not set it
	workspaceOwnerRef := metav1.GetControllerOf(workspace)
	if workspaceOwnerRef == nil || workspaceOwnerRef.Kind != "WorkspaceKind" || workspaceOwnerRef.Name != workspaceKindName {
		logger.Info("Setting Workspace owner to WorkspaceKind")
		if err := ctrl.SetControllerReference(workspaceKind, workspace, r.Scheme); err != nil {
			logger.Error(err, "unable to set controller reference to workspace")
			return ctrl.Result{}, err
		}
		if err := r.Client.Update(ctx, workspace); err != nil {
			logger.Error(err, "unable to update workspace owner")
			return ctrl.Result{}, err
		}
		logger.Info("Workspace owner updated")
	}

	// reconcile StatefulSet
	imageConfigMap := generateMapFromImageConfig(workspaceKind.Spec.PodTemplate.Options.ImageConfig)
	containerPorts, servicePorts := getPorts(workspace.Spec.PodTemplate.Options.ImageConfig, workspaceKind.Spec.PodTemplate.Options.ImageConfig.Default, imageConfigMap)

	ss := generateStatefulSet(workspace, workspaceKind, containerPorts, imageConfigMap)

	if err := ctrl.SetControllerReference(workspace, ss, r.Scheme); err != nil {
		logger.Error(err, "unable to set controller reference to StatefulSet")
		return ctrl.Result{}, err
	}

	var statefulSets appsv1.StatefulSetList
	if err := r.List(ctx, &statefulSets, client.InNamespace(req.Namespace), client.MatchingFields{workspaceOwnerKey: req.Name}); err != nil {
		logger.Error(err, "unable to list child StatefulSets")
		return ctrl.Result{}, err
	}

	foundStatefulSet := &appsv1.StatefulSet{}
	justCreated := false
	if len(statefulSets.Items) > 1 {
		logger.Info("Found multiple StatefulSets")
		workspace.Status.State = kubefloworgv1beta1.WorkspaceStateError
		workspace.Status.StateMessage = fmt.Sprintf(multipleStatefulSetsMsgFormat, workspace.Name)
		if err := r.Status().Update(ctx, workspace); err != nil {
			logger.Error(err, "unable to update Workspace status")
			return ctrl.Result{}, err
		}
		logger.Info("Workspace status updated", "state", workspace.Status.State)
		return ctrl.Result{}, nil
	}
	if len(statefulSets.Items) == 1 {
		foundStatefulSet = &statefulSets.Items[0]
	} else {
		if err := r.createResourceWithRetry(ctx, logger, ss); err != nil {
			logger.Error(err, "unable to create StatefulSet")
			return ctrl.Result{}, err
		}
		justCreated = true
		logger.Info("StatefulSet created")
	}

	if !justCreated && helper.CopyStatefulSetFields(ss, foundStatefulSet) {
		logger.Info("Updating StatefulSet")
		err := r.Client.Update(ctx, foundStatefulSet)
		if err != nil {
			logger.Error(err, "unable to update StatefulSet")
			return ctrl.Result{}, err
		}
		logger.Info("StatefulSet updated")
	}

	// reconcile Service

	svc := generateService(workspace, servicePorts)
	if err := ctrl.SetControllerReference(workspace, svc, r.Scheme); err != nil {
		logger.Error(err, "unable to set controller reference to service")
		return ctrl.Result{}, err
	}

	var services corev1.ServiceList
	if err := r.List(ctx, &services, client.InNamespace(req.Namespace), client.MatchingFields{workspaceOwnerKey: req.Name}); err != nil {
		logger.Error(err, "unable to list child Services")
		return ctrl.Result{}, err
	}
	justCreated = false
	foundService := &corev1.Service{}
	if len(services.Items) > 1 {
		logger.Info("Found multiple Services")
		workspace.Status.State = kubefloworgv1beta1.WorkspaceStateError
		workspace.Status.StateMessage = fmt.Sprintf(multipleServiceMsgFormat, workspace.Name)

		if err := r.Status().Update(ctx, workspace); err != nil {
			logger.Error(err, "unable to update Workspace status")
			return ctrl.Result{}, err
		}
		logger.Info("Workspace status updated", "state", workspace.Status.State)
		return ctrl.Result{}, nil
	}
	if len(services.Items) == 1 {
		foundService = &services.Items[0]
	} else {
		justCreated = true
		if err := r.createResourceWithRetry(ctx, logger, svc); err != nil {
			logger.Error(err, "unable to create Service")
			return ctrl.Result{}, err
		}
		logger.Info("Service created")
	}
	if !justCreated && helper.CopyServiceFields(svc, foundService) {
		logger.Info("Updating Service")
		err := r.Client.Update(ctx, foundService)
		if err != nil {
			logger.Error(err, "unable to update Service")
			return ctrl.Result{}, err
		}
		logger.Info("Service updated")
	}

	// Update Workspace CR status

	pod := &corev1.Pod{}
	if err := r.Get(ctx, client.ObjectKey{Name: foundStatefulSet.Name + "-0", Namespace: foundStatefulSet.Namespace}, pod); err != nil {
		if client.IgnoreNotFound(err) != nil {
			logger.Error(err, "unable to fetch Pod")
			return ctrl.Result{}, err
		}
		logger.Info(fmt.Sprintf("no Pods are currently running for Workspace: %s .", workspace.Name))

	}
	if err := r.updateWorkspaceStatus(ctx, workspace, pod, logger); err != nil {
		logger.Error(err, "unable to update Workspace status")
		return ctrl.Result{}, err
	}
	logger.Info("Finish Reconciling Workspace")
	return ctrl.Result{}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *WorkspaceReconciler) SetupWithManager(mgr ctrl.Manager) error {
	// Index StatefulSet by owner
	if err := mgr.GetFieldIndexer().IndexField(context.Background(), &appsv1.StatefulSet{}, workspaceOwnerKey, func(rawObj client.Object) []string {
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
	if err := mgr.GetFieldIndexer().IndexField(context.Background(), &corev1.Service{}, workspaceOwnerKey, func(rawObj client.Object) []string {
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
	if err := mgr.GetFieldIndexer().IndexField(context.Background(), &kubefloworgv1beta1.Workspace{}, workspaceKindField, func(rawObj client.Object) []string {
		ws := rawObj.(*kubefloworgv1beta1.Workspace)
		if ws.Spec.Kind == "" {
			return nil
		}
		return []string{ws.Spec.Kind}
	}); err != nil {
		return err
	}
	// Map function to convert pod events to reconciliation requests
	mapPodToRequest := func(ctx context.Context, object client.Object) []reconcile.Request {
		return []reconcile.Request{
			{NamespacedName: types.NamespacedName{
				Name:      object.GetLabels()[workspaceNameLabel],
				Namespace: object.GetNamespace(),
			}},
		}
	}
	return ctrl.NewControllerManagedBy(mgr).
		For(&kubefloworgv1beta1.Workspace{}).Owns(&appsv1.StatefulSet{}).Owns(&corev1.Service{}).
		Watches(
			&kubefloworgv1beta1.WorkspaceKind{},
			handler.EnqueueRequestsFromMapFunc(r.findObjectsForWorkspaceKind),
			builder.WithPredicates(predicate.ResourceVersionChangedPredicate{}),
		).Watches(
		&corev1.Pod{},
		handler.EnqueueRequestsFromMapFunc(mapPodToRequest),
		builder.WithPredicates(predWSPodIsLabeled())).
		Complete(r)
}

// predWSPodIsLabeled filters pods not containing the "workspace-name" label key
func predWSPodIsLabeled() predicate.Funcs {
	checkWSLabel := func() func(object client.Object) bool {
		return func(object client.Object) bool {
			_, labelExists := object.GetLabels()[workspaceNameLabel]
			return labelExists
		}
	}

	return predicate.NewPredicateFuncs(checkWSLabel())
}

func (r *WorkspaceReconciler) findObjectsForWorkspaceKind(ctx context.Context, workspaceKind client.Object) []reconcile.Request {
	attachedWorkspaces := &kubefloworgv1beta1.WorkspaceList{}
	listOps := &client.ListOptions{
		FieldSelector: fields.OneTermEqualSelector(workspaceKindField, workspaceKind.GetName()),
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

func (r *WorkspaceReconciler) createResourceWithRetry(ctx context.Context, logger logr.Logger, resource client.Object) error {
	resourceKind := resource.GetObjectKind().GroupVersionKind().Kind
	logger.Info("Creating resource", "resource", resourceKind, "name", resource.GetName())
	err := helper.Retry(RetryAttempts, RetryInterval, func() error {
		err := r.Create(ctx, resource)
		if err != nil {
			if errors.IsAlreadyExists(err) {
				logger.Error(err, "resource already exists, retrying...", "resource", resourceKind)
				return err
			}
			return &helper.StopRetry{Err: err}
		}
		return nil
	})

	if err != nil {
		logger.Error(err, "unable to create resource after retrying", "resource", resourceKind)
		return err
	}
	logger.Info("Resource created successfully", "resource", resourceKind, "name", resource.GetName())
	return nil
}

func (r *WorkspaceReconciler) updateWorkspaceStatus(ctx context.Context, ws *kubefloworgv1beta1.Workspace, pod *corev1.Pod, log logr.Logger) error {
	status := createWorkspaceStatus(ws, pod, log)
	log.Info("Updating Workspace CR Status", "status", status)
	ws.Status = status
	return r.Status().Update(ctx, ws)
}

func createWorkspaceStatus(ws *kubefloworgv1beta1.Workspace, pod *corev1.Pod, log logr.Logger) kubefloworgv1beta1.WorkspaceStatus {
	log.Info("Initializing Workspace CR Status")

	status := kubefloworgv1beta1.WorkspaceStatus{}
	if ws.Spec.Paused != nil && *ws.Spec.Paused == true {
		if pod.GetName() == "" {
			status.State = kubefloworgv1beta1.WorkspaceStatePaused
			status.StateMessage = fmt.Sprintf(pausedWSMsgFormat, ws.Name)
			return status

		}
		if pod.GetDeletionTimestamp() != nil {
			status.State = kubefloworgv1beta1.WorkspaceStateTerminating
			status.StateMessage = fmt.Sprintf(terminatingWSMsgFormat, ws.Name)
			return status
		}

	} else {
		// for now, I assumed that there is only one container
		if pod.Status.Phase == corev1.PodRunning && pod.Status.ContainerStatuses[0].Ready {
			status.State = kubefloworgv1beta1.WorkspaceStateRunning
			status.StateMessage = fmt.Sprintf(runningWSMsgFormat, ws.Name)
			return status
		}

		for _, containerStatus := range pod.Status.ContainerStatuses {
			// Check if the container is not ready

			if !containerStatus.Ready {

				// Check if the container is in a ContainerCreating state
				if containerStatus.State.Waiting != nil && containerStatus.State.Waiting.Reason == "ContainerCreating" {
					status.State = kubefloworgv1beta1.WorkspaceStatePending
					status.StateMessage = fmt.Sprintf(containerCreatingWSMsgFormat, ws.Name)
					return status
				}

				// Check if the container is in a crash loop
				if containerStatus.State.Waiting != nil && containerStatus.State.Waiting.Reason == "CrashLoopBackOff" {
					status.State = kubefloworgv1beta1.WorkspaceStateError
					status.StateMessage = fmt.Sprintf(crashLoopingWSMsgFormat, ws.Name)
					return status
				}

				// Check if the container is unable to pull the image
				if containerStatus.State.Waiting != nil && containerStatus.State.Waiting.Reason == "ImagePullBackOff" {
					status.State = kubefloworgv1beta1.WorkspaceStateError
					status.StateMessage = fmt.Sprintf(pullBackOffWSMsgFormat, ws.Name)
					return status
				}
			}

		}
		if pod.Status.Phase == corev1.PodPending {
			status.State = kubefloworgv1beta1.WorkspaceStatePending
			status.StateMessage = fmt.Sprintf(pendingWSMsgFormat, ws.Name)
			return status
		}

	}
	status.State = kubefloworgv1beta1.WorkspaceStateUnknown
	status.StateMessage = fmt.Sprintf(unknownWSMsgFormat, ws.Name)
	return status

}

func generateStatefulSet(workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind, ports []corev1.ContainerPort, imageConfigMap map[string]kubefloworgv1beta1.ImageConfigValue) *appsv1.StatefulSet {
	replicas := int32(1)
	podConfigMap := generateMapFromPodConfig(workspaceKind.Spec.PodTemplate.Options.PodConfig)
	podConfigSpec := getPodConfigSpec(workspace.Spec.PodTemplate.Options.PodConfig, workspaceKind.Spec.PodTemplate.Options.PodConfig.Default, podConfigMap)
	volumes := []corev1.Volume{
		{
			Name: workspace.Spec.PodTemplate.Volumes.Home,
			VolumeSource: corev1.VolumeSource{
				PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
					ClaimName: workspace.Spec.PodTemplate.Volumes.Home,
				},
			},
		},
	}
	for _, data := range workspace.Spec.PodTemplate.Volumes.Data {
		volumes = append(volumes, corev1.Volume{
			Name: data.Name,
			VolumeSource: corev1.VolumeSource{
				PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
					ClaimName: data.Name,
				},
			},
		})
	}
	return &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: fmt.Sprintf("ws-%s-", workspace.Name),
			Namespace:    workspace.Namespace,
			Labels:       labels.Merge(workspaceKind.Spec.PodTemplate.PodMetadata.Labels, workspace.Spec.PodTemplate.PodMetadata.Labels),
			Annotations:  labels.Merge(workspaceKind.Spec.PodTemplate.PodMetadata.Annotations, workspace.Spec.PodTemplate.PodMetadata.Annotations),
		},
		Spec: appsv1.StatefulSetSpec{
			Replicas: &replicas,
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{
					workspaceSelectorLabel: workspace.Name,
				},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						workspaceSelectorLabel: workspace.Name,
						workspaceNameLabel:     workspace.Name,
					},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						generateContainerSpec(workspace, workspaceKind, ports, imageConfigMap, podConfigSpec.Resources),
					},
					NodeSelector:       podConfigSpec.NodeSelector,
					Tolerations:        podConfigSpec.Tolerations,
					Affinity:           podConfigSpec.Affinity,
					ServiceAccountName: workspaceKind.Spec.PodTemplate.ServiceAccount.Name,
					Volumes:            volumes,
				},
			},
		},
	}
}

func generateService(workspace *kubefloworgv1beta1.Workspace, ports []corev1.ServicePort) *corev1.Service {

	return &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: fmt.Sprintf("ws-%s-", workspace.Name),
			Namespace:    workspace.Namespace,
		},
		Spec: corev1.ServiceSpec{
			Selector: map[string]string{workspaceSelectorLabel: workspace.Name},
			Ports:    ports,
		},
	}
}

func getPorts(imageConfig, defaultImageConfig string, imageConfigMap map[string]kubefloworgv1beta1.ImageConfigValue) ([]corev1.ContainerPort, []corev1.ServicePort) {
	if imageConfig == "" {
		imageConfig = defaultImageConfig
	}

	var containerPorts []corev1.ContainerPort
	var servicePorts []corev1.ServicePort

	config, ok := imageConfigMap[imageConfig]
	if !ok {
		return []corev1.ContainerPort{
				{
					Name:          "http-0",
					ContainerPort: DefaultContainerPort,
					Protocol:      corev1.ProtocolTCP,
				},
			}, []corev1.ServicePort{
				{
					Name:       "http-0",
					TargetPort: intstr.FromInt32(DefaultContainerPort),
					Port:       DefaultContainerPort,
					Protocol:   corev1.ProtocolTCP,
				},
			}
	}

	for i, port := range config.Spec.Ports {
		containerPorts = append(containerPorts, corev1.ContainerPort{
			Name:          fmt.Sprintf("http-%d", i),
			ContainerPort: port.Port,
			Protocol:      corev1.ProtocolTCP,
		})
		servicePorts = append(servicePorts, corev1.ServicePort{
			Name:       fmt.Sprintf("http-%d", i),
			TargetPort: intstr.FromInt32(port.Port),
			Port:       port.Port,
			Protocol:   corev1.ProtocolTCP,
		})
	}

	return containerPorts, servicePorts
}

func getImageConfigSpec(imageConfig, defaultImageConfig string, imageConfigMap map[string]kubefloworgv1beta1.ImageConfigValue) kubefloworgv1beta1.ImageConfigSpec {
	if imageConfig == "" {
		imageConfig = defaultImageConfig
	}

	config := imageConfigMap[imageConfig]
	return config.Spec
}

func getPodConfigSpec(podConfig, defaultPodConfig string, podConfigMap map[string]kubefloworgv1beta1.PodConfigValue) kubefloworgv1beta1.PodConfigSpec {
	if podConfig == "" {
		podConfig = defaultPodConfig
	}

	config := podConfigMap[podConfig]
	return config.Spec
}

func generateMapFromImageConfig(imageConfig kubefloworgv1beta1.ImageConfig) map[string]kubefloworgv1beta1.ImageConfigValue {
	imageMap := make(map[string]kubefloworgv1beta1.ImageConfigValue)
	for _, image := range imageConfig.Values {
		imageMap[image.Id] = image
	}
	return imageMap
}

func generateMapFromPodConfig(podConfig kubefloworgv1beta1.PodConfig) map[string]kubefloworgv1beta1.PodConfigValue {
	podMap := make(map[string]kubefloworgv1beta1.PodConfigValue)
	for _, pod := range podConfig.Values {
		podMap[pod.Id] = pod
	}
	return podMap
}

func generateContainerSpec(workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind, ports []corev1.ContainerPort, imageConfigMap map[string]kubefloworgv1beta1.ImageConfigValue, containerResources *corev1.ResourceRequirements) corev1.Container {
	imageConfigSpec := getImageConfigSpec(workspace.Spec.PodTemplate.Options.ImageConfig, workspaceKind.Spec.PodTemplate.Options.ImageConfig.Default, imageConfigMap)
	image := imageConfigSpec.Image
	if image == "" {
		image = DefaultWorkspaceImage
	}
	imagePullPolicy := corev1.PullIfNotPresent
	if imageConfigSpec.ImagePullPolicy != nil {
		imagePullPolicy = *imageConfigSpec.ImagePullPolicy
	}
	volumeMounts := make([]corev1.VolumeMount, 0)

	volumeMounts = append(volumeMounts, corev1.VolumeMount{
		Name:      workspace.Spec.PodTemplate.Volumes.Home,
		MountPath: workspaceKind.Spec.PodTemplate.VolumeMounts.Home,
	})

	for _, data := range workspace.Spec.PodTemplate.Volumes.Data {
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      data.Name,
			MountPath: data.MountPath,
		})
	}
	var livenessProbe *corev1.Probe
	var readinessProbe *corev1.Probe
	var startupProbe *corev1.Probe
	if workspaceKind.Spec.PodTemplate.Probes != nil {
		if workspaceKind.Spec.PodTemplate.Probes.LivenessProbe != nil {
			livenessProbe = workspaceKind.Spec.PodTemplate.Probes.LivenessProbe.DeepCopy()
		}
		if workspaceKind.Spec.PodTemplate.Probes.ReadinessProbe != nil {
			readinessProbe = workspaceKind.Spec.PodTemplate.Probes.ReadinessProbe.DeepCopy()
		}
		if workspaceKind.Spec.PodTemplate.Probes.StartupProbe != nil {
			startupProbe = workspaceKind.Spec.PodTemplate.Probes.StartupProbe.DeepCopy()
		}
	}
	return corev1.Container{
		Name:            "main",
		Image:           image,
		ImagePullPolicy: imagePullPolicy,
		Ports:           ports,
		ReadinessProbe:  readinessProbe,
		LivenessProbe:   livenessProbe,
		StartupProbe:    startupProbe,
		SecurityContext: workspaceKind.Spec.PodTemplate.ContainerSecurityContext,
		VolumeMounts:    volumeMounts,
		Env:             workspaceKind.Spec.PodTemplate.ExtraEnv,
		Resources:       *containerResources,
	}
}
