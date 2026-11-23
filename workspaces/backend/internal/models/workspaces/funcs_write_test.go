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

package workspaces

import (
	"context"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/utils/ptr"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
)

var _ = Describe("Workspace Write Model Conversions", func() {

	const testNamespace = "team-a"

	newFakeClient := func(objs ...runtime.Object) *fake.ClientBuilder {
		scheme := runtime.NewScheme()
		Expect(corev1.AddToScheme(scheme)).To(Succeed())
		Expect(kubefloworgv1beta1.AddToScheme(scheme)).To(Succeed())
		return fake.NewClientBuilder().WithScheme(scheme).WithRuntimeObjects(objs...)
	}

	Describe("NewWorkspaceCreateModelFromWorkspace and NewWorkspaceUpdateModelFromWorkspace", func() {
		It("should convert a Workspace CRD to WorkspaceCreate and WorkspaceUpdate models", func() {
			ws := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:            "ws-1",
					Namespace:       testNamespace,
					ResourceVersion: "42",
				},
				Spec: kubefloworgv1beta1.WorkspaceSpec{
					DisplayName: ptr.To("My Workspace"),
					Kind:        "jupyterlab",
					Paused:      true,
					PodTemplate: kubefloworgv1beta1.WorkspacePodTemplate{
						PodMetadata: &kubefloworgv1beta1.WorkspacePodMetadata{
							Labels:      map[string]string{"env": "dev"},
							Annotations: map[string]string{"note": "test"},
						},
						Volumes: kubefloworgv1beta1.WorkspacePodVolumes{
							Home: ptr.To("home-pvc"),
							Data: []kubefloworgv1beta1.PodVolumeMount{
								{PVCName: "data-pvc", MountPath: "/data", ReadOnly: ptr.To(true)},
								{PVCName: "rw-pvc", MountPath: "/rw"},
							},
							Secrets: []kubefloworgv1beta1.PodSecretMount{
								{SecretName: "api-key", MountPath: "/secrets/api", DefaultMode: ptr.To(int32(420))},
							},
						},
						Options: kubefloworgv1beta1.WorkspacePodOptions{
							ImageConfig: "img-v1",
							PodConfig:   "small-cpu",
						},
					},
				},
			}

			createModel := NewWorkspaceCreateModelFromWorkspace(ws)
			Expect(createModel.Name).To(Equal("ws-1"))
			Expect(createModel.DisplayName).To(Equal("My Workspace"))
			Expect(createModel.Kind).To(Equal("jupyterlab"))
			Expect(createModel.Paused).To(BeTrue())
			Expect(createModel.PodTemplate.Volumes.Home).To(Equal(ptr.To("home-pvc")))
			Expect(createModel.PodTemplate.Volumes.Data).To(Equal([]PodVolumeMount{
				{PVCName: "data-pvc", MountPath: "/data", ReadOnly: true},
				{PVCName: "rw-pvc", MountPath: "/rw", ReadOnly: false},
			}))
			Expect(createModel.PodTemplate.Volumes.Secrets).To(Equal([]PodSecretMount{
				{SecretName: "api-key", MountPath: "/secrets/api", DefaultMode: ptr.To(int32(420))},
			}))
			Expect(createModel.PodTemplate.Options.ImageConfig).To(Equal("img-v1"))
			Expect(createModel.PodTemplate.Options.PodConfig).To(Equal("small-cpu"))

			updateModel := NewWorkspaceUpdateModelFromWorkspace(ws)
			Expect(updateModel.Revision).To(Equal(common.CalculateRevision(&ws.ObjectMeta)))
			Expect(updateModel.DisplayName).To(Equal("My Workspace"))
			Expect(updateModel.Paused).To(BeTrue())
		})
	})

	Describe("NewWorkspaceFromWorkspaceCreateModel", func() {
		It("should build a Workspace when referenced PVCs and Secrets are mountable", func() {
			homePVC := &corev1.PersistentVolumeClaim{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "home-pvc",
					Namespace: testNamespace,
					UID:       types.UID("pvc-home-uid"),
					Labels:    map[string]string{common.LabelCanMount: "true"},
				},
			}
			dataPVC := &corev1.PersistentVolumeClaim{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "data-pvc",
					Namespace: testNamespace,
					UID:       types.UID("pvc-data-uid"),
					Labels:    map[string]string{common.LabelCanMount: "true"},
				},
			}
			secret := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "my-secret",
					Namespace: testNamespace,
					UID:       types.UID("secret-uid"),
					Labels:    map[string]string{common.LabelCanMount: "true"},
				},
			}
			k8sClient := newFakeClient(homePVC, dataPVC, secret).Build()

			model := &WorkspaceCreate{
				Name:        "ws-new",
				DisplayName: "",
				Kind:        "jupyterlab",
				Paused:      false,
				PodTemplate: PodTemplateMutate{
					Volumes: PodVolumesMutate{
						Home: ptr.To("home-pvc"),
						Data: []PodVolumeMount{
							{PVCName: "data-pvc", MountPath: "/data", ReadOnly: true},
						},
						Secrets: []PodSecretMount{
							{SecretName: "my-secret", MountPath: "/mnt/secret", DefaultMode: ptr.To(int32(256))},
						},
					},
					Options: PodTemplateOptionsMutate{
						ImageConfig: "img-v1",
						PodConfig:   "cpu-small",
					},
				},
			}

			ws, err := NewWorkspaceFromWorkspaceCreateModel(context.Background(), k8sClient, model, testNamespace)
			Expect(err).NotTo(HaveOccurred())
			Expect(ws.Name).To(Equal("ws-new"))
			Expect(ws.Namespace).To(Equal(testNamespace))
			Expect(ws.Spec.DisplayName).To(BeNil())
			Expect(ws.Spec.Kind).To(Equal("jupyterlab"))
			Expect(ws.Spec.PodTemplate.Volumes.Home).To(Equal(ptr.To("home-pvc")))
			Expect(ws.Spec.PodTemplate.Volumes.Data).To(HaveLen(1))
			Expect(ws.Spec.PodTemplate.Volumes.Secrets).To(HaveLen(1))
		})

		It("should return validation error when PVC or Secret is missing or not mountable", func() {
			unmountablePVC := &corev1.PersistentVolumeClaim{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "blocked-pvc",
					Namespace: testNamespace,
					UID:       types.UID("pvc-blocked-uid"),
				},
			}
			k8sClient := newFakeClient(unmountablePVC).Build()

			model := &WorkspaceCreate{
				Name: "ws-invalid",
				Kind: "jupyterlab",
				PodTemplate: PodTemplateMutate{
					Volumes: PodVolumesMutate{
						Home: ptr.To("blocked-pvc"),
						Secrets: []PodSecretMount{
							{SecretName: "missing-secret", MountPath: "/mnt/secret"},
						},
					},
				},
			}

			ws, err := NewWorkspaceFromWorkspaceCreateModel(context.Background(), k8sClient, model, testNamespace)
			Expect(err).To(HaveOccurred())
			Expect(ws).To(BeNil())
		})
	})

	Describe("ApplyWorkspaceUpdateModelToWorkspace", func() {
		It("should apply updated fields to an existing Workspace", func() {
			dataPVC := &corev1.PersistentVolumeClaim{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "data-pvc",
					Namespace: testNamespace,
					UID:       types.UID("pvc-data-uid"),
					Labels:    map[string]string{common.LabelCanMount: "true"},
				},
			}
			k8sClient := newFakeClient(dataPVC).Build()

			ws := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "ws-1",
					Namespace: testNamespace,
				},
				Spec: kubefloworgv1beta1.WorkspaceSpec{
					Kind:   "jupyterlab",
					Paused: false,
				},
			}

			update := &WorkspaceUpdate{
				DisplayName: "Updated Name",
				Paused:      true,
				PodTemplate: PodTemplateMutate{
					Volumes: PodVolumesMutate{
						Data: []PodVolumeMount{{PVCName: "data-pvc", MountPath: "/data"}},
					},
					Options: PodTemplateOptionsMutate{
						ImageConfig: "img-v2",
						PodConfig:   "gpu-large",
					},
				},
			}

			Expect(ApplyWorkspaceUpdateModelToWorkspace(context.Background(), k8sClient, update, ws)).To(Succeed())
			Expect(ws.Spec.Paused).To(BeTrue())
			Expect(ws.Spec.DisplayName).To(Equal(ptr.To("Updated Name")))
			Expect(ws.Spec.PodTemplate.Options.ImageConfig).To(Equal("img-v2"))
			Expect(ws.Spec.PodTemplate.Options.PodConfig).To(Equal("gpu-large"))
			Expect(ws.Spec.PodTemplate.Volumes.Data).To(HaveLen(1))
		})
	})
})
