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

package workspaces_test

import (
	"testing"
	"time"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/utils/ptr"

	workspaces "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces"
)

func TestWorkspaces(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Workspaces Suite")
}

var _ = Describe("Workspace Functions", func() {
	var (
		testWorkspace     *kubefloworgv1beta1.Workspace
		testWorkspaceKind *kubefloworgv1beta1.WorkspaceKind
		testTime          = metav1.NewTime(time.Now())
	)

	BeforeEach(func() {
		testWorkspace = &kubefloworgv1beta1.Workspace{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-workspace",
				Namespace: "test-namespace",
			},
			Spec: kubefloworgv1beta1.WorkspaceSpec{
				Kind:         "jupyter-notebook",
				DeferUpdates: ptr.To(false),
				Paused:       ptr.To(false),
				PodTemplate: kubefloworgv1beta1.WorkspacePodTemplate{
					PodMetadata: &kubefloworgv1beta1.WorkspacePodMetadata{
						Labels: map[string]string{
							"app": "test-app",
						},
						Annotations: map[string]string{
							"annotation-key": "annotation-value",
						},
					},
					Volumes: kubefloworgv1beta1.WorkspacePodVolumes{
						Home: ptr.To("home-pvc"),
						Data: []kubefloworgv1beta1.PodVolumeMount{
							{
								PVCName:   "data-pvc-1",
								MountPath: "/data1",
								ReadOnly:  ptr.To(false),
							},
							{
								PVCName:   "data-pvc-2",
								MountPath: "/data2",
								ReadOnly:  ptr.To(true),
							},
						},
					},
					Options: kubefloworgv1beta1.WorkspacePodOptions{
						ImageConfig: "default-image",
						PodConfig:   "default-pod",
					},
				},
			},
			Status: kubefloworgv1beta1.WorkspaceStatus{
				State:          kubefloworgv1beta1.WorkspaceStateRunning,
				StateMessage:   "Running successfully",
				PauseTime:      testTime.Unix(),
				PendingRestart: false,
				Activity: kubefloworgv1beta1.WorkspaceActivity{
					LastActivity: testTime.Unix(),
					LastUpdate:   testTime.Unix(),
				},
				PodTemplateOptions: kubefloworgv1beta1.WorkspacePodOptionsStatus{
					ImageConfig: kubefloworgv1beta1.WorkspacePodOptionInfo{
						Desired: "desired-image",
						RedirectChain: []kubefloworgv1beta1.WorkspacePodOptionRedirectStep{
							{
								Source: "old-image",
								Target: "new-image",
							},
						},
					},
					PodConfig: kubefloworgv1beta1.WorkspacePodOptionInfo{
						Desired: "desired-pod",
						RedirectChain: []kubefloworgv1beta1.WorkspacePodOptionRedirectStep{
							{
								Source: "old-pod",
								Target: "new-pod",
							},
						},
					},
				},
			},
		}

		// Setup basic workspace kind
		testWorkspaceKind = &kubefloworgv1beta1.WorkspaceKind{
			ObjectMeta: metav1.ObjectMeta{
				Name: "jupyter-notebook",
				UID:  types.UID("test-uid"),
			},
			Spec: kubefloworgv1beta1.WorkspaceKindSpec{
				Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
					DisplayName: "Jupyter Notebook",
					Description: "A Jupyter notebook workspace",
				},
				PodTemplate: kubefloworgv1beta1.WorkspaceKindPodTemplate{
					VolumeMounts: kubefloworgv1beta1.WorkspaceKindVolumeMounts{
						Home: "/home/jovyan",
					},
					Options: kubefloworgv1beta1.WorkspaceKindPodOptions{
						ImageConfig: kubefloworgv1beta1.ImageConfig{
							Values: []kubefloworgv1beta1.ImageConfigValue{
								{
									Id: "default-image",
									Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
										DisplayName: "Default Image",
										Description: ptr.To("Default Jupyter image"),
										Labels: []kubefloworgv1beta1.OptionSpawnerLabel{
											{
												Key:   "environment",
												Value: "python",
											},
										},
									},
									Spec: kubefloworgv1beta1.ImageConfigSpec{
										Ports: []kubefloworgv1beta1.ImagePort{
											{
												Id:          "jupyter",
												DisplayName: "Jupyter",
												Protocol:    kubefloworgv1beta1.ImagePortProtocolHTTP,
											},
										},
									},
								},
								{
									Id: "old-image",
									Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
										DisplayName: "Old Image",
										Description: ptr.To("Deprecated image"),
									},
									Redirect: &kubefloworgv1beta1.OptionRedirect{
										To: "new-image",
										Message: &kubefloworgv1beta1.RedirectMessage{
											Text:  "This image has been deprecated",
											Level: kubefloworgv1beta1.RedirectMessageLevelWarning,
										},
									},
								},
							},
						},
						PodConfig: kubefloworgv1beta1.PodConfig{
							Values: []kubefloworgv1beta1.PodConfigValue{
								{
									Id: "default-pod",
									Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
										DisplayName: "Default Pod Config",
										Description: ptr.To("Default pod configuration"),
										Labels: []kubefloworgv1beta1.OptionSpawnerLabel{
											{
												Key:   "size",
												Value: "small",
											},
										},
									},
								},
								{
									Id: "old-pod",
									Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
										DisplayName: "Old Pod Config",
										Description: ptr.To("Deprecated pod config"),
									},
									Redirect: &kubefloworgv1beta1.OptionRedirect{
										To: "new-pod",
										Message: &kubefloworgv1beta1.RedirectMessage{
											Text:  "This pod config has been deprecated",
											Level: kubefloworgv1beta1.RedirectMessageLevelDanger,
										},
									},
								},
							},
						},
					},
				},
			},
		}
	})

	Describe("NewWorkspaceModelFromWorkspace", func() {
		Context("with matching workspace and workspace kind", func() {
			It("should create a complete workspace model", func() {
				result := workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, testWorkspaceKind)

				Expect(result.Name).To(Equal("test-workspace"))
				Expect(result.Namespace).To(Equal("test-namespace"))
				Expect(result.WorkspaceKind.Name).To(Equal("jupyter-notebook"))
				Expect(result.WorkspaceKind.Missing).To(BeFalse())
				Expect(result.DeferUpdates).To(BeFalse())
				Expect(result.Paused).To(BeFalse())
				Expect(result.PausedTime).To(Equal(testTime.Unix()))
				Expect(result.PendingRestart).To(BeFalse())
				Expect(result.State).To(Equal(workspaces.WorkspaceStateRunning))
				Expect(result.StateMessage).To(Equal("Running successfully"))
			})

			It("should build pod template correctly", func() {
				result := workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, testWorkspaceKind)

				Expect(result.PodTemplate.PodMetadata.Labels).To(HaveKeyWithValue("app", "test-app"))
				Expect(result.PodTemplate.PodMetadata.Annotations).To(HaveKeyWithValue("annotation-key", "annotation-value"))

				Expect(result.PodTemplate.Volumes.Home).ToNot(BeNil())
				Expect(result.PodTemplate.Volumes.Home.PVCName).To(Equal("home-pvc"))
				Expect(result.PodTemplate.Volumes.Home.MountPath).To(Equal("/home/jovyan"))
				Expect(result.PodTemplate.Volumes.Home.ReadOnly).To(BeFalse())

				Expect(result.PodTemplate.Volumes.Data).To(HaveLen(2))
				Expect(result.PodTemplate.Volumes.Data[0].PVCName).To(Equal("data-pvc-1"))
				Expect(result.PodTemplate.Volumes.Data[0].MountPath).To(Equal("/data1"))
				Expect(result.PodTemplate.Volumes.Data[0].ReadOnly).To(BeFalse())
				Expect(result.PodTemplate.Volumes.Data[1].ReadOnly).To(BeTrue())
			})

			It("should build image config correctly", func() {
				result := workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, testWorkspaceKind)

				Expect(result.PodTemplate.Options.ImageConfig.Current.Id).To(Equal("default-image"))
				Expect(result.PodTemplate.Options.ImageConfig.Current.DisplayName).To(Equal("Default Image"))
				Expect(result.PodTemplate.Options.ImageConfig.Current.Description).To(Equal("Default Jupyter image"))
				Expect(result.PodTemplate.Options.ImageConfig.Current.Labels).To(HaveLen(1))
				Expect(result.PodTemplate.Options.ImageConfig.Current.Labels[0].Key).To(Equal("environment"))
				Expect(result.PodTemplate.Options.ImageConfig.Current.Labels[0].Value).To(Equal("python"))

				Expect(result.PodTemplate.Options.ImageConfig.Desired).ToNot(BeNil())
				Expect(result.PodTemplate.Options.ImageConfig.Desired.Id).To(Equal("desired-image"))

				Expect(result.PodTemplate.Options.ImageConfig.RedirectChain).To(HaveLen(1))
				Expect(result.PodTemplate.Options.ImageConfig.RedirectChain[0].SourceId).To(Equal("old-image"))
				Expect(result.PodTemplate.Options.ImageConfig.RedirectChain[0].TargetId).To(Equal("new-image"))
				Expect(result.PodTemplate.Options.ImageConfig.RedirectChain[0].Message).ToNot(BeNil())
				Expect(result.PodTemplate.Options.ImageConfig.RedirectChain[0].Message.Text).To(Equal("This image has been deprecated"))
				Expect(result.PodTemplate.Options.ImageConfig.RedirectChain[0].Message.Level).To(Equal(workspaces.RedirectMessageLevelWarning))
			})

			It("should build pod config correctly", func() {
				result := workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, testWorkspaceKind)

				Expect(result.PodTemplate.Options.PodConfig.Current.Id).To(Equal("default-pod"))
				Expect(result.PodTemplate.Options.PodConfig.Current.DisplayName).To(Equal("Default Pod Config"))
				Expect(result.PodTemplate.Options.PodConfig.Current.Description).To(Equal("Default pod configuration"))
				Expect(result.PodTemplate.Options.PodConfig.Current.Labels).To(HaveLen(1))
				Expect(result.PodTemplate.Options.PodConfig.Current.Labels[0].Key).To(Equal("size"))
				Expect(result.PodTemplate.Options.PodConfig.Current.Labels[0].Value).To(Equal("small"))

				Expect(result.PodTemplate.Options.PodConfig.Desired).ToNot(BeNil())
				Expect(result.PodTemplate.Options.PodConfig.Desired.Id).To(Equal("desired-pod"))

				Expect(result.PodTemplate.Options.PodConfig.RedirectChain).To(HaveLen(1))
				Expect(result.PodTemplate.Options.PodConfig.RedirectChain[0].Message.Level).To(Equal(workspaces.RedirectMessageLevelDanger))
			})

			It("should build services correctly", func() {
				result := workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, testWorkspaceKind)

				Expect(result.Services).To(HaveLen(1))
				Expect(result.Services[0].HttpService).ToNot(BeNil())
				Expect(result.Services[0].HttpService.DisplayName).To(Equal("Jupyter"))
				Expect(result.Services[0].HttpService.HttpPath).To(Equal("/workspace/test-namespace/test-workspace/jupyter/"))
			})

			It("should build activity correctly", func() {
				result := workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, testWorkspaceKind)

				Expect(result.Activity.LastActivity).To(Equal(testTime.Unix()))
				Expect(result.Activity.LastUpdate).To(Equal(testTime.Unix()))
				Expect(result.Activity.LastProbe).To(BeNil())
			})
		})

		Context("with nil workspace kind", func() {
			It("should handle missing workspace kind gracefully", func() {
				result := workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, nil)

				Expect(result.WorkspaceKind.Missing).To(BeTrue())
				Expect(result.WorkspaceKind.Name).To(Equal("jupyter-notebook"))

				// Should use unknown constants for missing information
				Expect(result.PodTemplate.Volumes.Home.MountPath).To(Equal(workspaces.UnknownHomeMountPath))
				Expect(result.PodTemplate.Options.ImageConfig.Current.DisplayName).To(Equal(workspaces.UnknownImageConfig))
				Expect(result.PodTemplate.Options.PodConfig.Current.DisplayName).To(Equal(workspaces.UnknownPodConfig))
				Expect(result.Services).To(BeNil())
			})
		})

		Context("with workspace kind without UID", func() {
			It("should treat workspace kind as non-existent", func() {
				wskWithoutUID := &kubefloworgv1beta1.WorkspaceKind{
					ObjectMeta: metav1.ObjectMeta{
						Name: "jupyter-notebook",
					},
				}

				result := workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, wskWithoutUID)

				Expect(result.WorkspaceKind.Missing).To(BeTrue())
			})
		})

		Context("with mismatched workspace and workspace kind", func() {
			It("should panic when workspace kind name doesn't match", func() {
				mismatchedWSK := &kubefloworgv1beta1.WorkspaceKind{
					ObjectMeta: metav1.ObjectMeta{
						Name: "different-kind",
						UID:  types.UID("test-uid"),
					},
				}

				Expect(func() {
					workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, mismatchedWSK)
				}).To(Panic())
			})
		})

		Context("with different workspace states", func() {
			DescribeTable("should map workspace states correctly",
				func(inputState kubefloworgv1beta1.WorkspaceState, expectedState workspaces.WorkspaceState) {
					testWorkspace.Status.State = inputState
					result := workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, testWorkspaceKind)
					Expect(result.State).To(Equal(expectedState))
				},
				Entry("Running", kubefloworgv1beta1.WorkspaceStateRunning, workspaces.WorkspaceStateRunning),
				Entry("Terminating", kubefloworgv1beta1.WorkspaceStateTerminating, workspaces.WorkspaceStateTerminating),
				Entry("Paused", kubefloworgv1beta1.WorkspaceStatePaused, workspaces.WorkspaceStatePaused),
				Entry("Pending", kubefloworgv1beta1.WorkspaceStatePending, workspaces.WorkspaceStatePending),
				Entry("Error", kubefloworgv1beta1.WorkspaceStateError, workspaces.WorkspaceStateError),
				Entry("Unknown", kubefloworgv1beta1.WorkspaceStateUnknown, workspaces.WorkspaceStateUnknown),
			)
		})

		Context("with no home volume", func() {
			It("should handle nil home volume", func() {
				testWorkspace.Spec.PodTemplate.Volumes.Home = nil
				result := workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, testWorkspaceKind)

				Expect(result.PodTemplate.Volumes.Home).To(BeNil())
			})
		})

		Context("with no pod metadata", func() {
			It("should handle nil pod metadata", func() {
				testWorkspace.Spec.PodTemplate.PodMetadata = nil
				result := workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, testWorkspaceKind)

				Expect(result.PodTemplate.PodMetadata.Labels).To(BeEmpty())
				Expect(result.PodTemplate.PodMetadata.Annotations).To(BeEmpty())
			})
		})

		Context("with no desired configs", func() {
			It("should handle empty desired configs", func() {
				testWorkspace.Status.PodTemplateOptions.ImageConfig.Desired = ""
				testWorkspace.Status.PodTemplateOptions.PodConfig.Desired = ""
				result := workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, testWorkspaceKind)

				Expect(result.PodTemplate.Options.ImageConfig.Desired).To(BeNil())
				Expect(result.PodTemplate.Options.PodConfig.Desired).To(BeNil())
			})
		})

		Context("with same current and desired configs", func() {
			It("should set desired to nil when same as current", func() {
				testWorkspace.Status.PodTemplateOptions.ImageConfig.Desired = "default-image"
				testWorkspace.Status.PodTemplateOptions.PodConfig.Desired = "default-pod"
				result := workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, testWorkspaceKind)

				Expect(result.PodTemplate.Options.ImageConfig.Desired).To(BeNil())
				Expect(result.PodTemplate.Options.PodConfig.Desired).To(BeNil())
			})
		})

		Context("with no redirect chains", func() {
			It("should handle empty redirect chains", func() {
				testWorkspace.Status.PodTemplateOptions.ImageConfig.RedirectChain = nil
				testWorkspace.Status.PodTemplateOptions.PodConfig.RedirectChain = nil
				result := workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, testWorkspaceKind)

				Expect(result.PodTemplate.Options.ImageConfig.RedirectChain).To(BeNil())
				Expect(result.PodTemplate.Options.PodConfig.RedirectChain).To(BeNil())
			})
		})

		Context("with redirect message levels", func() {
			DescribeTable("should map redirect message levels correctly",
				func(inputLevel kubefloworgv1beta1.RedirectMessageLevel, expectedLevel workspaces.RedirectMessageLevel) {
					testWorkspaceKind.Spec.PodTemplate.Options.ImageConfig.Values[1].Redirect.Message.Level = inputLevel
					result := workspaces.NewWorkspaceModelFromWorkspace(testWorkspace, testWorkspaceKind)
					Expect(result.PodTemplate.Options.ImageConfig.RedirectChain[0].Message.Level).To(Equal(expectedLevel))
				},
				Entry("Info", kubefloworgv1beta1.RedirectMessageLevelInfo, workspaces.RedirectMessageLevelInfo),
				Entry("Warning", kubefloworgv1beta1.RedirectMessageLevelWarning, workspaces.RedirectMessageLevelWarning),
				Entry("Danger", kubefloworgv1beta1.RedirectMessageLevelDanger, workspaces.RedirectMessageLevelDanger),
			)
		})
	})
})
