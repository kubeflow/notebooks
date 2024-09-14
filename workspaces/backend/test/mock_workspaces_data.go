package test

import (
	"time"

	"github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1" // Replace with the actual import path

	"github.com/kubeflow/notebooks/workspaces/backend/internal/data"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func GetMockWorkspaces() []kubefloworgv1beta1.Workspace {
	lastActivityTime := int64(0)

	workspace1 := kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "jupyterlab-workspace",
			Namespace: "workspace-test",
		},
		Spec: v1beta1.WorkspaceSpec{
			Kind: "jupyterlab",
			PodTemplate: kubefloworgv1beta1.WorkspacePodTemplate{
				Options: kubefloworgv1beta1.WorkspacePodOptions{
					ImageConfig: "jupyterlab_scipy_190",
					PodConfig:   "tiny_cpu",
				},
				Volumes: v1beta1.WorkspacePodVolumes{
					Home: stringPointer("workspace-home-pvc"),
					Data: []kubefloworgv1beta1.PodVolumeMount{
						{
							PVCName:   "my-data-pvc",
							MountPath: "/data/my-data",
						},
					},
				},
			},
		},
		Status: kubefloworgv1beta1.WorkspaceStatus{
			State: kubefloworgv1beta1.WorkspaceStateRunning,
			Activity: kubefloworgv1beta1.WorkspaceActivity{
				LastActivity: lastActivityTime,
				LastUpdate:   lastActivityTime,
			},
			PauseTime:      0,
			PendingRestart: false,
		},
	}

	workspace2 := workspace1.DeepCopy()
	workspace2.Name = "jupyterlab-workspace-1"

	workspace3 := workspace1.DeepCopy()
	workspace3.Name = "jupyterlab-workspace-2"

	return []v1beta1.Workspace{workspace1, *workspace2, *workspace3}
}

func GetExpectedWorkspaceModels() []data.WorkspaceModel {
	expectedLastActivity := time.Unix(0, 0).Format("2006-01-02 15:04:05 MST")

	return []data.WorkspaceModel{
		{
			Name:         "jupyterlab-workspace",
			Kind:         "jupyterlab",
			Image:        "jupyterlab_scipy_190",
			Config:       "tiny_cpu",
			Status:       "Running",
			HomeVolume:   "workspace-home-pvc",
			DataVolume:   "/data/my-data",
			CPU:          "",
			RAM:          "",
			GPU:          "",
			LastActivity: expectedLastActivity,
		},
		{
			Name:         "jupyterlab-workspace-1",
			Kind:         "jupyterlab",
			Image:        "jupyterlab_scipy_190",
			Config:       "tiny_cpu",
			Status:       "Running",
			HomeVolume:   "workspace-home-pvc",
			DataVolume:   "/data/my-data",
			CPU:          "",
			RAM:          "",
			GPU:          "",
			LastActivity: expectedLastActivity,
		},
		{
			Name:         "jupyterlab-workspace-2",
			Kind:         "jupyterlab",
			Image:        "jupyterlab_scipy_190",
			Config:       "tiny_cpu",
			Status:       "Running",
			HomeVolume:   "workspace-home-pvc",
			DataVolume:   "/data/my-data",
			CPU:          "",
			RAM:          "",
			GPU:          "",
			LastActivity: expectedLastActivity,
		},
	}
}

// Helper function to create string pointers
func stringPointer(s string) *string {
	return &s
}
