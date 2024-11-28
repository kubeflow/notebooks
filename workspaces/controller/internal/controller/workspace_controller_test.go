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
	"fmt"
	"time"

	"k8s.io/utils/ptr"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

var _ = Describe("Workspace Controller", func() {

	// Define utility constants for object names and testing timeouts/durations and intervals.
	const (
		namespaceName = "default"

		// how long to wait in "Eventually" blocks
		timeout = time.Second * 10

		// how long to wait in "Consistently" blocks
		duration = time.Second * 10 //nolint:unused

		// how frequently to poll for conditions
		interval = time.Millisecond * 250
	)

	Context("When updating a Workspace", Ordered, func() {

		// Define utility variables for object names.
		// NOTE: to avoid conflicts between parallel tests, resource names are unique to each test
		var (
			workspaceName     string
			workspaceKindName string
			workspaceKey      types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := "ws-update-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKey = types.NamespacedName{Name: workspaceName, Namespace: namespaceName}

			By("creating the WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind1(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating the Workspace")
			workspace := NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceName,
					Namespace: namespaceName,
				},
			}
			Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())

			By("deleting the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKindName,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())
		})

		It("should not allow updating immutable fields", func() {
			By("getting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())
			patch := client.MergeFrom(workspace.DeepCopy())

			By("failing to update the `spec.kind` field")
			newWorkspace := workspace.DeepCopy()
			newWorkspace.Spec.Kind = "new-kind"
			Expect(k8sClient.Patch(ctx, newWorkspace, patch)).NotTo(Succeed())
		})
	})

	Context("When reconciling a Workspace", Serial, Ordered, func() {

		// Define utility variables for object names.
		// NOTE: to avoid conflicts between parallel tests, resource names are unique to each test
		var (
			workspaceName     string
			workspaceKindName string
		)

		BeforeAll(func() {
			uniqueName := "ws-reconcile-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
		})

		It("should successfully reconcile the Workspace", func() {

			By("creating a WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind1(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating a Workspace")
			workspace := NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())

			By("pausing the Workspace")
			patch := client.MergeFrom(workspace.DeepCopy())
			newWorkspace := workspace.DeepCopy()
			newWorkspace.Spec.Paused = ptr.To(true)
			Expect(k8sClient.Patch(ctx, newWorkspace, patch)).To(Succeed())

			By("setting the Workspace `status.pauseTime` to the current time")
			tolerance := int64(5)
			currentTime := time.Now().Unix()
			Eventually(func() (int64, error) {
				err := k8sClient.Get(ctx, types.NamespacedName{Name: workspaceName, Namespace: namespaceName}, workspace)
				if err != nil {
					return 0, err
				}
				return workspace.Status.PauseTime, nil
			}, timeout, interval).Should(BeNumerically("~", currentTime, tolerance))

			By("un-pausing the Workspace")
			patch = client.MergeFrom(workspace.DeepCopy())
			newWorkspace = workspace.DeepCopy()
			newWorkspace.Spec.Paused = ptr.To(false)
			Expect(k8sClient.Patch(ctx, newWorkspace, patch)).To(Succeed())

			By("setting the Workspace `status.pauseTime` to 0")
			Eventually(func() (int64, error) {
				err := k8sClient.Get(ctx, types.NamespacedName{Name: workspaceName, Namespace: namespaceName}, workspace)
				if err != nil {
					return 0, err
				}
				return workspace.Status.PauseTime, nil
			}, timeout, interval).Should(BeZero())

			By("creating a StatefulSet")
			statefulSetList := &appsv1.StatefulSetList{}
			Eventually(func() ([]appsv1.StatefulSet, error) {
				err := k8sClient.List(ctx, statefulSetList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})
				if err != nil {
					return nil, err
				}
				return statefulSetList.Items, nil
			}, timeout, interval).Should(HaveLen(1))

			// TODO: use this to get the StatefulSet
			// statefulSet := statefulSetList.Items[0]

			By("creating a Service")
			serviceList := &corev1.ServiceList{}
			Eventually(func() ([]corev1.Service, error) {
				err := k8sClient.List(ctx, serviceList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})
				if err != nil {
					return nil, err
				}
				return serviceList.Items, nil
			}, timeout, interval).Should(HaveLen(1))

			// TODO: use this to get the Service
			// service := serviceList.Items[0]

			//
			// TODO: populate these tests
			//  - use the CronJob controller tests as a reference
			//    https://github.com/kubernetes-sigs/kubebuilder/blob/master/docs/book/src/cronjob-tutorial/testdata/project/internal/controller/cronjob_controller_test.go
			//  - notes:
			//     - it may make sense to split some of these up into at least separate `It(` specs
			//       or even separate `Context(` scopes so we can run them in parallel
			//  - key things to test:
			//     - core behavior:
			//         - resources like Service/StatefulSet/VirtualService/etc are created when the Workspace is created
			//         - even if the Workspace has a >64 character name, everything still works
			//         - deleting the reconciled resources, and ensuring they are recreated
			//         - updating the reconciled resources, and ensuring they are reverted
			//         - the go templates in WorkspaceKind `spec.podTemplate.extraEnv[].value` should work properly
			//            - succeed for valid portID
			//            - return empty string for invalid portID
			//            - set Workspace to error state for invalid template format (e.g. single quote for portID string)
			//     - workspace update behavior:
			//        - pausing the Workspace results in the StatefulSet being scaled to 0
			//        - updating the selected options results in the correct resources being updated:
			//            - imageConfig - updates the StatefulSet and possibly the Service
			//            - podConfig - updates the StatefulSet
			//     - workspaceKind redirect behavior:
			//        - when adding a redirect to the currently selected `imageConfig` or `podConfig`
			//            - if the workspace is NOT paused, NO resource changes are made except setting `status.pendingRestart`
			//              and `status.podTemplateOptions` (`desired` along with `redirectChain`)
			//            - if the workspace IS paused, but `deferUpdates` is true, the same as above
			//            - if the workspace IS paused and `deferUpdates` is false:
			//                - the selected options (under `spec`) should be changed to the redirect
			//                  and `status.pendingRestart` should become false, and `podTemplateOptions` should be empty
			//                - the new options should be applied to the StatefulSet
			//     - error states:
			//        - referencing a missing WorkspaceKind results in error state
			//        - invalid WorkspaceKind (with bad option redirect - circular / missing) results in error state
			//        - multiple owned StatefulSets / Services results in error state
			//
		})
	})
})
