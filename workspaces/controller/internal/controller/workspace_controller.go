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
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

const DefaultContainerPort = 8888

// WorkspaceReconciler reconciles a Workspace object
type WorkspaceReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

//+kubebuilder:rbac:groups=kubeflow.org,resources=workspaces,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=kubeflow.org,resources=workspaces/status,verbs=get;update;patch
//+kubebuilder:rbac:groups=kubeflow.org,resources=workspaces/finalizers,verbs=update

// Reconcile is part of the main kubernetes reconciliation loop which aims to
// move the current state of the cluster closer to the desired state.
// TODO(user): Modify the Reconcile function to compare the state specified by
// the Workspace object against the actual cluster state, and then
// perform operations to make the cluster state reflect the state specified by
// the user.
//
// For more details, check Reconcile and its Result here:
// - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.17.3/pkg/reconcile
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
			// Request object not found, could have been deleted after reconcile request.
			// Owned objects are automatically garbage collected. For additional cleanup logic use finalizers.
			// Return and don't requeue
			return ctrl.Result{}, nil
		}
		return ctrl.Result{}, err
	}
	ss := generateStatefulSet(workspace, workspaceKind)
	if err := ctrl.SetControllerReference(workspace, ss, r.Scheme); err != nil {
		logger.Error(err, "unable to set controller reference to StatefulSet")
		return ctrl.Result{}, err
	}
	foundStatefulSet := &appsv1.StatefulSet{}
	err := r.Get(ctx, client.ObjectKey{Name: workspace.Name, Namespace: workspace.Namespace}, foundStatefulSet)
	if err != nil {
		if client.IgnoreNotFound(err) == nil {
			logger.Info("Creating StatefulSet")
			err := r.Client.Create(ctx, ss)
			if err != nil {
				logger.Error(err, "unable to create StatefulSet")
				return ctrl.Result{}, err
			}
		} else {
			logger.Error(err, "unable to fetch StatefulSet")
			return ctrl.Result{}, err
		}
	}
	//TODO: sync foundStatefulSet with ss
	svc := generateService(workspace)
	if err := ctrl.SetControllerReference(workspace, svc, r.Scheme); err != nil {
		logger.Error(err, "unable to set controller reference to Service")
		return ctrl.Result{}, err
	}
	foundService := &corev1.Service{}
	err = r.Get(ctx, client.ObjectKey{Name: workspace.Name, Namespace: workspace.Namespace}, foundService)
	if err != nil {
		if client.IgnoreNotFound(err) == nil {
			logger.Info("Creating Service")
			err := r.Client.Create(ctx, svc)
			if err != nil {
				logger.Error(err, "unable to create service")
				return ctrl.Result{}, err
			}
		} else {
			logger.Error(err, "unable to fetch Service")
			return ctrl.Result{}, err
		}
	}
	//TODO: sync foundService with svc
	logger.Info("Finish Reconciling Workspace")
	return ctrl.Result{}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *WorkspaceReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&kubefloworgv1beta1.Workspace{}).
		Complete(r)
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
			Name:        workspace.Name,
			Namespace:   workspace.Namespace,
			Labels:      workspaceKind.Spec.PodTemplate.PodMetadata.Labels,
			Annotations: workspaceKind.Spec.PodTemplate.PodMetadata.Annotations,
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
			Name:      workspace.Name,
			Namespace: workspace.Namespace,
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
