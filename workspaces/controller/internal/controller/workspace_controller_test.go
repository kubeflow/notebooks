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
	"k8s.io/utils/pointer"
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
		duration = time.Second * 10

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

			statefulSet := statefulSetList.Items[0]

			By("creating a Service")
			serviceList := &corev1.ServiceList{}
			Eventually(func() ([]corev1.Service, error) {
				err := k8sClient.List(ctx, serviceList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})
				if err != nil {
					return nil, err
				}
				return serviceList.Items, nil
			}, timeout, interval).Should(HaveLen(1))

			service := serviceList.Items[0]

			//
			// TODO: populate these tests
			//  - use the CronJob controller tests as a reference
			//    https://github.com/kubernetes-sigs/kubebuilder/blob/master/docs/book/src/cronjob-tutorial/testdata/project/internal/controller/cronjob_controller_test.go
			//  - notes:
			//     - it may make sense to split some of these up into at least separate `It(` specs
			//       or even separate `Context(` scopes so we can run them in parallel
			//  - key things to test:
			//     - core behaviour:
			//         - resources like Service/StatefulSet/VirtualService/etc are created when the Workspace is created
			//         - even if the Workspace has a >64 character name, everything still works
			//         - deleting the reconciled resources, and ensuring they are recreated
			//         - updating the reconciled resources, and ensuring they are reverted
			//         - the go templates in WorkspaceKind `spec.podTemplate.extraEnv[].value` should work properly
			//            - succeed for valid portID
			//            - return empty string for invalid portID
			//            - set Workspace to error state for invalid template format (e.g. single quote for portID string)
			//     - workspace update behaviour:
			//        - pausing the Workspace results in the StatefulSet being scaled to 0
			//        - updating the selected options results in the correct resources being updated:
			//            - imageConfig - updates the StatefulSet and possibly the Service
			//            - podConfig - updates the StatefulSet
			//     - workspaceKind redirect behaviour:
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
			By("deleting reconciled resources", func() {
				statefulSetList := &appsv1.StatefulSetList{}
				serviceList := &corev1.ServiceList{}

				// Delete the reconciled StatefulSet and Service
				Expect(k8sClient.Delete(ctx, &statefulSet)).To(Succeed())
				Expect(k8sClient.Delete(ctx, &service)).To(Succeed())

				// Verify that the StatefulSet is recreated
				Eventually(func() ([]appsv1.StatefulSet, error) {
					err := k8sClient.List(ctx, statefulSetList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})
					if err != nil {
						return nil, err
					}
					return statefulSetList.Items, nil
				}, timeout, interval).Should(HaveLen(1))

				// Verify that the Service is recreated
				Eventually(func() ([]corev1.Service, error) {
					err := k8sClient.List(ctx, serviceList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})
					if err != nil {
						return nil, err
					}
					return serviceList.Items, nil
				}, timeout, interval).Should(HaveLen(1))

				statefulSet = statefulSetList.Items[0]
				service = serviceList.Items[0]
			})

			By("updating reconciled resources", func() {
				// Update the StatefulSet
				statefulSetPatch := client.MergeFrom(statefulSet.DeepCopy())
				statefulSet.Spec.Replicas = pointer.Int32(3)
				Expect(k8sClient.Patch(ctx, &statefulSet, statefulSetPatch)).To(Succeed())

				// Verify that the StatefulSet reverts to its original state
				Eventually(func() int32 {
					updatedStatefulSet := &appsv1.StatefulSet{}
					err := k8sClient.Get(ctx, client.ObjectKey{Name: statefulSet.Name, Namespace: statefulSet.Namespace}, updatedStatefulSet)
					if err != nil {
						return -1
					}
					return *updatedStatefulSet.Spec.Replicas
				}, timeout, interval).Should(Equal(int32(1)))

				// Update the Service
				servicePatch := client.MergeFrom(service.DeepCopy())
				oldPortNumber := service.Spec.Ports[0].Port
				service.Spec.Ports[0].Port = 8080
				Expect(k8sClient.Patch(ctx, &service, servicePatch)).To(Succeed())

				// Verify that the Service reverts to its original state
				Eventually(func() int32 {
					updatedService := &corev1.Service{}
					err := k8sClient.Get(ctx, client.ObjectKey{Name: service.Name, Namespace: service.Namespace}, updatedService)
					if err != nil {
						return -1
					}
					return updatedService.Spec.Ports[0].Port
				}, timeout, interval).Should(Equal(oldPortNumber))
			})

		})
		It("Should succeed for valid portID", func() {
			validPortID := "jupyterlab"
			workspaceKindNameValid := fmt.Sprintf("%s-valid", workspaceKindName)
			workspaceKindValid := NewExampleWorkspaceKind2(workspaceKindNameValid, validPortID)
			workspaceNameValid := fmt.Sprintf("%s-valid", workspaceName)
			workspaceValid := NewExampleWorkspace2(workspaceNameValid, namespaceName, workspaceKindNameValid)

			By("creating the WorkspaceKind")
			Expect(k8sClient.Create(ctx, workspaceKindValid)).To(Succeed())

			By("creating a Workspace")
			Expect(k8sClient.Create(ctx, workspaceValid)).To(Succeed())

			By("checking the StatefulSet has the correct NB_PREFIX env var")
			statefulSetList := &appsv1.StatefulSetList{}
			Eventually(func() ([]appsv1.StatefulSet, error) {
				err := k8sClient.List(ctx, statefulSetList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceNameValid})
				if err != nil {
					return nil, err
				}
				return statefulSetList.Items, nil
			}, timeout, interval).Should(HaveLen(1))

			statefulSet := statefulSetList.Items[0]
			expectedEnvVar := corev1.EnvVar{Name: "NB_PREFIX", Value: fmt.Sprintf("/workspace/%s/%s/%s/", namespaceName, workspaceNameValid, validPortID)}
			Expect(statefulSet.Spec.Template.Spec.Containers[0].Env).To(ContainElement(expectedEnvVar))

			By("deleting the Workspace")
			Expect(k8sClient.Delete(ctx, workspaceValid)).To(Succeed())

			By("deleting the WorkspaceKind")
			Expect(k8sClient.Delete(ctx, workspaceKindValid)).To(Succeed())
		})

		It("Should return empty string for invalid portID", func() {
			invalidPortID := "invalid-port-id"
			workspaceKindNameInvalid := fmt.Sprintf("%s-invalid", workspaceKindName)
			workspaceKindInvalid := NewExampleWorkspaceKind2(workspaceKindNameInvalid, invalidPortID)
			workspaceNameInvalid := fmt.Sprintf("%s-invalid", workspaceName)
			workspaceInvalid := NewExampleWorkspace2(workspaceNameInvalid, namespaceName, workspaceKindNameInvalid)

			By("creating the WorkspaceKind")
			Expect(k8sClient.Create(ctx, workspaceKindInvalid)).To(Succeed())

			By("creating a Workspace")
			Expect(k8sClient.Create(ctx, workspaceInvalid)).To(Succeed())

			By("checking the StatefulSet has the correct NB_PREFIX env var")
			statefulSetList := &appsv1.StatefulSetList{}
			Eventually(func() ([]appsv1.StatefulSet, error) {
				err := k8sClient.List(ctx, statefulSetList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceNameInvalid})
				if err != nil {
					return nil, err
				}
				return statefulSetList.Items, nil
			}, timeout, interval).Should(HaveLen(1))

			statefulSet := statefulSetList.Items[0]
			expectedEnvVar := corev1.EnvVar{Name: "NB_PREFIX", Value: ""}
			Expect(statefulSet.Spec.Template.Spec.Containers[0].Env).To(ContainElement(expectedEnvVar))

			By("deleting the Workspace")
			Expect(k8sClient.Delete(ctx, workspaceInvalid)).To(Succeed())

			By("deleting the WorkspaceKind")
			Expect(k8sClient.Delete(ctx, workspaceKindInvalid)).To(Succeed())
		})

		It("Should set Workspace to error state for invalid template format", func() {
			workspaceKindNameError := fmt.Sprintf("%s-error", workspaceKindName)
			workspaceKindError := NewExampleWorkspaceKind3(workspaceKindNameError, "{{ httpPathPrefix 'jupyterlab' }}")
			workspaceNameError := fmt.Sprintf("%s-error", workspaceName)
			workspaceError := NewExampleWorkspace2(workspaceNameError, namespaceName, workspaceKindNameError)

			By("creating the WorkspaceKind")
			Expect(k8sClient.Create(ctx, workspaceKindError)).To(Succeed())

			By("creating a Workspace")
			Expect(k8sClient.Create(ctx, workspaceError)).To(Succeed())

			By("checking the StatefulSet should not be created and Workspace should be in error state")
			statefulSetList := &appsv1.StatefulSetList{}
			Eventually(func() ([]appsv1.StatefulSet, error) {
				err := k8sClient.List(ctx, statefulSetList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceNameError})
				if err != nil {
					return nil, err
				}
				return statefulSetList.Items, nil
			}, timeout, interval).Should(HaveLen(0))

			Eventually(func() (kubefloworgv1beta1.WorkspaceState, error) {
				updatedWorkspace := &kubefloworgv1beta1.Workspace{}
				err := k8sClient.Get(ctx, types.NamespacedName{Name: workspaceNameError, Namespace: namespaceName}, updatedWorkspace)
				if err != nil {
					return "", err
				}
				return updatedWorkspace.Status.State, nil
			}, timeout, interval).Should(Equal(kubefloworgv1beta1.WorkspaceStateError))
		})

	})
})
