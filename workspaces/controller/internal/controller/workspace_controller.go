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
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"time"
)

const (
	DefaultContainerPort = 8888
	RetryInterval        = 200 * time.Millisecond
	RetryAttempts        = 3
)

var (
	workspaceOwnerKey = ".metadata.controller"
	apiGVStr          = kubefloworgv1beta1.GroupVersion.String()
)

// WorkspaceReconciler reconciles a Workspace object
type WorkspaceReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

//+kubebuilder:rbac:groups=kubeflow.org,resources=workspaces,verbs=get;list;watch;create;update;patch;delete
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
	workspaceKindName := workspace.Spec.Kind
	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	if err := r.Get(ctx, client.ObjectKey{Name: workspaceKindName}, workspaceKind); err != nil {
		logger.Error(err, "unable to fetch Workspace Kind")
		if client.IgnoreNotFound(err) == nil {
			return ctrl.Result{}, nil
		}
		return ctrl.Result{}, err
	}
	if err := ctrl.SetControllerReference(workspaceKind, workspace, r.Scheme); err != nil {
		logger.Error(err, "unable to set controller reference to workspace")
		return ctrl.Result{}, err
	}

	ss := generateStatefulSet(workspace, workspaceKind)
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
		workspace.Status.StateMessage = "Found multiple StatefulSets"
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
		logger.Info("Creating StatefulSet")
		if err := r.Client.Create(ctx, ss); err != nil {
			if errors.IsAlreadyExists(err) {
				logger.Error(err, "statefulset already exists with this name , retrying")
				err := helper.Retry(RetryAttempts, RetryInterval, func() error {
					err := r.Client.Create(ctx, ss)
					if err != nil {
						if errors.IsAlreadyExists(err) {
							logger.Error(err, "statefulset already exists with this name , retrying ...")
							return err
						}
						return &helper.StopRetry{Err: err}
					}
					return nil
				})
				if err != nil {
					logger.Error(err, "unable to create StatefulSet after retrying")
					return ctrl.Result{}, err
				}
			}
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

	svc := generateService(workspace)
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
		workspace.Status.StateMessage = "Found multiple services"

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
		logger.Info("Creating Service")
		err := r.Client.Create(ctx, svc)
		if err != nil {
			if errors.IsAlreadyExists(err) {
				logger.Error(err, "service already exists with this name , retrying ...")
				err := helper.Retry(RetryAttempts, RetryInterval, func() error {
					err := r.Client.Create(ctx, svc)
					if err != nil {
						if errors.IsAlreadyExists(err) {
							logger.Error(err, "service already exists with this name , retrying ...")
							return err
						}
						return &helper.StopRetry{Err: err}
					}
					return nil
				})
				if err != nil {
					logger.Error(err, "unable to create service after retrying")
					return ctrl.Result{}, err
				}
			}
			logger.Error(err, "unable to create service")
			return ctrl.Result{}, err
		}
		justCreated = true
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
	pod := &corev1.Pod{}
	if err := r.Get(ctx, client.ObjectKey{Name: foundStatefulSet.Name + "-0", Namespace: foundStatefulSet.Namespace}, pod); err != nil {
		if client.IgnoreNotFound(err) == nil {
			logger.Info(fmt.Sprintf("No Pods are currently running for Workspace Server: %s .", workspace.Name))
		}
		logger.Error(err, "unable to fetch Pod")
		return ctrl.Result{}, err
	}

	// Update Workspace CR status
	if err := updateWorkspaceStatus(ctx, r, workspace, pod, logger); err != nil {
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
		if owner.APIVersion != apiGVStr || owner.Kind != "Workspace" {
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
		if owner.APIVersion != apiGVStr || owner.Kind != "Workspace" {
			return nil
		}
		return []string{owner.Name}
	}); err != nil {
		return err
	}
	return ctrl.NewControllerManagedBy(mgr).
		For(&kubefloworgv1beta1.Workspace{}).Owns(&appsv1.StatefulSet{}).Owns(&corev1.Service{}).
		Complete(r)
}

func updateWorkspaceStatus(ctx context.Context, r *WorkspaceReconciler, ws *kubefloworgv1beta1.Workspace, pod *corev1.Pod, log logr.Logger) error {
	status := createWorkspaceStatus(ws, pod, log)
	log.Info("Updating Workspace CR Status", "status", status)
	ws.Status = status
	return r.Status().Update(ctx, ws)
}

func createWorkspaceStatus(ws *kubefloworgv1beta1.Workspace, pod *corev1.Pod, log logr.Logger) kubefloworgv1beta1.WorkspaceStatus {
	log.Info("Initializing Workspace CR Status")

	status := kubefloworgv1beta1.WorkspaceStatus{}
	switch pod.Status.Phase {
	case corev1.PodRunning:
		status.State = kubefloworgv1beta1.WorkspaceStateRunning
		status.StateMessage = fmt.Sprintf("workspace %s is running", ws.Name)
	case corev1.PodPending:
		status.State = kubefloworgv1beta1.WorkspaceStatePending
		status.StateMessage = fmt.Sprintf("workspace %s is pending", ws.Name)
	default:
		status.State = kubefloworgv1beta1.WorkspaceStateUnknown
		status.StateMessage = fmt.Sprintf("workspace %s has failed", ws.Name)
	}

	return status
}

func getDefaultImage(imageConfig kubefloworgv1beta1.ImageConfig) string {
	for _, image := range imageConfig.Values {
		if imageConfig.Default == image.Id {
			return image.Spec.Image
		}
	}
	return "kubeflownotebookswg/jupyter-scipy:v1.8.0"
}

func generateStatefulSet(workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind) *appsv1.StatefulSet {
	replicas := int32(1)
	return &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: fmt.Sprintf("ws-%s-", workspace.Name),
			Namespace:    workspace.Namespace,
			Labels:       workspaceKind.Spec.PodTemplate.PodMetadata.Labels,
			Annotations:  workspaceKind.Spec.PodTemplate.PodMetadata.Annotations,
		},
		Spec: appsv1.StatefulSetSpec{
			Replicas: &replicas,
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{
					"statefulset": workspace.Name,
				},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						"statefulset":   workspace.Name,
						"notebook-name": workspace.Name,
					},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Name:  "notebook",
							Image: getDefaultImage(workspaceKind.Spec.PodTemplate.Options.ImageConfig),
							Ports: []corev1.ContainerPort{
								{
									Name:          fmt.Sprintf("http-%s", workspace.Name),
									Protocol:      "TCP",
									ContainerPort: DefaultContainerPort,
								},
							},
						},
					},
				},
			},
		},
	}
}

func generateService(workspace *kubefloworgv1beta1.Workspace) *corev1.Service {
	return &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: fmt.Sprintf("ws-%s-", workspace.Name),
			Namespace:    workspace.Namespace,
		},
		Spec: corev1.ServiceSpec{
			Selector: map[string]string{"statefulset": workspace.Name},
			Ports: []corev1.ServicePort{
				{
					Name:       fmt.Sprintf("http-%s", workspace.Name),
					Port:       DefaultContainerPort,
					TargetPort: intstr.FromInt32(DefaultContainerPort),
					Protocol:   "TCP",
				},
			},
		},
	}
}
