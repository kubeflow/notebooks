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

package webhook

import (
	"fmt"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

var _ = Describe("WorkspaceKind Webhook", func() {

	const (
		namespaceName = "default"
	)

	Context("When creating a WorkspaceKind", Ordered, func() {

		testCases := []struct {
			description   string
			workspaceKind *kubefloworgv1beta1.WorkspaceKind
			shouldSucceed bool
		}{
			{
				description:   "should accept creation of a valid WorkspaceKind",
				workspaceKind: NewExampleWorkspaceKind("wsk-webhook-create-test"),
				shouldSucceed: true,
			},
			{
				description:   "should reject creation with cycle in imageConfig redirects",
				workspaceKind: NewExampleWorkspaceKindWithImageConfigCycle("wsk-webhook-image-config-cycle-test"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with cycle in podConfig redirects",
				workspaceKind: NewExampleWorkspaceKindWithPodConfigCycle("wsk-webhook-pod-config-cycle-test"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with invalid redirect target in imageConfig options",
				workspaceKind: NewExampleWorkspaceKindWithInvalidImageConfigRedirect("wsk-webhook-image-config-invalid-redirect-test"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with invalid redirect target in podConfig options",
				workspaceKind: NewExampleWorkspaceKindWithInvalidPodConfigRedirect("wsk-webhook-pod-config-invalid-redirect-test"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with invalid default imageConfig",
				workspaceKind: NewExampleWorkspaceKindWithInvalidDefaultImageConfig("wsk-webhook-image-config-default-test"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with invalid default podConfig",
				workspaceKind: NewExampleWorkspaceKindWithInvalidDefaultPodConfig("wsk-webhook-pod-config-default-test"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation with duplicate ports in imageConfig",
				workspaceKind: NewExampleWorkspaceKindWithDuplicatePorts("wsk-webhook-image-config-duplicate-ports-test"),
				shouldSucceed: false,
			},
			{
				description:   "should reject creation if extraEnv[].value is not a valid Go template",
				workspaceKind: NewExampleWorkspaceKindWithInvalidExtraEnvValue("wsk-webhook-invalid-extra-env-value-test"),
				shouldSucceed: false,
			},
		}

		for _, tc := range testCases {
			tc := tc // Create a new instance of tc to avoid capturing the loop variable.
			It(tc.description, func() {
				if tc.shouldSucceed {
					By("creating the WorkspaceKind")
					Expect(k8sClient.Create(ctx, tc.workspaceKind)).To(Succeed())

					By("deleting the WorkspaceKind")
					Expect(k8sClient.Delete(ctx, tc.workspaceKind)).To(Succeed())
				} else {
					By("creating the WorkspaceKind")
					Expect(k8sClient.Create(ctx, tc.workspaceKind)).NotTo(Succeed())
				}
			})
		}
	})

	Context("When updating a WorkspaceKind", Ordered, func() {
		var (
			workspaceKindName string
			workspaceKindKey  types.NamespacedName
			workspaceKind     *kubefloworgv1beta1.WorkspaceKind
		)

		BeforeAll(func() {
			uniqueName := "wsk-webhook-update-test"
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKindKey = types.NamespacedName{Name: workspaceKindName}

			By("creating the WorkspaceKind")
			createdWorkspaceKind := NewExampleWorkspaceKind(workspaceKindName)
			Expect(k8sClient.Create(ctx, createdWorkspaceKind)).To(Succeed())

			By("getting the created WorkspaceKind")
			workspaceKind = &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKindKey, workspaceKind)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting the WorkspaceKind")
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())
		})

		testCases := []struct {
			description string
			// modifyKindFn is a function that modifies the WorkspaceKind in some way
			// and returns a string matcher for the expected error message (if any)
			modifyKindFn  func(*kubefloworgv1beta1.WorkspaceKind) string
			workspaceName string

			// if shouldSucceed is true, the test is expected to succeed
			shouldSucceed bool
		}{
			{
				description: "should reject updates to in-use imageConfig spec",
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) string {
					wsk.Spec.PodTemplate.Options.ImageConfig.Values[0].Spec.Image = "new-image:latest"
					return fmt.Sprintf("imageConfig value %q is in use and cannot be changed", wsk.Spec.PodTemplate.Options.ImageConfig.Values[0].Id)
				},
				workspaceName: "wsk-webhook-update-image-config-test",
				shouldSucceed: false,
			},
			{
				description: "should reject updates to in-use podConfig spec",
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) string {
					wsk.Spec.PodTemplate.Options.PodConfig.Values[0].Spec.Resources = &corev1.ResourceRequirements{
						Limits: corev1.ResourceList{
							corev1.ResourceCPU: resource.MustParse("1.5"),
						},
					}
					return fmt.Sprintf("podConfig value %q is in use and cannot be changed", wsk.Spec.PodTemplate.Options.PodConfig.Values[0].Id)
				},
				workspaceName: "ws-webhook-update-pod-config-test",
				shouldSucceed: false,
			},
			{
				description: "should reject removing in-use imageConfig values",
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) string {
					toBeRemoved := "jupyterlab_scipy_180"
					newValues := make([]kubefloworgv1beta1.ImageConfigValue, 0)
					for _, value := range wsk.Spec.PodTemplate.Options.ImageConfig.Values {
						if value.Id != toBeRemoved {
							newValues = append(newValues, value)
						}
					}
					wsk.Spec.PodTemplate.Options.ImageConfig.Values = newValues
					return fmt.Sprintf("imageConfig value %q is in use and cannot be removed", toBeRemoved)
				},
				workspaceName: "ws-webhook-update-image-config-test",
				shouldSucceed: false,
			},
			{
				description: "should reject removing in-use podConfig values",
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) string {
					toBeRemoved := "tiny_cpu"
					newValues := make([]kubefloworgv1beta1.PodConfigValue, 0)
					for _, value := range wsk.Spec.PodTemplate.Options.PodConfig.Values {
						if value.Id != toBeRemoved {
							newValues = append(newValues, value)
						}
					}
					wsk.Spec.PodTemplate.Options.PodConfig.Values = newValues
					return fmt.Sprintf("podConfig value %q is in use and cannot be removed", toBeRemoved)
				},
				workspaceName: "ws-webhook-update-pod-config-test",
				shouldSucceed: false,
			},
			{
				description: "should reject updating an imageConfig value to create a self-cycle",
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) string {
					valueId := wsk.Spec.PodTemplate.Options.ImageConfig.Values[1].Id
					wsk.Spec.PodTemplate.Options.ImageConfig.Values[1].Redirect = &kubefloworgv1beta1.OptionRedirect{To: valueId}
					return fmt.Sprintf("imageConfig redirect cycle detected: [%s]", valueId)
				},
				shouldSucceed: false,
			},
			{
				description: "should reject updating a podConfig value to create a 2-step cycle",
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) string {
					step1 := wsk.Spec.PodTemplate.Options.PodConfig.Values[0].Id
					step2 := wsk.Spec.PodTemplate.Options.PodConfig.Values[1].Id
					wsk.Spec.PodTemplate.Options.PodConfig.Values[0].Redirect = &kubefloworgv1beta1.OptionRedirect{To: step2}
					wsk.Spec.PodTemplate.Options.PodConfig.Values[1].Redirect = &kubefloworgv1beta1.OptionRedirect{To: step1}
					return "podConfig redirect cycle detected: [" // there is no guarantee on which element will be first
				},
				shouldSucceed: false,
			},
			{
				description: "should reject updating an imageConfig to redirect to a non-existent value",
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) string {
					invalidTarget := "invalid_image_config"
					wsk.Spec.PodTemplate.Options.ImageConfig.Values[1].Redirect = &kubefloworgv1beta1.OptionRedirect{To: invalidTarget}
					return fmt.Sprintf("target imageConfig %q does not exist", invalidTarget)
				},
				shouldSucceed: false,
			},
			{
				description: "should reject updating a podConfig to redirect to a non-existent value",
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) string {
					invalidTarget := "invalid_pod_config"
					wsk.Spec.PodTemplate.Options.PodConfig.Values[0].Redirect = &kubefloworgv1beta1.OptionRedirect{To: invalidTarget}
					return fmt.Sprintf("target podConfig %q does not exist", invalidTarget)
				},
				shouldSucceed: false,
			},
			{
				description: "should reject updating the default imageConfig value to a non-existent value",
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) string {
					invalidDefault := "invalid_image_config"
					wsk.Spec.PodTemplate.Options.ImageConfig.Spawner.Default = invalidDefault
					return fmt.Sprintf("default imageConfig %q not found", invalidDefault)
				},
				shouldSucceed: false,
			},
			{
				description: "should reject updating the default podConfig value to a non-existent value",
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) string {
					invalidDefault := "invalid_pod_config"
					wsk.Spec.PodTemplate.Options.PodConfig.Spawner.Default = invalidDefault
					return fmt.Sprintf("default podConfig %q not found", invalidDefault)
				},
				shouldSucceed: false,
			},
			{
				description: "should reject updating an imageConfig to have duplicate ports",
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) string {
					duplicatePortNumber := int32(8888)
					wsk.Spec.PodTemplate.Options.ImageConfig.Values[1].Spec.Ports = []kubefloworgv1beta1.ImagePort{
						{
							Id:          "jupyterlab",
							DisplayName: "JupyterLab",
							Port:        duplicatePortNumber,
							Protocol:    "HTTP",
						},
						{
							Id:          "jupyterlab2",
							DisplayName: "JupyterLab2",
							Port:        duplicatePortNumber,
							Protocol:    "HTTP",
						},
					}
					return fmt.Sprintf("port %d is defined more than once", duplicatePortNumber)
				},
				shouldSucceed: false,
			},
			{
				description: "should reject updating an extraEnv[].value to an invalid Go template",
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) string {
					invalidValue := `{{ httpPathPrefix "jupyterlab" }`
					wsk.Spec.PodTemplate.ExtraEnv[0].Value = invalidValue
					return fmt.Sprintf("failed to parse template %q", invalidValue)
				},
				shouldSucceed: false,
			},
			{
				description: "should accept updating an extraEnv[].value to a valid Go template",
				modifyKindFn: func(wsk *kubefloworgv1beta1.WorkspaceKind) string {
					wsk.Spec.PodTemplate.ExtraEnv[0].Value = `{{ httpPathPrefix "jupyterlab"   }}`
					return ""
				},
				shouldSucceed: true,
			},
		}

		for _, tc := range testCases {
			tc := tc // Create a new instance of tc to avoid capturing the loop variable.
			It(tc.description, func() {
				if tc.workspaceName != "" {
					By("creating a Workspace that uses the WorkspaceKind")
					workspace := NewExampleWorkspace(tc.workspaceName, namespaceName, workspaceKindName)
					Expect(k8sClient.Create(ctx, workspace)).To(Succeed())
				}

				patch := client.MergeFrom(workspaceKind.DeepCopy())
				modifiedWorkspaceKind := workspaceKind.DeepCopy()
				expectedErrorMessage := tc.modifyKindFn(modifiedWorkspaceKind)

				By("updating the WorkspaceKind")
				if tc.shouldSucceed {
					Expect(k8sClient.Patch(ctx, modifiedWorkspaceKind, patch)).To(Succeed())
				} else {
					err := k8sClient.Patch(ctx, modifiedWorkspaceKind, patch)
					Expect(err).NotTo(Succeed())
					if expectedErrorMessage != "" {
						Expect(err.Error()).To(ContainSubstring(expectedErrorMessage))
					}
				}

				if tc.workspaceName != "" {
					By("deleting the Workspace that uses the WorkspaceKind")
					workspace := &kubefloworgv1beta1.Workspace{
						ObjectMeta: metav1.ObjectMeta{
							Name:      tc.workspaceName,
							Namespace: namespaceName,
						},
					}
					Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())
				}
			})
		}
	})
})
