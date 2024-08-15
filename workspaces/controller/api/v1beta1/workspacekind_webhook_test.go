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

package v1beta1

import (
	"fmt"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/utils/ptr"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"time"
)

var _ = Describe("WorkspaceKind Webhook", func() {

	const (
		namespaceName = "default"

		// how long to wait in "Eventually" blocks
		timeout = time.Second * 10

		// how long to wait in "Consistently" blocks
		duration = time.Second * 10

		// how frequently to poll for conditions
		interval = time.Millisecond * 250
	)

	Context("When creating WorkspaceKind under Validating Webhook", Ordered, func() {

		testCases := []struct {
			description   string
			workspaceKind *WorkspaceKind
		}{
			{
				description:   "should reject WorkspaceKind creation with cycles in ImageConfig options",
				workspaceKind: NewExampleWorkspaceKindWithImageConfigCycle("wsk-webhook-image-config-cycle-test"),
			},
			{
				description:   "should reject WorkspaceKind creation with cycles in PodConfig options",
				workspaceKind: NewExampleWorkspaceKindWithPodConfigCycle("wsk-webhook-pod-config-cycle-test"),
			},
			{
				description:   "should reject WorkspaceKind creation with invalid redirects in ImageConfig options",
				workspaceKind: NewExampleWorkspaceKindWithInvalidImageConfig("wsk-webhook-image-config-invalid-test"),
			},
			{
				description:   "should reject WorkspaceKind creation with invalid redirects in PodConfig options",
				workspaceKind: NewExampleWorkspaceKindWithInvalidPodConfig("wsk-webhook-pod-config-invalid-test"),
			},
			{
				description:   "should reject WorkspaceKind creation if the default ImageConfig option is missing",
				workspaceKind: NewExampleWorkspaceKindWithInvalidDefaultImageConfig("wsk-webhook-image-config-default-test"),
			},
			{
				description:   "should reject WorkspaceKind creation if the default PodConfig option is missing",
				workspaceKind: NewExampleWorkspaceKindWithInvalidDefaultPodConfig("wsk-webhook-pod-config-default-test"),
			},
			{
				description:   "should reject WorkspaceKind creation with non-unique ports in PodConfig",
				workspaceKind: NewExampleWorkspaceKindWithDuplicatePorts("wsk-webhook-ports-port-not-unique-test"),
			},
			{
				description:   "should reject WorkspaceKind creation if extraEnv[].value is not a valid Go template",
				workspaceKind: NewExampleWorkspaceKindWithInvalidExtraEnvValue("wsk-webhook-extra-env-value-invalid-test"),
			},
		}

		for _, tc := range testCases {
			tc := tc // Create a new instance of tc to avoid capturing the loop variable.
			It(tc.description, func() {
				By("creating the WorkspaceKind")
				Expect(k8sClient.Create(ctx, tc.workspaceKind)).ToNot(Succeed())
			})
		}

	})

	Context("When updating WorkspaceKind under Validating Webhook", Ordered, func() {
		var (
			workspaceKindName string
			workspaceKindKey  types.NamespacedName
			workspaceKind     *WorkspaceKind
		)

		BeforeAll(func() {
			uniqueName := "wsk-webhook-update-test"
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKindKey = types.NamespacedName{Name: workspaceKindName}

			By("creating the WorkspaceKind")
			createdWorkspaceKind := NewExampleWorkspaceKind(workspaceKindName)
			Expect(k8sClient.Create(ctx, createdWorkspaceKind)).To(Succeed())

			By("getting the created WorkspaceKind")
			workspaceKind = &WorkspaceKind{}
			Eventually(func() error {
				return k8sClient.Get(ctx, workspaceKindKey, workspaceKind)
			}, timeout, interval).Should(Succeed())
		})

		AfterAll(func() {
			By("deleting the WorkspaceKind")
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())
		})

		testCases := []struct {
			description   string
			modifyKindFn  func(*WorkspaceKind)
			workspaceName *string
		}{
			{
				description: "should reject updates to imageConfig spec",
				modifyKindFn: func(wsk *WorkspaceKind) {
					wsk.Spec.PodTemplate.Options.ImageConfig.Values[0].Spec.Image = "new-image:latest"
				},
			},
			{
				description: "should reject updates to podConfig spec",
				modifyKindFn: func(wsk *WorkspaceKind) {
					wsk.Spec.PodTemplate.Options.PodConfig.Values[0].Spec.Resources = &corev1.ResourceRequirements{
						Limits: corev1.ResourceList{
							corev1.ResourceCPU: resource.MustParse("1.5"),
						},
					}
				},
			},
			{
				description: "should reject WorkspaceKind update with cycles in imageConfig options",
				modifyKindFn: func(wsk *WorkspaceKind) {
					wsk.Spec.PodTemplate.Options.ImageConfig.Values[1].Redirect = &OptionRedirect{To: "jupyterlab_scipy_190"}
				},
			},
			{
				description: "should reject WorkspaceKind update with invalid redirects in ImageConfig options",
				modifyKindFn: func(wsk *WorkspaceKind) {
					wsk.Spec.PodTemplate.Options.ImageConfig.Values[1].Redirect = &OptionRedirect{To: "invalid-image-config"}
				},
			},
			{
				description: "should reject WorkspaceKind update with cycles in PodConfig options",
				modifyKindFn: func(wsk *WorkspaceKind) {
					wsk.Spec.PodTemplate.Options.PodConfig.Values[0].Redirect = &OptionRedirect{To: "small_cpu"}
					wsk.Spec.PodTemplate.Options.PodConfig.Values[1].Redirect = &OptionRedirect{To: "tiny_cpu"}

				},
			},
			{
				description: "should reject WorkspaceKind creation with invalid redirects in PodConfig options",
				modifyKindFn: func(wsk *WorkspaceKind) {
					wsk.Spec.PodTemplate.Options.PodConfig.Values[0].Redirect = &OptionRedirect{To: "invalid-pod-config"}
				},
			},
			{
				description: "should reject updates to WorkspaceKind with missing default imageConfig",
				modifyKindFn: func(wsk *WorkspaceKind) {
					wsk.Spec.PodTemplate.Options.ImageConfig.Spawner.Default = "invalid-image-config"
				},
			},
			{
				description: "should reject updates to WorkspaceKind with missing default podConfig",
				modifyKindFn: func(wsk *WorkspaceKind) {
					wsk.Spec.PodTemplate.Options.PodConfig.Spawner.Default = "invalid-pod-config"
				},
			},
			{
				description: "should reject updates to WorkspaceKind if extraEnv[].value is not a valid Go template",
				modifyKindFn: func(wsk *WorkspaceKind) {
					wsk.Spec.PodTemplate.ExtraEnv[0].Value = `{{ httpPathPrefix "jupyterlab" }`
				},
			},
			{
				description: "should reject updates that remove ImageConfig in use",
				modifyKindFn: func(wsk *WorkspaceKind) {
					wsk.Spec.PodTemplate.Options.ImageConfig.Values = wsk.Spec.PodTemplate.Options.ImageConfig.Values[1:]
				},
				workspaceName: ptr.To("ws-webhook-update-image-config-test"),
			},
			{
				description: "should reject updates that remove podConfig in use",
				modifyKindFn: func(wsk *WorkspaceKind) {
					wsk.Spec.PodTemplate.Options.PodConfig.Values = wsk.Spec.PodTemplate.Options.PodConfig.Values[1:]
				},
				workspaceName: ptr.To("ws-webhook-update-pod-config-test"),
			},
		}

		for _, tc := range testCases {
			tc := tc // Create a new instance of tc to avoid capturing the loop variable.
			It(tc.description, func() {
				if tc.workspaceName != nil {

					By("creating a Workspace with the WorkspaceKind")
					workspace := NewExampleWorkspace(*tc.workspaceName, namespaceName, workspaceKind.Name)
					Expect(k8sClient.Create(ctx, workspace)).To(Succeed())
				}

				patch := client.MergeFrom(workspaceKind.DeepCopy())
				modifiedWorkspaceKind := workspaceKind.DeepCopy()

				tc.modifyKindFn(modifiedWorkspaceKind)
				Expect(k8sClient.Patch(ctx, modifiedWorkspaceKind, patch)).NotTo(Succeed())
			})
		}
	})

})
