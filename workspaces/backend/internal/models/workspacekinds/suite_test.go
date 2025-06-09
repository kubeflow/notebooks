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

type workspaceKindTestCase struct {
	name                   string
	workspaceKind          *kubefloworgv1beta1.WorkspaceKind
	expectedName           string
	expectedDisplayName    string
	expectedDescription    string
	expectedDeprecated     bool
	expectedDeprecationMsg string
	expectedHidden         bool
	expectedIconURL        string
	expectedLogoURL        string
	expectedPodLabels      map[string]string
	expectedPodAnnotations map[string]string
	additionalValidations  func(result workspacekinds.WorkspaceKind)
}

var _ = Describe("WorkspaceKind Types", func() {
	Describe("NewWorkspaceKindModelFromWorkspaceKind", func() {
		DescribeTable("should create WorkspaceKind models correctly",
			func(tc workspaceKindTestCase) {
				result := workspacekinds.NewWorkspaceKindModelFromWorkspaceKind(tc.workspaceKind)

				// Basic assertions that apply to all test cases
				Expect(result).ToNot(BeNil())
				Expect(result.Name).To(Equal(tc.expectedName))
				Expect(result.DisplayName).To(Equal(tc.expectedDisplayName))
				Expect(result.Description).To(Equal(tc.expectedDescription))
				Expect(result.Deprecated).To(Equal(tc.expectedDeprecated))
				Expect(result.DeprecationMessage).To(Equal(tc.expectedDeprecationMsg))
				Expect(result.Hidden).To(Equal(tc.expectedHidden))
				Expect(result.Icon.URL).To(Equal(tc.expectedIconURL))
				Expect(result.Logo.URL).To(Equal(tc.expectedLogoURL))

				// Pod metadata assertions
				if tc.expectedPodLabels != nil {
					for key, value := range tc.expectedPodLabels {
						Expect(result.PodTemplate.PodMetadata.Labels).To(HaveKeyWithValue(key, value))
					}
				}
				if tc.expectedPodAnnotations != nil {
					for key, value := range tc.expectedPodAnnotations {
						Expect(result.PodTemplate.PodMetadata.Annotations).To(HaveKeyWithValue(key, value))
					}
				}

				// Run any additional custom validations
				if tc.additionalValidations != nil {
					tc.additionalValidations(result)
				}
			},

			Entry("complete WorkspaceKind with all fields", workspaceKindTestCase{
				name: "complete WorkspaceKind",
				workspaceKind: &kubefloworgv1beta1.WorkspaceKind{
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
				},
				expectedName:           "test-workspacekind",
				expectedDisplayName:    "Complete Workspacekind",
				expectedDescription:    "A complete test workspacekind with all features",
				expectedDeprecated:     false,
				expectedDeprecationMsg: "",
				expectedHidden:         false,
				expectedIconURL:        "/workspaces/backend/api/v1/workspacekinds/test-workspacekind/assets/icon",
				expectedLogoURL:        "/workspaces/backend/api/v1/workspacekinds/test-workspacekind/assets/logo",
				expectedPodLabels:      map[string]string{"app": "test-workspacekind"},
				expectedPodAnnotations: map[string]string{"annotation-key": "annotation-value"},
			}),

			Entry("empty strings in required fields", workspaceKindTestCase{
				name: "empty strings in required fields",
				workspaceKind: &kubefloworgv1beta1.WorkspaceKind{
					ObjectMeta: metav1.ObjectMeta{
						Name: "empty-fields-workspace",
					},
					Spec: kubefloworgv1beta1.WorkspaceKindSpec{
						Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
							DisplayName: "",
							Description: "",
						},
					},
				},
				expectedName:           "empty-fields-workspace",
				expectedDisplayName:    "",
				expectedDescription:    "",
				expectedDeprecated:     false,
				expectedDeprecationMsg: "",
				expectedHidden:         false,
				expectedIconURL:        "/workspaces/backend/api/v1/workspacekinds/empty-fields-workspace/assets/icon",
				expectedLogoURL:        "/workspaces/backend/api/v1/workspacekinds/empty-fields-workspace/assets/logo",
			}),

			Entry("special characters in names", workspaceKindTestCase{
				name: "special characters in names",
				workspaceKind: &kubefloworgv1beta1.WorkspaceKind{
					ObjectMeta: metav1.ObjectMeta{
						Name: "special-chars_workspace-123",
					},
					Spec: kubefloworgv1beta1.WorkspaceKindSpec{
						Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
							DisplayName: "Special-Chars_Workspace 123!",
							Description: "Workspace with special characters in name",
						},
					},
				},
				expectedName:           "special-chars_workspace-123",
				expectedDisplayName:    "Special-Chars_Workspace 123!",
				expectedDescription:    "Workspace with special characters in name",
				expectedDeprecated:     false,
				expectedDeprecationMsg: "",
				expectedHidden:         false,
				expectedIconURL:        "/workspaces/backend/api/v1/workspacekinds/special-chars_workspace-123/assets/icon",
				expectedLogoURL:        "/workspaces/backend/api/v1/workspacekinds/special-chars_workspace-123/assets/logo",
			}),

			Entry("long descriptions", workspaceKindTestCase{
				name: "long descriptions",
				workspaceKind: &kubefloworgv1beta1.WorkspaceKind{
					ObjectMeta: metav1.ObjectMeta{
						Name: "long-description-workspace",
					},
					Spec: kubefloworgv1beta1.WorkspaceKindSpec{
						Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
							DisplayName: "Long Description Workspace",
							Description: "This is a very long description that contains multiple sentences. " +
								"It describes a workspace kind that has many features and capabilities. " +
								"The description should be preserved exactly as provided without truncation. " +
								"This tests the ability to handle larger text fields in the workspace kind model.",
						},
					},
				},
				expectedName:        "long-description-workspace",
				expectedDisplayName: "Long Description Workspace",
				expectedDescription: "This is a very long description that contains multiple sentences. " +
					"It describes a workspace kind that has many features and capabilities. " +
					"The description should be preserved exactly as provided without truncation. " +
					"This tests the ability to handle larger text fields in the workspace kind model.",
				expectedDeprecated:     false,
				expectedDeprecationMsg: "",
				expectedHidden:         false,
				expectedIconURL:        "/workspaces/backend/api/v1/workspacekinds/long-description-workspace/assets/icon",
				expectedLogoURL:        "/workspaces/backend/api/v1/workspacekinds/long-description-workspace/assets/logo",
				additionalValidations: func(result workspacekinds.WorkspaceKind) {
					Expect(len(result.Description)).To(BeNumerically(">", 200))
				},
			}),

			Entry("deprecated WorkspaceKind", workspaceKindTestCase{
				name: "deprecated WorkspaceKind",
				workspaceKind: &kubefloworgv1beta1.WorkspaceKind{
					ObjectMeta: metav1.ObjectMeta{
						Name: "deprecated-workspace",
					},
					Spec: kubefloworgv1beta1.WorkspaceKindSpec{
						Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
							DisplayName:        "Deprecated Workspace",
							Description:        "This workspace kind is deprecated",
							Deprecated:         ptr.To(true),
							DeprecationMessage: ptr.To("Use new-workspace instead"),
						},
					},
				},
				expectedName:           "deprecated-workspace",
				expectedDisplayName:    "Deprecated Workspace",
				expectedDescription:    "This workspace kind is deprecated",
				expectedDeprecated:     true,
				expectedDeprecationMsg: "Use new-workspace instead",
				expectedHidden:         false,
				expectedIconURL:        "/workspaces/backend/api/v1/workspacekinds/deprecated-workspace/assets/icon",
				expectedLogoURL:        "/workspaces/backend/api/v1/workspacekinds/deprecated-workspace/assets/logo",
			}),

			Entry("hidden WorkspaceKind", workspaceKindTestCase{
				name: "hidden WorkspaceKind",
				workspaceKind: &kubefloworgv1beta1.WorkspaceKind{
					ObjectMeta: metav1.ObjectMeta{
						Name: "hidden-workspace",
					},
					Spec: kubefloworgv1beta1.WorkspaceKindSpec{
						Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
							DisplayName: "Hidden Workspace",
							Description: "This workspace kind is hidden from UI",
							Hidden:      ptr.To(true),
						},
					},
				},
				expectedName:           "hidden-workspace",
				expectedDisplayName:    "Hidden Workspace",
				expectedDescription:    "This workspace kind is hidden from UI",
				expectedDeprecated:     false,
				expectedDeprecationMsg: "",
				expectedHidden:         true,
				expectedIconURL:        "/workspaces/backend/api/v1/workspacekinds/hidden-workspace/assets/icon",
				expectedLogoURL:        "/workspaces/backend/api/v1/workspacekinds/hidden-workspace/assets/logo",
			}),

			Entry("minimal WorkspaceKind with only required fields", workspaceKindTestCase{
				name: "minimal WorkspaceKind",
				workspaceKind: &kubefloworgv1beta1.WorkspaceKind{
					ObjectMeta: metav1.ObjectMeta{
						Name: "minimal-workspace",
					},
					Spec: kubefloworgv1beta1.WorkspaceKindSpec{
						Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
							DisplayName: "Minimal Workspace",
						},
					},
				},
				expectedName:           "minimal-workspace",
				expectedDisplayName:    "Minimal Workspace",
				expectedDescription:    "",
				expectedDeprecated:     false,
				expectedDeprecationMsg: "",
				expectedHidden:         false,
				expectedIconURL:        "/workspaces/backend/api/v1/workspacekinds/minimal-workspace/assets/icon",
				expectedLogoURL:        "/workspaces/backend/api/v1/workspacekinds/minimal-workspace/assets/logo",
			}),
		)
	})
})
