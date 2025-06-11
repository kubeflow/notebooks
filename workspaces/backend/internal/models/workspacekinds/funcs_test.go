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

package workspacekinds_test

import (
	"testing"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	workspacekinds "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds"
)

func TestWorkspaceKinds(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "WorkspaceKinds Suite")
}

var _ = Describe("WorkspaceKind Types", func() {
	Describe("NewWorkspaceKindModelFromWorkspaceKind", func() {
		Context("with complete WorkspaceKind", func() {
			It("should create a complete WorkspaceKind model with all fields", func() {
				wsk := &kubefloworgv1beta1.WorkspaceKind{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "test-workspacekind",
						Namespace: "kubeflow",
						Labels: map[string]string{
							"app":     "workspacekind",
							"version": "v1",
						},
						Annotations: map[string]string{
							"description": "Complete workspacekind",
						},
					},
					Spec: kubefloworgv1beta1.WorkspaceKindSpec{
						Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
							DisplayName: "Complete Workspacekind",
							Description: "A complete test workspacekind with all features",
							Deprecated:  ptr.To(false),
							Hidden:      ptr.To(false),
							Icon: kubefloworgv1beta1.WorkspaceKindIcon{
								Url: ptr.To("/workspaces/backend/api/v1/workspacekinds/test-workspacekind/assets/icon"),
							},
							Logo: kubefloworgv1beta1.WorkspaceKindIcon{
								Url: ptr.To("/workspaces/backend/api/v1/workspacekinds/test-workspacekind/assets/logo"),
							},
						},
						PodTemplate: kubefloworgv1beta1.WorkspaceKindPodTemplate{
							PodMetadata: &kubefloworgv1beta1.WorkspaceKindPodMetadata{
								Labels: map[string]string{
									"app": "test-workspacekind",
								},
								Annotations: map[string]string{
									"annotation-key": "annotation-value",
								},
							},
						},
					},
				}

				result := workspacekinds.NewWorkspaceKindModelFromWorkspaceKind(wsk)

				Expect(result).ToNot(BeNil())
				Expect(result.Name).To(Equal("test-workspacekind"))
				Expect(result.DisplayName).To(Equal("Complete Workspacekind"))
				Expect(result.Description).To(Equal("A complete test workspacekind with all features"))
				Expect(result.Deprecated).To(BeFalse())
				Expect(result.DeprecationMessage).To(Equal(""))
				Expect(result.Hidden).To(BeFalse())
				Expect(result.Icon.URL).To(Equal("/workspaces/backend/api/v1/workspacekinds/test-workspacekind/assets/icon"))
				Expect(result.Logo.URL).To(Equal("/workspaces/backend/api/v1/workspacekinds/test-workspacekind/assets/logo"))
				Expect(result.PodTemplate.PodMetadata.Labels).To(HaveKeyWithValue("app", "test-workspacekind"))
				Expect(result.PodTemplate.PodMetadata.Annotations).To(HaveKeyWithValue("annotation-key", "annotation-value"))
			})
		})

		Context("with empty strings in required fields", func() {
			It("should handle empty display name and description", func() {
				wsk := &kubefloworgv1beta1.WorkspaceKind{
					ObjectMeta: metav1.ObjectMeta{
						Name: "empty-fields-workspace",
					},
					Spec: kubefloworgv1beta1.WorkspaceKindSpec{
						Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
							DisplayName: "",
							Description: "",
						},
					},
				}

				result := workspacekinds.NewWorkspaceKindModelFromWorkspaceKind(wsk)

				Expect(result).ToNot(BeNil())
				Expect(result.Name).To(Equal("empty-fields-workspace"))
				Expect(result.DisplayName).To(Equal(""))
				Expect(result.Description).To(Equal(""))
			})
		})

		Context("with special characters in names", func() {
			It("should handle names with hyphens and underscores", func() {
				wsk := &kubefloworgv1beta1.WorkspaceKind{
					ObjectMeta: metav1.ObjectMeta{
						Name: "special-chars_workspace-123",
					},
					Spec: kubefloworgv1beta1.WorkspaceKindSpec{
						Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
							DisplayName: "Special-Chars_Workspace 123!",
							Description: "Workspace with special characters in name",
						},
					},
				}

				result := workspacekinds.NewWorkspaceKindModelFromWorkspaceKind(wsk)

				Expect(result).ToNot(BeNil())
				Expect(result.Name).To(Equal("special-chars_workspace-123"))
				Expect(result.DisplayName).To(Equal("Special-Chars_Workspace 123!"))
			})
		})

		Context("with long descriptions", func() {
			It("should handle very long descriptions", func() {
				longDescription := "This is a very long description that contains multiple sentences. " +
					"It describes a workspace kind that has many features and capabilities. " +
					"The description should be preserved exactly as provided without truncation. " +
					"This tests the ability to handle larger text fields in the workspace kind model."

				wsk := &kubefloworgv1beta1.WorkspaceKind{
					ObjectMeta: metav1.ObjectMeta{
						Name: "long-description-workspace",
					},
					Spec: kubefloworgv1beta1.WorkspaceKindSpec{
						Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
							DisplayName: "Long Description Workspace",
							Description: longDescription,
						},
					},
				}

				result := workspacekinds.NewWorkspaceKindModelFromWorkspaceKind(wsk)

				Expect(result).ToNot(BeNil())
				Expect(result.Description).To(Equal(longDescription))
				Expect(len(result.Description)).To(BeNumerically(">", 200))
			})
		})

	})
})
